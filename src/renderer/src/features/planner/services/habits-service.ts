/**
 * Habits.
 *
 * The streak rules here are deliberately forgiving. A counter that resets to
 * zero the first day you get sick stops being motivation and becomes a reason
 * to close the app — which, for the person this app is built for, is the whole
 * ballgame. Each habit carries a small monthly allowance of missed days that
 * the streak walks straight past.
 */

import type { Habit } from '@shared/planner'
import { checkedDays, isChecked } from '@shared/planner'
import { type DayKey, addDaysToKey, parseLocal, today, weekDays } from '@/lib/dates'

/** Is this habit supposed to happen on this day at all? */
export function isDueOn(habit: Habit, day: DayKey): boolean {
  const weekday = parseLocal(day).getDay()
  switch (habit.frequency) {
    case 'daily':
      return true
    case 'weekdays':
      return weekday >= 1 && weekday <= 5
    case 'custom':
      return (habit.weekdays ?? []).includes(weekday)
    case 'weekly-count':
      // Any day counts; the target is measured across the week.
      return true
  }
}

export interface HabitStreak {
  current: number
  longest: number
  /** Missed days already forgiven this month. */
  graceUsed: number
}

/**
 * Walks backwards from today counting due days that were checked, spending the
 * monthly grace allowance on misses before giving up.
 */
export function streakOf(habit: Habit, from: DayKey = today()): HabitStreak {
  let current = 0
  let graceUsed = 0
  let cursor = from
  let graceMonth = from.slice(0, 7)

  // A year is far past the point where a bigger number means anything.
  for (let i = 0; i < 400; i++) {
    if (!isDueOn(habit, cursor)) {
      cursor = addDaysToKey(cursor, -1)
      continue
    }
    if (isChecked(habit, cursor)) {
      current++
    } else {
      // Today not being ticked yet is not a miss — the day isn't over.
      if (cursor === from) {
        cursor = addDaysToKey(cursor, -1)
        continue
      }
      const month = cursor.slice(0, 7)
      if (month !== graceMonth) {
        graceMonth = month
        graceUsed = 0
      }
      if (graceUsed < habit.graceDaysPerMonth) {
        graceUsed++
      } else {
        break
      }
    }
    cursor = addDaysToKey(cursor, -1)
  }

  return { current, longest: longestStreak(habit), graceUsed }
}

function longestStreak(habit: Habit): number {
  const days = allCheckedDays(habit)
  if (days.length === 0) return 0

  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    // Skip days the habit wasn't due on when measuring the gap.
    let expected = addDaysToKey(days[i - 1], 1)
    while (!isDueOn(habit, expected) && expected < days[i]) {
      expected = addDaysToKey(expected, 1)
    }
    run = expected === days[i] ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  return longest
}

/** Every checked day, ascending. */
export function allCheckedDays(habit: Habit): DayKey[] {
  const out: DayKey[] = []
  for (const month of Object.keys(habit.checkins).sort()) {
    for (const day of checkedDays(habit, month)) {
      out.push(`${month}-${String(day).padStart(2, '0')}`)
    }
  }
  return out.sort()
}

export interface WeekProgress {
  done: number
  target: number
  ratio: number
}

/** How the week is going — the only sensible view for "3x per week" habits. */
export function weekProgress(habit: Habit, day: DayKey = today()): WeekProgress {
  const days = weekDays(day)
  const done = days.filter((d) => isChecked(habit, d)).length
  const target =
    habit.frequency === 'weekly-count'
      ? habit.targetPerWeek ?? 1
      : days.filter((d) => isDueOn(habit, d)).length
  return { done, target, ratio: target > 0 ? Math.min(1, done / target) : 0 }
}

/** Habits that still need attention on `day`, in display order. */
export function pendingOn(habits: Habit[], day: DayKey): Habit[] {
  return habits
    .filter((h) => !h.archived && isDueOn(h, day) && !isChecked(h, day))
    .sort((a, b) => a.order - b.order)
}

export function completionRate(habit: Habit, days: DayKey[]): number {
  const due = days.filter((d) => isDueOn(habit, d))
  if (due.length === 0) return 0
  return due.filter((d) => isChecked(habit, d)).length / due.length
}

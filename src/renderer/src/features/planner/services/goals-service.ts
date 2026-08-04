/**
 * Production goals.
 *
 * Progress is *derived*, never stored — the one exception being `manual`. A
 * goal that counts finished videos reads the finished videos; it does not keep
 * its own tally that can drift out of sync with reality the first time a task
 * is un-completed. The cost is recomputation, which is cheap; the benefit is a
 * number that can never lie.
 */

import type { AppData, BoardCard, Session, Task } from '@shared/types'
import type { GoalPeriod, PlannerGoal } from '@shared/planner'
import { isChecked } from '@shared/planner'
import {
  type DayKey,
  addMonthsToKey,
  currentMonth,
  daysBetween,
  startOfWeek,
  today,
  toDayKey,
  addDaysToKey
} from '@/lib/dates'
import { isCardDone } from '@/features/boards/board-templates'

export interface GoalPeriodRange {
  from: DayKey
  to: DayKey
  label: string
}

/** The window a goal is measured over, ending today. */
export function periodRange(period: GoalPeriod, day: DayKey = today()): GoalPeriodRange {
  switch (period) {
    case 'week': {
      const from = startOfWeek(day)
      return { from, to: addDaysToKey(from, 6), label: 'esta semana' }
    }
    case 'month': {
      const month = day.slice(0, 7)
      return { from: `${month}-01`, to: `${month}-31`, label: 'este mês' }
    }
    case 'quarter': {
      const start = addMonthsToKey(day.slice(0, 7), -2)
      return { from: `${start}-01`, to: `${day.slice(0, 7)}-31`, label: 'no trimestre' }
    }
    case 'year':
      return { from: `${day.slice(0, 4)}-01-01`, to: `${day.slice(0, 4)}-12-31`, label: 'este ano' }
    case 'none':
      return { from: '0000-01-01', to: '9999-12-31', label: 'no total' }
  }
}

function inRange(iso: string | undefined, range: GoalPeriodRange): boolean {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= range.from && day <= range.to
}

function matchesTask(goal: PlannerGoal, task: Task, cards: BoardCard[]): boolean {
  if (goal.projectId && task.projectId !== goal.projectId) return false
  if (goal.tag && !task.tags.includes(goal.tag)) return false
  if (goal.boardId) {
    const card = cards.find((c) => c.id === task.cardId)
    if (card?.boardId !== goal.boardId) return false
  }
  return true
}

export interface GoalProgress {
  current: number
  target: number
  ratio: number
  done: boolean
  /** Human description of what is being counted. */
  unit: string
  range: GoalPeriodRange
}

export function goalProgress(goal: PlannerGoal, data: AppData, day: DayKey = today()): GoalProgress {
  const range = periodRange(goal.period, day)
  let current = 0
  let unit = ''

  switch (goal.metric) {
    case 'tasks': {
      unit = 'tarefas'
      current = data.tasks.filter(
        (t) =>
          t.status === 'done' &&
          inRange(t.completedAt ?? t.updatedAt, range) &&
          matchesTask(goal, t, data.cards)
      ).length
      break
    }
    case 'cards': {
      unit = 'cards'
      current = data.cards.filter((card) => {
        if (goal.boardId && card.boardId !== goal.boardId) return false
        const board = data.boards.find((b) => b.id === card.boardId)
        if (!board || !isCardDone(card, board.columns)) return false
        return inRange(card.updatedAt, range)
      }).length
      break
    }
    case 'hours': {
      unit = 'horas'
      const seconds = data.sessions
        .filter((s: Session) => {
          if (!inRange(s.startedAt, range)) return false
          if (goal.projectId && s.projectId !== goal.projectId) return false
          return true
        })
        .reduce((sum, s) => sum + s.focusedSeconds, 0)
      current = Math.round((seconds / 3600) * 10) / 10
      break
    }
    case 'habit': {
      unit = 'dias'
      const habit = data.habits.find((h) => h.id === goal.habitId)
      if (habit) {
        const from = range.from === '0000-01-01' ? `${currentMonth()}-01` : range.from
        const to = range.to > today() ? today() : range.to
        current = daysBetween(from, to).filter((d) => isChecked(habit, d)).length
      }
      break
    }
    case 'manual':
      unit = 'unidades'
      current = goal.manualProgress
      break
  }

  const ratio = goal.target > 0 ? Math.min(1, current / goal.target) : 0
  return { current, target: goal.target, ratio, done: current >= goal.target, unit, range }
}

/**
 * Goals a finished task moves the needle on — used to tell the user what their
 * work just accomplished, which is the point of having goals at all.
 */
export function goalsAffectedBy(task: Task, data: AppData): PlannerGoal[] {
  return data.plannerGoals.filter((goal) => {
    if (goal.archived) return false
    if (goal.id === task.goalId) return true
    if (goal.metric !== 'tasks') return false
    return matchesTask(goal, task, data.cards)
  })
}

/** Pace check: is this goal on track for its deadline? */
export function goalPace(
  goal: PlannerGoal,
  progress: GoalProgress,
  day: DayKey = today()
): { onTrack: boolean; expected: number } | undefined {
  if (!goal.deadline || goal.deadline < day || progress.done) return undefined
  const start = goal.createdAt.slice(0, 10)
  const totalDays = daysBetween(start, goal.deadline).length
  const elapsed = daysBetween(start, day).length
  if (totalDays <= 0) return undefined
  const expected = (goal.target * elapsed) / totalDays
  return { onTrack: progress.current >= expected, expected: Math.round(expected * 10) / 10 }
}

/** Convenience for the dashboard: the goal most worth showing right now. */
export function leadGoal(data: AppData, day: DayKey = today()): PlannerGoal | undefined {
  const active = data.plannerGoals.filter((g) => !g.archived)
  if (active.length === 0) return undefined
  return active
    .map((goal) => ({ goal, progress: goalProgress(goal, data, day) }))
    .filter((entry) => !entry.progress.done)
    .sort((a, b) => b.progress.ratio - a.progress.ratio)[0]?.goal
}

export { toDayKey }

/**
 * Focus Planner — the scheduling spine of Focus HUB.
 *
 * Design rules that the rest of the module depends on:
 *
 *  1. `status` (todo / doing / done) and *when you plan to do it* are separate
 *     axes. "Hoje" is never a status — it is `scheduledDate`. Conflating the
 *     two is what makes other planners silently rewrite your dates when you
 *     drag a card, and it is the mistake this model refuses to make.
 *
 *  2. A day plan is a constraint problem, not a text problem: fixed events,
 *     durations, dependencies and a finite number of usable hours. It is
 *     solved by `services/scheduler.ts` — deterministic, instant, offline,
 *     and able to explain every decision it made.
 *
 *  3. Nothing here is mandatory. A task with no date, no duration and no
 *     dependencies is a perfectly valid task. The planner degrades to a plain
 *     list, because a system that demands full planning gets abandoned on the
 *     first bad day.
 */

import type { ID } from './types'

// ---------------------------------------------------------------------------
// Calendar events — commitments, not work
// ---------------------------------------------------------------------------

/**
 * Something that happens at a time whether you like it or not: a meeting, an
 * appointment, a class. The scheduler treats these as immovable and plans
 * around them; tasks are what it is allowed to move.
 */
export interface CalendarEvent {
  id: ID
  title: string
  notes?: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm — ignored when `allDay`. */
  startTime: string
  /** HH:mm */
  endTime: string
  allDay?: boolean
  color: string
  icon?: string
  location?: string
  projectId?: ID
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export type HabitFrequency = 'daily' | 'weekdays' | 'custom' | 'weekly-count'

export interface Habit {
  id: ID
  name: string
  icon: string
  color: string
  frequency: HabitFrequency
  /** `custom`: which weekdays (0 = Sunday). */
  weekdays?: number[]
  /** `weekly-count`: how many times a week, any day. */
  targetPerWeek?: number
  /** Suggested time — the scheduler uses it as a hint, not a rule. */
  timeOfDay?: string
  durationMinutes?: number
  /**
   * Missed days allowed per month before the streak breaks. Life happens, and
   * a streak that shatters on one bad day stops motivating and starts
   * punishing — which is the opposite of what this app is for.
   */
  graceDaysPerMonth: number
  archived: boolean
  order: number
  createdAt: string
  /**
   * Check-ins, stored compactly: `{ '2026-08': '1,4,5,9' }`.
   *
   * The whole app lives in one JSON document that is rewritten on every
   * mutation. Five habits as one row per day would add ~1.800 objects a year
   * to every single write; this keeps a year of one habit under 1 KB.
   */
  checkins: Record<string, string>
}

// ---------------------------------------------------------------------------
// Production goals
// ---------------------------------------------------------------------------

/**
 * What the Planner counts. Deliberately separate from the Finance HUB's money
 * goals: these are fed automatically by finished work, not by deposits.
 */
export type GoalMetric = 'tasks' | 'cards' | 'hours' | 'habit' | 'manual'

export type GoalPeriod = 'week' | 'month' | 'quarter' | 'year' | 'none'

export interface PlannerGoal {
  id: ID
  name: string
  icon: string
  color: string
  metric: GoalMetric
  /** How many tasks / cards / hours. */
  target: number
  /** Only used by `manual` — every other metric is derived from real work. */
  manualProgress: number
  period: GoalPeriod
  /** Only count work matching these, when set. */
  projectId?: ID
  boardId?: ID
  tag?: string
  habitId?: ID
  /** YYYY-MM-DD */
  deadline?: string
  archived: boolean
  order: number
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Planning preferences
// ---------------------------------------------------------------------------

export interface PlannerSettings {
  /** HH:mm — when the scheduler may start placing work. */
  dayStart: string
  /** HH:mm — and when it must stop. */
  dayEnd: string
  /** 0 = Sunday. Days the scheduler is allowed to plan on. */
  workdays: number[]
  /** Assumed length of a task that has no estimate. */
  defaultTaskMinutes: number
  /** Breathing room inserted between blocks. */
  breakMinutes: number
  /** HH:mm — protected, nothing gets scheduled over it. */
  lunchStart?: string
  lunchMinutes: number
  /**
   * Move yesterday's unfinished work to today automatically. On by default:
   * an overdue pile is a guilt list, and a guilt list gets the app closed.
   */
  autoRollover: boolean
  showHabitsOnToday: boolean
  showFinanceOnToday: boolean
  /** Warn when the plan exceeds the hours actually available. */
  capacityWarnings: boolean
}

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  dayStart: '09:00',
  dayEnd: '18:00',
  workdays: [1, 2, 3, 4, 5],
  defaultTaskMinutes: 30,
  breakMinutes: 10,
  lunchStart: '12:00',
  lunchMinutes: 60,
  autoRollover: true,
  showHabitsOnToday: true,
  showFinanceOnToday: true,
  capacityWarnings: true
}

// ---------------------------------------------------------------------------
// Labels & palettes
// ---------------------------------------------------------------------------

export const HABIT_FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: 'Todo dia',
  weekdays: 'Dias úteis',
  custom: 'Dias escolhidos',
  'weekly-count': 'X vezes por semana'
}

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  tasks: 'Tarefas concluídas',
  cards: 'Cards finalizados',
  hours: 'Horas de foco',
  habit: 'Dias de um hábito',
  manual: 'Contagem manual'
}

export const GOAL_PERIOD_LABEL: Record<GoalPeriod, string> = {
  week: 'Por semana',
  month: 'Por mês',
  quarter: 'Por trimestre',
  year: 'Por ano',
  none: 'Sem prazo fixo'
}

export const HABIT_ICONS = [
  'Dumbbell', 'GlassWater', 'BookOpen', 'Moon', 'Brain', 'Footprints',
  'Bike', 'Apple', 'Pill', 'Sun', 'PenTool', 'Languages', 'Music',
  'Heart', 'Sparkles', 'Leaf'
]

export const EVENT_ICONS = [
  'CalendarDays', 'Users', 'Video', 'Phone', 'Coffee', 'Plane', 'Car',
  'Stethoscope', 'GraduationCap', 'PartyPopper', 'Briefcase', 'MapPin'
]

export const GOAL_ICONS_PLANNER = [
  'Target', 'Trophy', 'Flag', 'Rocket', 'Clapperboard', 'Film', 'Mic',
  'TrendingUp', 'Flame', 'Star', 'Award', 'Zap'
]

/** Shared with the Finance palette so the whole app draws from one set. */
export const PLANNER_COLORS = [
  '250 82% 68%',
  '270 80% 66%',
  '300 70% 65%',
  '350 80% 62%',
  '25 90% 60%',
  '45 90% 58%',
  '152 62% 47%',
  '170 70% 50%',
  '190 85% 55%',
  '210 80% 62%',
  '240 8% 60%'
]

// ---------------------------------------------------------------------------
// Entity addressing (mirrors the Finance HUB's generic IPC)
// ---------------------------------------------------------------------------

export type PlannerEntity = 'events' | 'habits' | 'plannerGoals'

export interface PlannerEntityMap {
  events: CalendarEvent
  habits: Habit
  plannerGoals: PlannerGoal
}

// ---------------------------------------------------------------------------
// Check-in helpers — the compact format above needs one place that knows it
// ---------------------------------------------------------------------------

/** Days of `month` (YYYY-MM) this habit was checked off. */
export function checkedDays(habit: Habit, month: string): number[] {
  const raw = habit.checkins[month]
  if (!raw) return []
  return raw
    .split(',')
    .map(Number)
    .filter((n) => n > 0)
}

export function isChecked(habit: Habit, day: string): boolean {
  return checkedDays(habit, day.slice(0, 7)).includes(Number(day.slice(8, 10)))
}

/** Returns a new checkins map with `day` toggled. Never mutates. */
export function toggleCheckin(habit: Habit, day: string): Record<string, string> {
  const month = day.slice(0, 7)
  const number = Number(day.slice(8, 10))
  const days = checkedDays(habit, month)
  const next = days.includes(number)
    ? days.filter((d) => d !== number)
    : [...days, number].sort((a, b) => a - b)

  const checkins = { ...habit.checkins }
  if (next.length === 0) delete checkins[month]
  else checkins[month] = next.join(',')
  return checkins
}

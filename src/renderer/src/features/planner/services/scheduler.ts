/**
 * The day scheduler — what "✨ Organizar meu dia" actually runs.
 *
 * This is deliberately an algorithm and not a language model. Laying out a day
 * is a constraint problem: fixed appointments, durations, dependencies,
 * deadlines and a finite number of usable hours. A solver answers it instantly,
 * offline, for free, identically every time, and can point at the exact reason
 * it put something where it did. Those properties matter more here than
 * flexible phrasing does.
 *
 * It never invents work, never deletes work, and never silently drops a task:
 * anything it could not place comes back in `rejections` with a reason the user
 * can read.
 */

import type { ID, Priority, Task } from '@shared/types'
import type { CalendarEvent, PlannerSettings } from '@shared/planner'
import type { DayKey } from '@/lib/dates'
import {
  type Clock,
  type Interval,
  duration,
  fromMinutes,
  nowMinutes,
  subtractIntervals,
  toMinutes
} from '../utils/time'
import { indexTasks, openDependencies, topologicalOrder } from './dependencies'

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const ENERGY_RANK = { high: 0, medium: 1, low: 2 } as const

export interface Placement {
  taskId: ID
  startTime: Clock
  durationMinutes: number
  /** Why the scheduler chose this slot, in plain Portuguese. */
  reason: string
}

export interface Rejection {
  taskId: ID
  reason: string
}

export interface DayPlan {
  day: DayKey
  placements: Placement[]
  rejections: Rejection[]
  /** Minutes of the day that were actually free to plan into. */
  availableMinutes: number
  /** Minutes the plan consumes. */
  usedMinutes: number
  /** What is still open after planning. */
  freeMinutes: number
}

export interface ScheduleOptions {
  day: DayKey
  /** Every task in the app — needed to resolve dependencies. */
  tasks: Task[]
  events: CalendarEvent[]
  settings: PlannerSettings
  /**
   * Don't place anything before this time. Passing the current clock is what
   * makes a mid-afternoon replan stop pretending the morning is still available.
   */
  notBefore?: Clock
}

/** How long a task should occupy, falling back through the estimate chain. */
export function taskDuration(task: Task, settings: PlannerSettings): number {
  return task.durationMinutes ?? task.estimatedMinutes ?? settings.defaultTaskMinutes
}

/** Intervals of the day that are already spoken for and must not be planned over. */
export function busyIntervals(
  day: DayKey,
  tasks: Task[],
  events: CalendarEvent[],
  settings: PlannerSettings,
  includePinnedTasks = true
): Interval[] {
  const busy: Interval[] = []

  for (const event of events) {
    if (event.date !== day || event.allDay) continue
    busy.push({ start: toMinutes(event.startTime), end: toMinutes(event.endTime) })
  }

  if (settings.lunchStart && settings.lunchMinutes > 0) {
    const start = toMinutes(settings.lunchStart)
    busy.push({ start, end: start + settings.lunchMinutes })
  }

  if (includePinnedTasks) {
    for (const task of tasks) {
      if (task.scheduledDate !== day || !task.pinned || !task.startTime) continue
      if (task.status === 'done') continue
      const start = toMinutes(task.startTime)
      busy.push({ start, end: start + taskDuration(task, settings) })
    }
  }
  return busy
}

/** Slots the scheduler may fill, in chronological order. */
export function freeSlots(options: ScheduleOptions): Interval[] {
  const { day, tasks, events, settings, notBefore } = options
  const start = Math.max(
    toMinutes(settings.dayStart),
    notBefore ? toMinutes(notBefore) : 0
  )
  const end = toMinutes(settings.dayEnd)
  if (end <= start) return []
  return subtractIntervals([{ start, end }], busyIntervals(day, tasks, events, settings))
}

/**
 * Build the plan.
 *
 * Ordering happens in two stages: first by urgency (deadline, then priority,
 * then energy), then a topological pass that pulls dependencies ahead of the
 * work that needs them. Kahn's algorithm preserves the incoming order within
 * each level, so the urgency sort survives wherever dependencies don't override
 * it.
 */
export function planDay(options: ScheduleOptions): DayPlan {
  const { day, tasks, settings } = options
  const index = indexTasks(tasks)
  const slots = freeSlots(options)
  const availableMinutes = slots.reduce((sum, slot) => sum + duration(slot), 0)

  const placements: Placement[] = []
  const rejections: Rejection[] = []

  const candidates = tasks.filter(
    (t) => t.scheduledDate === day && t.status !== 'done' && !t.pinned
  )
  const sameDay = new Set(candidates.map((t) => t.id))

  // Anything waiting on work that isn't happening today can't be planned today.
  const schedulable: Task[] = []
  for (const task of candidates) {
    const blockers = openDependencies(task, index).filter((dep) => !sameDay.has(dep.id))
    if (blockers.length > 0) {
      const names = blockers.map((b) => `“${b.title}”`).join(', ')
      rejections.push({
        taskId: task.id,
        reason: `Depende de ${names}, que ainda não está pronta.`
      })
      continue
    }
    schedulable.push(task)
  }

  const ordered = topologicalOrder(sortByUrgency(schedulable))

  // Greedy first-fit. Each slot keeps its own cursor so a task that doesn't fit
  // in the morning gap can still land in the afternoon one.
  const cursors = slots.map((slot) => slot.start)

  for (const task of ordered) {
    const minutes = taskDuration(task, settings)
    let placed = false

    for (let i = 0; i < slots.length; i++) {
      const room = slots[i].end - cursors[i]
      if (room < minutes) continue
      const startTime = fromMinutes(cursors[i])
      placements.push({
        taskId: task.id,
        startTime,
        durationMinutes: minutes,
        reason: reasonFor(task, index, day)
      })
      // Leave breathing room before whatever comes next in this slot.
      cursors[i] = cursors[i] + minutes + settings.breakMinutes
      placed = true
      break
    }

    if (!placed) {
      rejections.push({
        taskId: task.id,
        reason:
          availableMinutes === 0
            ? 'Não há horário livre neste dia.'
            : `Não coube: precisa de ${minutes}min e não sobrou espaço.`
      })
    }
  }

  const usedMinutes = placements.reduce((sum, p) => sum + p.durationMinutes, 0)
  return {
    day,
    placements,
    rejections,
    availableMinutes,
    usedMinutes,
    freeMinutes: Math.max(0, availableMinutes - usedMinutes)
  }
}

/** Deadline first, then priority, then heavy work earlier. */
function sortByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dueA = a.dueDate ?? '9999-12-31'
    const dueB = b.dueDate ?? '9999-12-31'
    if (dueA !== dueB) return dueA.localeCompare(dueB)
    const prio = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (prio !== 0) return prio
    const energy = ENERGY_RANK[a.energy ?? 'medium'] - ENERGY_RANK[b.energy ?? 'medium']
    if (energy !== 0) return energy
    return a.order - b.order
  })
}

function reasonFor(task: Task, index: ReturnType<typeof indexTasks>, day: DayKey): string {
  const deps = openDependencies(task, index)
  if (deps.length > 0) return `Depois de “${deps[0].title}”.`
  if (task.dueDate && task.dueDate <= day) return 'Vence hoje.'
  if (task.priority === 'urgent') return 'Prioridade urgente.'
  if (task.priority === 'high') return 'Prioridade alta.'
  if (task.energy === 'high') return 'Trabalho pesado, melhor cedo.'
  return 'Primeiro horário livre.'
}

// ---------------------------------------------------------------------------
// Capacity — the number that keeps a plan honest
// ---------------------------------------------------------------------------

export interface DayCapacity {
  availableMinutes: number
  plannedMinutes: number
  /** Planned beyond what the day actually holds. */
  overloadMinutes: number
  ratio: number
  taskCount: number
  doneCount: number
}

/**
 * Planned versus available hours for a day.
 *
 * This is the single most important number in the module. Planning fourteen
 * hours into a six-hour day is the reason people abandon daily planners: the
 * plan fails, and the failure feels personal rather than arithmetic. Showing
 * the mismatch up front turns it back into arithmetic.
 */
export function dayCapacity(
  day: DayKey,
  tasks: Task[],
  events: CalendarEvent[],
  settings: PlannerSettings
): DayCapacity {
  const window = {
    start: toMinutes(settings.dayStart),
    end: toMinutes(settings.dayEnd)
  }
  // Pinned tasks are work, not obstacles — they must not shrink the day here.
  const obstacles = busyIntervals(day, tasks, events, settings, false)
  const available = subtractIntervals([window], obstacles).reduce(
    (sum, slot) => sum + duration(slot),
    0
  )

  const dayTasks = tasks.filter((t) => t.scheduledDate === day)
  const pending = dayTasks.filter((t) => t.status !== 'done')
  const planned = pending.reduce((sum, t) => sum + taskDuration(t, settings), 0)

  return {
    availableMinutes: available,
    plannedMinutes: planned,
    overloadMinutes: Math.max(0, planned - available),
    ratio: available > 0 ? planned / available : planned > 0 ? Infinity : 0,
    taskCount: dayTasks.length,
    doneCount: dayTasks.filter((t) => t.status === 'done').length
  }
}

// ---------------------------------------------------------------------------
// Rollover
// ---------------------------------------------------------------------------

/**
 * Unfinished work from before `day`, moved onto it.
 *
 * Returns only the tasks that changed, so the caller can skip the write when
 * there is nothing to do. Times are cleared rather than carried over: a block
 * that was booked for yesterday morning means nothing today, and leaving it
 * would produce phantom overlaps.
 */
export function rolloverTasks(tasks: Task[], day: DayKey): Task[] {
  const stamp = new Date().toISOString()
  return tasks
    .filter((t) => t.scheduledDate && t.scheduledDate < day && t.status !== 'done')
    .map((t) => ({
      ...t,
      scheduledDate: day,
      startTime: undefined,
      pinned: false,
      updatedAt: stamp
    }))
}

/** Apply a plan to the tasks it refers to, returning only what changed. */
export function applyPlan(plan: DayPlan, tasks: Task[]): Task[] {
  const stamp = new Date().toISOString()
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const changed: Task[] = []

  for (const placement of plan.placements) {
    const task = byId.get(placement.taskId)
    if (!task) continue
    if (task.startTime === placement.startTime && task.durationMinutes === placement.durationMinutes) {
      continue
    }
    changed.push({
      ...task,
      startTime: placement.startTime,
      durationMinutes: placement.durationMinutes,
      updatedAt: stamp
    })
  }

  // Anything that couldn't be placed loses its time but keeps its day — it
  // stays visible as unscheduled work instead of quietly disappearing.
  for (const rejection of plan.rejections) {
    const task = byId.get(rejection.taskId)
    if (!task?.startTime) continue
    changed.push({ ...task, startTime: undefined, updatedAt: stamp })
  }
  return changed
}

// ---------------------------------------------------------------------------
// "What should I do right now?"
// ---------------------------------------------------------------------------

export interface NowState {
  /** The block covering the current minute, if any. */
  current?: { task: Task; startTime: Clock; endTime: Clock; minutesLeft: number }
  /** What comes after it. */
  next?: { task: Task; startTime: Clock; minutesUntil: number }
  /** Best unscheduled candidate when nothing is booked. */
  suggestion?: Task
}

/**
 * The answer to the question the whole module exists for. Falls back through
 * three levels so it is never empty while there is work to do: what is running
 * now, what is next, and — when nothing is booked — the task the scheduler
 * would have picked first anyway.
 */
export function resolveNow(
  day: DayKey,
  tasks: Task[],
  settings: PlannerSettings,
  today: DayKey
): NowState {
  const dayTasks = tasks.filter((t) => t.scheduledDate === day && t.status !== 'done')
  const timed = dayTasks
    .filter((t) => t.startTime)
    .map((t) => ({
      task: t,
      start: toMinutes(t.startTime!),
      end: toMinutes(t.startTime!) + taskDuration(t, settings)
    }))
    .sort((a, b) => a.start - b.start)

  // Looking at another day: there is no "now", only what comes first.
  if (day !== today) {
    const first = timed[0]
    return {
      next: first
        ? { task: first.task, startTime: fromMinutes(first.start), minutesUntil: 0 }
        : undefined,
      suggestion: first ? undefined : sortByUrgency(dayTasks)[0]
    }
  }

  const now = nowMinutes()
  const running = timed.find((block) => now >= block.start && now < block.end)
  const upcoming = timed.find((block) => block.start > now)

  return {
    current: running
      ? {
          task: running.task,
          startTime: fromMinutes(running.start),
          endTime: fromMinutes(running.end),
          minutesLeft: running.end - now
        }
      : undefined,
    next: upcoming
      ? {
          task: upcoming.task,
          startTime: fromMinutes(upcoming.start),
          minutesUntil: upcoming.start - now
        }
      : undefined,
    suggestion:
      running || upcoming
        ? undefined
        : sortByUrgency(dayTasks.filter((t) => !t.startTime))[0]
  }
}

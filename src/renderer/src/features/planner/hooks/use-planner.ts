import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '@shared/types'
import { useAppStore } from '@/stores/app-store'
import { type DayKey, today } from '@/lib/dates'
import {
  type DayCapacity,
  type NowState,
  dayCapacity,
  resolveNow,
  rolloverTasks,
  taskDuration
} from '../services/scheduler'

/**
 * Tasks planned for a day, timed ones first in clock order and the loose ones
 * after — which is how the day view and the Today screen both want them.
 */
export function useDayTasks(day: DayKey): Task[] {
  const tasks = useAppStore((s) => s.tasks)
  return useMemo(() => {
    const mine = tasks.filter((t) => t.scheduledDate === day)
    return mine.sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime)
      if (a.startTime) return -1
      if (b.startTime) return 1
      return a.order - b.order
    })
  }, [tasks, day])
}

export function useCapacity(day: DayKey): DayCapacity {
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const settings = useAppStore((s) => s.planner)
  return useMemo(
    () => dayCapacity(day, tasks, events, settings),
    [day, tasks, events, settings]
  )
}

export function useNow(day: DayKey): NowState {
  const tasks = useAppStore((s) => s.tasks)
  const settings = useAppStore((s) => s.planner)
  // Re-resolve every 30s so "faltam 12min" doesn't sit there going stale.
  const tick = useMinuteTick()
  return useMemo(
    () => resolveNow(day, tasks, settings, today()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, tasks, settings, tick]
  )
}

/** Bumps every 30 seconds, so anything showing live time stays truthful. */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  return tick
}

/**
 * Moves unfinished work from previous days onto today, once per app run.
 *
 * The alternative — a growing pile marked "atrasado" — is a guilt list, and a
 * guilt list gets the app closed. Rolling forward keeps the plan honest without
 * making the user feel audited.
 */
export function useRollover(): void {
  const tasks = useAppStore((s) => s.tasks)
  const saveTasks = useAppStore((s) => s.saveTasks)
  const autoRollover = useAppStore((s) => s.planner.autoRollover)
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !autoRollover || tasks.length === 0) return
    done.current = true
    const moved = rolloverTasks(tasks, today())
    if (moved.length > 0) void saveTasks(moved)
  }, [tasks, autoRollover, saveTasks])
}

export { taskDuration }

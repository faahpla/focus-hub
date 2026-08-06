/**
 * What actually occupies a day.
 *
 * The rule this file exists to enforce: **a task that belongs to a card never
 * shows up on the planner by itself.** A card is the deliverable — the thing
 * that goes on the day — and its tasks are the process *inside* it. Listing
 * both turns one video into six lines on the agenda and buries the day.
 *
 * So the planner sees a single flat list of items: standalone tasks, and cards.
 */

import type { BoardCard, ID, Task } from '@shared/types'
import type { PlannerSettings } from '@shared/planner'
import type { DayKey } from '@/lib/dates'
import { toMinutes } from '../utils/time'

/** Default block length for a card that has no duration set. */
export const DEFAULT_CARD_MINUTES = 60

export interface PlannerItem {
  id: ID
  kind: 'task' | 'card'
  title: string
  /** Minutes from midnight, when it sits at a fixed time. */
  start?: number
  durationMinutes: number
  /** True when the user placed it by hand and auto-planning must not move it. */
  fixed: boolean
  done: boolean
  task?: Task
  card?: BoardCard
}

/** A task the planner may show on its own — i.e. one that isn't inside a card. */
export function isStandalone(task: Task): boolean {
  return !task.cardId
}

/** Only the tasks the planner treats as day items. */
export function standaloneTasks(tasks: Task[]): Task[] {
  return tasks.filter(isStandalone)
}

export function cardDuration(card: BoardCard): number {
  return card.durationMinutes ?? DEFAULT_CARD_MINUTES
}

/** Everything planned for `day`, cards and standalone tasks together. */
export function buildDayItems(
  day: DayKey,
  tasks: Task[],
  cards: BoardCard[],
  settings: PlannerSettings
): PlannerItem[] {
  const items: PlannerItem[] = []

  for (const task of tasks) {
    if (task.cardId) continue // lives inside its card
    if (task.scheduledDate !== day) continue
    items.push({
      id: task.id,
      kind: 'task',
      title: task.title,
      start: task.startTime ? toMinutes(task.startTime) : undefined,
      durationMinutes:
        task.durationMinutes ?? task.estimatedMinutes ?? settings.defaultTaskMinutes,
      fixed: Boolean(task.pinned),
      done: task.status === 'done',
      task
    })
  }

  for (const card of cards) {
    if (card.dueDate !== day) continue
    items.push({
      id: card.id,
      kind: 'card',
      title: card.title,
      start: card.dueTime ? toMinutes(card.dueTime) : undefined,
      durationMinutes: cardDuration(card),
      // A delivery time is a commitment, not a suggestion.
      fixed: Boolean(card.dueTime),
      done: Boolean(card.done),
      card
    })
  }

  return items.sort((a, b) => {
    if (a.start !== undefined && b.start !== undefined) return a.start - b.start
    if (a.start !== undefined) return -1
    if (b.start !== undefined) return 1
    return a.title.localeCompare(b.title, 'pt-BR')
  })
}

/** Progress of a card's internal steps, for showing on its block. */
export function cardProgress(card: BoardCard, tasks: Task[]): { done: number; total: number } {
  const steps = tasks.filter((t) => t.cardId === card.id)
  return { done: steps.filter((t) => t.status === 'done').length, total: steps.length }
}

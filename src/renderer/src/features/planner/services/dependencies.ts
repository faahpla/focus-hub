/**
 * Task dependencies.
 *
 * Kept deliberately small: a task lists what must finish before it (`blockedBy`),
 * and that is all. No graph editor, no lag times, no start-to-start variants —
 * those turn a planner into project-management software and stop getting used.
 *
 * The one thing that must be airtight is cycles. A → B → A makes both tasks
 * unstartable forever and silently breaks the scheduler's ordering, so links
 * are validated before they are ever saved.
 */

import type { ID, Task } from '@shared/types'

export type TaskIndex = Map<ID, Task>

export function indexTasks(tasks: Task[]): TaskIndex {
  return new Map(tasks.map((t) => [t.id, t]))
}

/** Dependencies that exist and are not finished yet. */
export function openDependencies(task: Task, index: TaskIndex): Task[] {
  if (!task.blockedBy?.length) return []
  return task.blockedBy
    .map((id) => index.get(id))
    .filter((dep): dep is Task => Boolean(dep) && dep!.status !== 'done')
}

export function isBlocked(task: Task, index: TaskIndex): boolean {
  return openDependencies(task, index).length > 0
}

/**
 * Would adding `blockerId` as a dependency of `taskId` create a cycle?
 *
 * Walks up from the proposed blocker: if we can reach the task itself, the
 * link closes a loop.
 */
export function wouldCycle(taskId: ID, blockerId: ID, index: TaskIndex): boolean {
  if (taskId === blockerId) return true
  const seen = new Set<ID>()
  const stack = [blockerId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === taskId) return true
    if (seen.has(current)) continue
    seen.add(current)
    const deps = index.get(current)?.blockedBy ?? []
    stack.push(...deps)
  }
  return false
}

/**
 * Order tasks so that dependencies come before their dependants (Kahn). Tasks
 * inside a cycle would otherwise vanish from the result — they are appended at
 * the end instead, because dropping a user's task off the plan is worse than
 * scheduling it in a debatable order.
 */
export function topologicalOrder(tasks: Task[]): Task[] {
  const ids = new Set(tasks.map((t) => t.id))
  const remaining = new Map(tasks.map((t) => [t.id, t]))
  const done = new Set<ID>()
  const out: Task[] = []

  while (remaining.size > 0) {
    let progressed = false
    for (const [id, task] of remaining) {
      // Dependencies outside this set are handled by `isBlocked`, not here.
      const pending = (task.blockedBy ?? []).filter((d) => ids.has(d) && !done.has(d))
      if (pending.length > 0) continue
      out.push(task)
      done.add(id)
      remaining.delete(id)
      progressed = true
    }
    if (!progressed) {
      // Everything left is part of a cycle.
      out.push(...remaining.values())
      break
    }
  }
  return out
}

/** Tasks that this one is blocking — used to warn before deleting. */
export function dependants(taskId: ID, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.blockedBy?.includes(taskId))
}

import type { BoardCard, ChecklistItem } from '@shared/types'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { useToastStore } from '@/stores/toast-store'
import { nextStep } from '@/features/boards/card-flow'

/**
 * Point the focus timer at a card — at one step of it, the next open one
 * unless told which. Every "Focar" in the app goes through here, so the
 * session always knows the card and step, and the report can tick the step.
 *
 * With `start`, the session begins right away: one click from "what's next"
 * to working on it. Without, the timer is only set up, for the focus screen.
 * Returns false when a session is already running and nothing changed.
 */
export function focusOnCard(
  card: BoardCard,
  { step = nextStep(card), start = false }: { step?: ChecklistItem; start?: boolean } = {}
): boolean {
  const session = useSessionStore.getState()
  if (session.phase === 'running' || session.phase === 'paused') {
    useToastStore.getState().push({
      title: 'Já tem um foco rodando',
      lines: [`${session.taskTitle} — encerre esse antes de começar outro.`],
      variant: 'warning'
    })
    return false
  }
  const { boards, projects, settings } = useAppStore.getState()
  const board = boards.find((b) => b.id === card.boardId)
  session.configure({
    project: projects.find((p) => p.id === board?.projectId),
    card,
    step,
    minutes: card.durationMinutes ?? settings.defaultDurationMinutes
  })
  if (start) void useSessionStore.getState().start()
  return true
}

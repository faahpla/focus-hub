import type { Board, BoardCard, ChecklistItem } from '@shared/types'
import { addDaysToKey, diffDays, relativeDayLabel, today } from '@/lib/dates'
import { isCardCancelled, isCardDone } from './board-templates'

/**
 * Where a card stands in the work, read the same way by the home screen, the
 * focus timer and the search: which deliveries are coming, which step is
 * next, and how close the deadline is.
 */

/** A card still being worked on, with the board it lives on. */
export interface Delivery {
  card: BoardCard
  board: Board
  /** Days from today: negative when overdue. */
  daysLeft: number
}

/** The first step not ticked yet — what "continuing" this card means. */
export function nextStep(card: BoardCard): ChecklistItem | undefined {
  return (card.checklist ?? []).find((step) => !step.done)
}

/** Whether the card is still open work: not finished, not dropped. */
export function isCardOpen(card: BoardCard, board: Board): boolean {
  return !isCardDone(card, board.columns) && !isCardCancelled(card, board.columns)
}

/**
 * Open cards with a delivery date up to `horizon` days ahead, overdue ones
 * included however old. Most urgent first: by date, then by time, with a card
 * that has no time after the ones that do on the same day.
 */
export function deliveries(cards: BoardCard[], boards: Board[], horizon = 6): Delivery[] {
  const day = today()
  const last = addDaysToKey(day, horizon)
  const byId = new Map(boards.map((b) => [b.id, b]))
  const out: Delivery[] = []
  for (const card of cards) {
    const board = byId.get(card.boardId)
    if (!board || !card.dueDate || card.dueDate > last) continue
    if (!isCardOpen(card, board)) continue
    out.push({ card, board, daysLeft: diffDays(day, card.dueDate) })
  }
  return out.sort(
    (a, b) =>
      a.card.dueDate!.localeCompare(b.card.dueDate!) ||
      (a.card.dueTime ?? '99:99').localeCompare(b.card.dueTime ?? '99:99')
  )
}

/**
 * The one delivery to put first: what is due today or coming, your own or
 * nobody's before someone else's. Overdue ones only when nothing is ahead,
 * newest first — a card left behind for weeks is rarely what to do now, and
 * leading with it buried today's work under it.
 */
export function pickNext(all: Delivery[], me: string | null | undefined): Delivery | undefined {
  const mine = (d: Delivery): boolean => !d.card.assigneeId || d.card.assigneeId === me
  const ahead = all.filter((d) => d.daysLeft >= 0)
  const behind = all.filter((d) => d.daysLeft < 0).reverse()
  return ahead.find(mine) ?? ahead[0] ?? behind.find(mine) ?? behind[0]
}

/** "em 1h 5min" / "há 20min" — distance from now to today's `HH:mm`. */
function untilLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  const minutes = h * 60 + m - (now.getHours() * 60 + now.getMinutes())
  const abs = Math.abs(minutes)
  const text = abs >= 60 ? `${Math.floor(abs / 60)}h${abs % 60 ? ` ${abs % 60}min` : ''}` : `${abs}min`
  return minutes >= 0 ? `em ${text}` : `há ${text}`
}

/**
 * The deadline in words: "Atrasada · era ontem", "Hoje 14:00 · em 1h 5min",
 * "Amanhã 19:00", "Sex, 24 Out".
 */
export function dueLabel(card: BoardCard): string {
  if (!card.dueDate) return 'Sem data'
  const delta = diffDays(today(), card.dueDate)
  const time = card.dueTime ? ` ${card.dueTime}` : ''
  if (delta < 0) {
    return `Atrasada · era ${delta === -1 ? 'ontem' : `há ${-delta} dias`}`
  }
  if (delta === 0) {
    return card.dueTime ? `Hoje${time} · ${untilLabel(card.dueTime)}` : 'Hoje'
  }
  return `${relativeDayLabel(card.dueDate)}${time}`
}

/** True when the card's moment has passed: an earlier day, or today past its time. */
export function isLate(card: BoardCard): boolean {
  if (!card.dueDate) return false
  const delta = diffDays(today(), card.dueDate)
  if (delta !== 0) return delta < 0
  if (!card.dueTime) return false
  const [h, m] = card.dueTime.split(':').map(Number)
  const now = new Date()
  return h * 60 + m < now.getHours() * 60 + now.getMinutes()
}

/** Accent- and case-blind text, for searching titles as people type them. */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

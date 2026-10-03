import type { Board } from '@shared/types'
import type { SharePerson } from '@shared/sync'

/** Someone on a shared board, ready to draw. */
export interface Person extends SharePerson {
  /** "você" for the signed-in account; the e-mail's name part otherwise. */
  label: string
  initials: string
  /** HSL channels, like the column colours: `hsl(${color})`. */
  color: string
  isMe: boolean
}

/**
 * The colours a person can wear. Spread far apart on the wheel so two people
 * never read as one, and clear of the success green and destructive red that
 * already mean "done" and "dropped" on a card.
 */
export const PERSON_COLORS = [
  '250 82% 68%', // violet — the app's own, the owner's default
  '27 96% 61%', // orange
  '172 66% 45%', // teal
  '330 81% 64%', // pink
  '199 89% 58%', // sky
  '48 96% 53%', // yellow
  '280 70% 66%', // purple
  '214 20% 62%' // slate
] as const

/** Until the owner picks, the owner is the app's own violet on every PC. */
const OWNER_COLOR = PERSON_COLORS[0]

/** Members' automatic colours, everything but the owner's. */
const MEMBER_COLORS = PERSON_COLORS.slice(1, 5)

/**
 * A member's colour comes from their account id, not from list order: both
 * PCs work it out alone and must land on the same one.
 */
function colorFor(userId: string): string {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return MEMBER_COLORS[hash % MEMBER_COLORS.length]
}

function toPerson(p: SharePerson, me: string | undefined, chosen: string | undefined): Person {
  const name = p.email.split('@')[0] || p.email || '?'
  const letters = name.replace(/[^A-Za-z0-9]/g, '')
  return {
    ...p,
    isMe: p.userId === me,
    label: p.userId === me ? 'você' : name,
    initials: (letters.slice(0, 2) || '?').toUpperCase(),
    // The owner's pick wins; otherwise the automatic colour both PCs agree on.
    color: chosen ?? (p.isOwner ? OWNER_COLOR : colorFor(p.userId))
  }
}

/** Everyone on a shared board, owner first. Empty for a board only on this PC. */
export function peopleOf(board: Board | undefined, me: string | undefined): Person[] {
  const people = board?.shared?.people ?? []
  return [...people]
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
    .map((p) => toPerson(p, me, board?.personColors?.[p.userId]))
}

/**
 * Who a card is assigned to. Someone who has since left the board resolves
 * to nobody: the card keeps the id, but there is no one to show.
 */
export function personOf(
  board: Board | undefined,
  userId: string | undefined,
  me: string | undefined
): Person | undefined {
  if (!userId) return undefined
  return peopleOf(board, me).find((p) => p.userId === userId)
}

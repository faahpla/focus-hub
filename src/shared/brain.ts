import type { BrainNote } from './types'

/**
 * A note from a piece of captured text: the first line is the title, the rest
 * the body. A first line too long for a title is cut there but kept whole in
 * the body, so nothing typed is lost. Used by the capture window (in main)
 * and by the capture button (in the screen).
 */
export function noteFromText(
  text: string,
  createdAt: string,
  extra: Partial<BrainNote> = {}
): BrainNote {
  const lines = text.trim().split(/\r?\n/)
  const first = lines[0].trim()
  const short = first.length <= 90
  return {
    id: crypto.randomUUID(),
    title: short ? first : `${first.slice(0, 87).trimEnd()}…`,
    body: (short ? lines.slice(1) : lines).join('\n').trim(),
    topics: [],
    inbox: true,
    createdAt,
    updatedAt: createdAt,
    ...extra
  }
}

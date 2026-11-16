import type { Board, BoardCard, BrainNote, BrainTopic } from '@shared/types'
import { toEditorHtml, toPlainText } from '@/lib/rich-text'
import { searchable } from '@/features/boards/card-flow'

/**
 * How notes point at each other: `[[Título]]` written in the body. The links
 * are read from the text every time instead of being stored, so editing a
 * note can never leave a stale list of links behind it.
 */

export const LINK_PATTERN = /\[\[([^[\]\n]+?)\]\]/g

/** The key two titles are compared by: case and accents don't matter. */
export const titleKey = (title: string): string => searchable(title.trim())

/** The titles a body links to, in order, each once. */
export function linksIn(body: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of toPlainText(body).matchAll(LINK_PATTERN)) {
    const title = match[1].trim()
    const key = titleKey(title)
    if (title && !seen.has(key)) {
      seen.add(key)
      out.push(title)
    }
  }
  return out
}

/** Notes by their title key, for resolving links. */
export function notesByTitle(notes: BrainNote[]): Map<string, BrainNote> {
  const map = new Map<string, BrainNote>()
  for (const note of notes) {
    const key = titleKey(note.title)
    if (key && !map.has(key)) map.set(key, note)
  }
  return map
}

/** The notes that link to this one. */
export function backlinksOf(note: BrainNote, notes: BrainNote[]): BrainNote[] {
  const key = titleKey(note.title)
  if (!key) return []
  return notes.filter((n) => n.id !== note.id && linksIn(n.body).some((t) => titleKey(t) === key))
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * A body with every `[[from]]` turned into `[[to]]`, for when a note is
 * renamed — so the links pointing at it keep pointing at it. Matches the
 * title however it was cased, and as it reads inside the editor's HTML.
 */
export function renameLinks(body: string, from: string, to: string): string {
  let out = body
  for (const [a, b] of [
    [from, to],
    [escapeHtml(from), escapeHtml(to)]
  ]) {
    out = out.replace(new RegExp(`\\[\\[\\s*${escapeRegExp(a)}\\s*\\]\\]`, 'gi'), `[[${b}]]`)
  }
  return out
}

/** The first words of a note, for the list. */
export function snippetOf(body: string, length = 140): string {
  const text = toPlainText(body).replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}

/** Whether a note matches a search: every word, in the title or the text. */
export function noteMatches(note: BrainNote, query: string): boolean {
  const terms = searchable(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const hay = searchable(`${note.title}\n${toPlainText(note.body)}`)
  return terms.every((t) => hay.includes(t))
}

// ---------------------------------------------------------------------------
// Bringing a board in
// ---------------------------------------------------------------------------

/** One part of a card that becomes a section of the note. */
function section(label: string, value: string | undefined): string {
  if (!value || !toPlainText(value).trim()) return ''
  return `<h2>${label}</h2>${toEditorHtml(value)}`
}

/**
 * A board's cards as notes: the title stays the title, the script is the
 * body, and every other filled field comes along as a section under its own
 * heading — nothing on the card is left behind. The card's column and its
 * tags become topics. Cards already brought in are skipped, so running it
 * again only adds what is new.
 */
export function notesFromBoard(
  board: Board,
  cards: BoardCard[],
  notes: BrainNote[],
  topics: BrainTopic[]
): { notes: BrainNote[]; topics: BrainTopic[] } {
  const done = new Set(notes.map((n) => n.fromCardId).filter(Boolean))
  const nextTopics = [...topics]
  const topicFor = (name: string, color: string): string => {
    const key = titleKey(name)
    const found = nextTopics.find((t) => titleKey(t.name) === key)
    if (found) return found.id
    const created: BrainTopic = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      order: nextTopics.length
    }
    nextTopics.push(created)
    return created.id
  }

  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  // Topics in the board's column order, before any card is read.
  for (const col of columns) topicFor(col.name, col.color)

  const created: BrainNote[] = []
  for (const card of cards) {
    if (card.boardId !== board.id || done.has(card.id)) continue
    const column = columns.find((c) => c.id === card.columnId)
    const ids = new Set<string>()
    if (column) ids.add(topicFor(column.name, column.color))
    for (const tag of card.tags ?? []) ids.add(topicFor(tag, column?.color ?? board.color))

    const steps = (card.checklist ?? []).map((s) => `${s.done ? '✓' : '○'} ${s.label}`).join('\n')
    const assets = (card.assets ?? []).map((a) => a.value).join('\n')
    const extras = [
      section('Resumo', card.summary),
      section('B-roll', card.bRoll),
      section('TikTok', card.publishTitle),
      section('YouTube', card.description),
      section('Comentário fixado', card.pinnedComment),
      section('Hashtags', card.hashtags),
      section('Assets', assets),
      section('Etapas', steps)
    ].join('')
    // A script alone stays as it was; with sections, everything goes to HTML.
    const body = extras ? `${toEditorHtml(card.notes ?? '')}${extras}` : (card.notes ?? '')

    created.push({
      id: crypto.randomUUID(),
      title: card.title.trim() || 'Sem título',
      body,
      topics: [...ids],
      fromCardId: card.id,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt
    })
  }
  return { notes: created, topics: nextTopics }
}

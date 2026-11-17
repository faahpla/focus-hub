import type { Board, BoardCard } from '@shared/types'
import { toEditorHtml, toPlainText } from '@/lib/rich-text'
import { uid } from '@/lib/utils'
import { isCardCancelled } from './board-templates'
import { searchable } from './card-flow'

/**
 * TikTok compilations: one card that joins 2–3 short cards of its board.
 *
 * A short knows it was used by being listed in a compilation's `parts` —
 * nothing is written on the short itself, so there is no mark to keep in
 * step and taking a part out of a compilation frees it on its own.
 */

export const NO_ANIME = 'Sem anime'

export const isCompilation = (card: BoardCard): boolean => card.kind === 'compilation'

/** The compilation a short was used in, if any. */
export function compilationOf(card: BoardCard, cards: BoardCard[]): BoardCard | undefined {
  return cards.find(
    (c) => c.kind === 'compilation' && c.boardId === card.boardId && c.parts?.includes(card.id)
  )
}

/** A compilation's parts as cards, in order; parts deleted since are skipped. */
export function partsOf(compilation: BoardCard, cards: BoardCard[]): BoardCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]))
  return (compilation.parts ?? []).flatMap((id) => {
    const part = byId.get(id)
    return part ? [part] : []
  })
}

/** Text squeezed for matching a name in a title: "Mushoku Tensei" ≈ "#MushokuTensei". */
const squash = (text: string): string => searchable(text).replace(/[^a-z0-9]/g, '')

/**
 * Which anime a short is about, learnt from the board it is on.
 *
 * The candidates are the card's tags and any of the board's tags its title
 * mentions; the one the board uses most wins. Tags also name people ("Ajk",
 * "Faah"), and the first tag was often one of those — but an anime tag is on
 * far more cards than a person's, so frequency picks the anime. Titles fill
 * in the cards with no tag at all: "#MushokuTensei", "…em Cyberpunk".
 */
export function animeIndex(cards: BoardCard[]): (card: BoardCard) => string {
  const uses = new Map<string, number>()
  for (const card of cards) {
    for (const tag of card.tags) {
      const name = tag.trim()
      if (name) uses.set(name, (uses.get(name) ?? 0) + 1)
    }
  }
  // Only names used on a few cards count when found in a title.
  const known = [...uses.entries()]
    .filter(([name, n]) => n >= 2 && squash(name).length >= 3)
    .map(([name]) => ({ name, key: squash(name) }))

  return (card) => {
    const title = squash(card.title)
    const candidates = new Set([
      ...card.tags.map((t) => t.trim()).filter(Boolean),
      ...known.filter((k) => title.includes(k.key)).map((k) => k.name)
    ])
    let best = NO_ANIME
    let bestUses = 0
    for (const name of candidates) {
      const n = uses.get(name) ?? 0
      if (n > bestUses) {
        best = name
        bestUses = n
      }
    }
    return best
  }
}

/**
 * The shorts of a board that no compilation uses yet — the shelf to build
 * from. Dropped cards stay out; every other stage is fair game.
 */
export function freeShorts(board: Board, cards: BoardCard[]): BoardCard[] {
  const used = new Set(
    cards
      .filter((c) => c.boardId === board.id && c.kind === 'compilation')
      .flatMap((c) => c.parts ?? [])
  )
  return cards.filter(
    (c) =>
      c.boardId === board.id &&
      c.kind !== 'compilation' &&
      !used.has(c.id) &&
      !isCardCancelled(c, board.columns)
  )
}

/**
 * Shorts grouped by anime, newest first everywhere: each group's cards by
 * when they were created, and the groups by their newest card — so the
 * anime being worked on now comes on top, not the one with most cards.
 * (createdAt, not updatedAt: the sync rewrites updatedAt on every pull.)
 */
export function groupByAnime(
  cards: BoardCard[],
  animeOf: (card: BoardCard) => string
): { anime: string; cards: BoardCard[] }[] {
  const groups = new Map<string, BoardCard[]>()
  for (const card of cards) {
    const anime = animeOf(card)
    groups.set(anime, [...(groups.get(anime) ?? []), card])
  }
  return [...groups.entries()]
    .map(([anime, list]) => ({
      anime,
      cards: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }))
    .sort(
      (a, b) =>
        Number(a.anime === NO_ANIME) - Number(b.anime === NO_ANIME) ||
        b.cards[0].createdAt.localeCompare(a.cards[0].createdAt)
    )
}

/**
 * The compilation's whole script, ready to read or record: the hook, each
 * part's script under its title, and the closing. Built fresh from the parts
 * every time, so editing a short shows up here without copying anything.
 */
export function assembledScript(compilation: BoardCard, cards: BoardCard[]): string {
  const parts = partsOf(compilation, cards)
  const block = (heading: string, value: string | undefined): string =>
    value && toPlainText(value).trim() ? `<h2>${heading}</h2>${toEditorHtml(value)}` : ''
  return [
    block('Gancho', compilation.hook),
    ...parts.map((part, i) =>
      block(`Parte ${i + 1} — ${escapeHtml(part.title)}`, part.notes || '<p><em>Sem roteiro ainda.</em></p>')
    ),
    block('Fechamento', compilation.outro)
  ].join('')
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Words in a piece of text, formatted or not. */
export function wordCount(value: string | undefined): number {
  const plain = toPlainText(value ?? '').trim()
  return plain ? plain.split(/\s+/).length : 0
}

/**
 * A new compilation on the board from the chosen shorts, in the board's
 * first column still in progress. Named after the anime when all the parts
 * share one, and tagged with the parts' animes so it groups with them.
 */
export function newCompilation(board: Board, parts: BoardCard[], cards: BoardCard[]): BoardCard {
  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  const column = columns.find((c) => !c.done && !c.cancelled) ?? columns[0]
  const animeOf = animeIndex(cards.filter((c) => c.boardId === board.id))
  const animes = [...new Set(parts.map(animeOf))].filter((a) => a !== NO_ANIME)
  const stamp = new Date().toISOString()
  return {
    id: uid(),
    boardId: board.id,
    columnId: column.id,
    kind: 'compilation',
    parts: parts.map((p) => p.id),
    title: animes.length === 1 ? `TikTok · ${animes[0]}` : 'TikTok · Compilado',
    tags: animes,
    assets: [],
    createdAt: stamp,
    updatedAt: stamp,
    order: cards.filter((c) => c.columnId === column.id).length
  }
}

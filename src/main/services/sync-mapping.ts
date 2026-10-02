import type { Board, BoardCard, BoardColumn } from '../../shared/types'
import type { SharePermissions } from '../../shared/sync'

/**
 * Translating between a card on this PC and its row in the cloud, and working
 * out what changed between two versions of one. No I/O here — every function
 * is pure, so the rules that decide what gets sent can be checked on their own.
 */

/** A card as the cloud stores it: its place in real columns, the rest in `data`. */
export interface CardRow {
  id: string
  board_id: string
  column_id: string
  sort_order: number
  data: Record<string, unknown>
  updated_at?: string
  updated_by?: string | null
}

export interface BoardRow {
  id: string
  owner_id: string
  name: string
  icon: string
  color: string
  description: string | null
  columns: BoardColumn[]
  created_at: string
  updated_at: string
}

export interface MemberRow {
  board_id: string
  user_id: string
  email: string
  role: 'editor' | 'custom'
  can_create_cards: boolean
  can_delete_cards: boolean
  can_manage_columns: boolean
}

/**
 * Only what changed in a card. `set` is merged into the cloud copy key by key
 * and `unset` drops keys the app cleared, so a patch never carries a field
 * nobody touched — that is what lets two people edit one card at once.
 */
export interface CardPatch {
  set: Record<string, unknown>
  unset: string[]
  column?: string
  order?: number
  board?: string
}

/** The card's place, not its content: these have columns of their own. */
const PLACE_KEYS = new Set(['id', 'boardId', 'columnId', 'order', 'updatedAt'])

/**
 * JSON with object keys in a fixed order, for telling whether two values are
 * the same. Postgres stores jsonb with its keys reordered, so a checklist item
 * written as {id, label, done} comes back as {id, done, label}. Compared with
 * plain JSON.stringify the two differ, and a card that came down from the
 * cloud would look edited — sending this PC's whole checklist back over a box
 * the other person had just ticked.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

export function cardToRow(card: BoardCard): CardRow {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(card)) {
    if (!PLACE_KEYS.has(key) && value !== undefined) data[key] = value
  }
  return {
    id: card.id,
    board_id: card.boardId,
    column_id: card.columnId,
    sort_order: card.order,
    data
  }
}

export function rowToCard(row: CardRow): BoardCard {
  const data = (row.data ?? {}) as Partial<BoardCard>
  const stamp = row.updated_at ?? new Date().toISOString()
  return {
    ...data,
    // Every card has these, whatever an older copy of the app wrote.
    title: typeof data.title === 'string' ? data.title : '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    assets: Array.isArray(data.assets) ? data.assets : [],
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : stamp,
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    order: row.sort_order,
    updatedAt: stamp
  }
}

export function diffCard(before: BoardCard, after: BoardCard): CardPatch | null {
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  const a = before as unknown as Record<string, unknown>
  const b = after as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (PLACE_KEYS.has(key)) continue
    if (b[key] === undefined) {
      if (a[key] !== undefined) unset.push(key)
    } else if (!sameValue(a[key], b[key])) {
      set[key] = b[key]
    }
  }
  const patch: CardPatch = { set, unset }
  if (before.columnId !== after.columnId) patch.column = after.columnId
  if (before.order !== after.order) patch.order = after.order
  if (before.boardId !== after.boardId) patch.board = after.boardId
  return isEmptyPatch(patch) ? null : patch
}

export function isEmptyPatch(patch: CardPatch): boolean {
  return (
    Object.keys(patch.set).length === 0 &&
    patch.unset.length === 0 &&
    patch.column === undefined &&
    patch.order === undefined &&
    patch.board === undefined
  )
}

/**
 * Fold a newer patch into an older one still waiting to be sent. Autosave
 * fires every few hundred milliseconds while typing; without this the queue
 * would hold one entry per pause instead of one per card.
 */
export function mergePatch(older: CardPatch, newer: CardPatch): CardPatch {
  const set = { ...older.set }
  const unset = new Set(older.unset)
  for (const key of newer.unset) {
    delete set[key]
    unset.add(key)
  }
  for (const [key, value] of Object.entries(newer.set)) {
    set[key] = value
    unset.delete(key)
  }
  return {
    set,
    unset: [...unset],
    column: newer.column ?? older.column,
    order: newer.order ?? older.order,
    board: newer.board ?? older.board
  }
}

/**
 * Lay an unsent patch over a card that just arrived from the cloud. The local
 * edit wins field by field: it is newer than anything the cloud has seen.
 */
export function applyPatch(card: BoardCard, patch: CardPatch): BoardCard {
  const next: Record<string, unknown> = { ...card, ...patch.set }
  for (const key of patch.unset) delete next[key]
  if (patch.column !== undefined) next.columnId = patch.column
  if (patch.order !== undefined) next.order = patch.order
  if (patch.board !== undefined) next.boardId = patch.board
  return next as unknown as BoardCard
}

/** The parts of a board the cloud keeps. Order, archiving and project stay local. */
export function boardFields(board: Board): Pick<BoardRow, 'name' | 'icon' | 'color' | 'description' | 'columns'> {
  return {
    name: board.name,
    icon: board.icon,
    color: board.color,
    description: board.description ?? null,
    columns: board.columns
  }
}

export function permissionsOf(row: Pick<MemberRow, 'can_create_cards' | 'can_delete_cards' | 'can_manage_columns'>): SharePermissions {
  return {
    createCards: row.can_create_cards,
    deleteCards: row.can_delete_cards,
    manageColumns: row.can_manage_columns
  }
}

import { readFileSync, writeFileSync } from 'node:fs'
import type { BoardColumn } from '../../shared/types'
import {
  applyPatch,
  cardToRow,
  mergePatch,
  rowToCard,
  type BoardFields,
  type CardPatch,
  type CardRow
} from './sync-mapping'

export type SyncOp =
  | { kind: 'card-insert'; row: CardRow }
  | { kind: 'card-patch'; id: string; patch: CardPatch }
  | { kind: 'card-delete'; id: string }
  | {
      kind: 'board-update'
      id: string
      fields: BoardFields
    }
  | { kind: 'board-columns'; id: string; columns: BoardColumn[] }
  | { kind: 'board-delete'; id: string }
  | { kind: 'board-leave'; id: string }

/** What this PC still owes the cloud, per card. */
export interface PendingCards {
  inserts: Map<string, CardRow>
  patches: Map<string, CardPatch>
  deletes: Set<string>
}

const cardIdOf = (op: SyncOp): string | undefined =>
  op.kind === 'card-insert'
    ? op.row.id
    : op.kind === 'card-patch' || op.kind === 'card-delete'
      ? op.id
      : undefined

/**
 * Changes made on this PC that have not reached the cloud yet.
 *
 * Kept on disk, so a closed app or a dropped connection loses nothing, and
 * sent strictly in order. New changes fold into ones still waiting for the
 * same card, so the queue holds one entry per card rather than one per
 * autosave tick.
 */
export class Outbox {
  private ops: SyncOp[]
  /** The op whose request is out right now. Never folded into: it already left. */
  private sending: SyncOp | null = null

  constructor(private readonly path: string) {
    this.ops = this.load()
  }

  get size(): number {
    return this.ops.length
  }

  peek(): SyncOp | undefined {
    return this.ops[0]
  }

  begin(op: SyncOp): void {
    this.sending = op
  }

  /** The op reached the cloud, or the cloud refused it for good: forget it. */
  done(op: SyncOp): void {
    this.ops = this.ops.filter((o) => o !== op)
    if (this.sending === op) this.sending = null
    this.save()
  }

  /**
   * The op did not get through and stays at the head for a retry. Folding
   * into it again is safe: every op is idempotent — a re-sent insert is an
   * upsert, a re-sent patch sets the same keys.
   */
  release(op: SyncOp): void {
    if (this.sending === op) this.sending = null
  }

  push(op: SyncOp): void {
    switch (op.kind) {
      case 'card-patch': {
        const waiting = this.latestFor(op.id)
        if (waiting?.kind === 'card-insert') {
          // Never sent yet: fold the change into the card it will create.
          waiting.row = cardToRow(applyPatch(rowToCard(waiting.row), op.patch))
        } else if (waiting?.kind === 'card-patch') {
          waiting.patch = mergePatch(waiting.patch, op.patch)
        } else if (waiting?.kind !== 'card-delete') {
          this.ops.push(op)
        }
        break
      }
      case 'card-delete': {
        const waiting = this.latestFor(op.id)
        if (waiting?.kind === 'card-delete') break
        if (waiting?.kind === 'card-insert') {
          // Created here and never sent: the cloud never knew it existed.
          this.ops = this.ops.filter((o) => o !== waiting)
          break
        }
        // Edits still queued for it would only land on a deleted row.
        this.ops = this.ops.filter(
          (o) => o === this.sending || !(o.kind === 'card-patch' && o.id === op.id)
        )
        this.ops.push(op)
        break
      }
      case 'board-update':
      case 'board-columns': {
        const same = this.ops.find(
          (o) => o !== this.sending && o.kind === op.kind && o.id === op.id
        )
        if (same) Object.assign(same, op)
        else this.ops.push(op)
        break
      }
      default:
        this.ops.push(op)
    }
    this.save()
  }

  /** A delete or a leave is waiting for this board: it is on its way out. */
  isBoardGoing(boardId: string): boolean {
    return this.ops.some(
      (o) => (o.kind === 'board-delete' || o.kind === 'board-leave') && o.id === boardId
    )
  }

  /**
   * An edit to this board's name, look or columns is still waiting. While it
   * is, the cloud's copy of those fields is older than this PC's and must not
   * be laid over it.
   */
  hasBoardEdit(boardId: string): boolean {
    return this.ops.some(
      (o) => (o.kind === 'board-update' || o.kind === 'board-columns') && o.id === boardId
    )
  }

  /** Forget everything queued for a board that is leaving the cloud. */
  dropBoard(boardId: string, cardIds: Set<string>): void {
    this.ops = this.ops.filter((o) => {
      if (o === this.sending) return true
      const card = cardIdOf(o)
      if (card !== undefined) return !cardIds.has(card)
      return !('id' in o && o.id === boardId)
    })
    this.save()
  }

  /** Replayed in order, so a delete followed by a re-insert ends as an insert. */
  pendingCards(): PendingCards {
    const inserts = new Map<string, CardRow>()
    const patches = new Map<string, CardPatch>()
    const deletes = new Set<string>()
    for (const op of this.ops) {
      if (op.kind === 'card-insert') {
        inserts.set(op.row.id, op.row)
        deletes.delete(op.row.id)
      } else if (op.kind === 'card-patch') {
        const earlier = patches.get(op.id)
        patches.set(op.id, earlier ? mergePatch(earlier, op.patch) : op.patch)
      } else if (op.kind === 'card-delete') {
        deletes.add(op.id)
        inserts.delete(op.id)
        patches.delete(op.id)
      }
    }
    return { inserts, patches, deletes }
  }

  /** The newest op for a card that can still be changed, if any. */
  private latestFor(cardId: string): SyncOp | undefined {
    for (let i = this.ops.length - 1; i >= 0; i--) {
      const op = this.ops[i]
      if (cardIdOf(op) !== cardId) continue
      // Already on its way: a new change has to follow it, not join it.
      return op === this.sending ? undefined : op
    }
    return undefined
  }

  private load(): SyncOp[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      return Array.isArray(parsed) ? (parsed as SyncOp[]) : []
    } catch {
      return []
    }
  }

  private save(): void {
    try {
      writeFileSync(this.path, JSON.stringify(this.ops), 'utf8')
    } catch {
      /* the next save writes the whole queue again */
    }
  }
}

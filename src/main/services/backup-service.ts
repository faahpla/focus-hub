import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppData, BackupInfo } from '../../shared/types'

const KEEP = 40
const PREFIX = 'focus-hub-'

interface BackupFile {
  savedAt: string
  reason: string
  data: AppData
}

/** The lists a whole document always carries — how we recognise one. */
const DOCUMENT_LISTS = ['projects', 'tasks', 'ideas', 'boards', 'cards', 'sessions'] as const

export type ParsedBackup =
  | { ok: true; data: AppData }
  | { ok: false; reason: 'invalid-json' | 'not-a-backup' }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const looksLikeDocument = (v: Record<string, unknown>): boolean =>
  DOCUMENT_LISTS.filter((k) => Array.isArray(v[k])).length >= 3

/** Peel envelopes until the document itself shows up. */
function unwrap(value: unknown, depth = 0): AppData | null {
  if (!isRecord(value)) return null
  if (looksLikeDocument(value)) return value as unknown as AppData
  if (depth < 4) return unwrap(value.data, depth + 1)
  return null
}

/**
 * Read a backup file the user picked, whatever shape it arrived in.
 *
 * Three shapes are legitimately out there: the bare document (what Exportar
 * writes), a snapshot `{ savedAt, reason, data }`, and the live store file
 * `{ data }`. A file that passed through other tools also picks up a UTF-8
 * BOM, and `JSON.parse` rejects that outright.
 *
 * Refusing a JSON that holds no document matters as much as accepting the
 * others: importing an envelope used to store the envelope itself, leaving the
 * app reading empty lists with the real data stranded one level down.
 */
export function parseBackupDocument(raw: string): ParsedBackup {
  let parsed: unknown
  try {
    // A BOM is a real character to JSON.parse, and it rejects the file.
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  const data = unwrap(parsed)
  return data ? { ok: true, data } : { ok: false, reason: 'not-a-backup' }
}

/**
 * Rolling local snapshots of the whole document.
 *
 * The live file is a single JSON that every mutation rewrites, so one bad
 * delete — by the app, by a mistake, or by a hand editing it — is permanent.
 * These snapshots give a way back. They are written on startup, periodically,
 * and always *before* anything destructive.
 */
export class BackupService {
  private readonly dir: string
  private lastSerialized = ''

  constructor(userDataDir: string) {
    this.dir = join(userDataDir, 'backups')
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true })
  }

  /** Write a snapshot unless the document is byte-identical to the last one. */
  snapshot(data: AppData, reason: string, force = false): void {
    try {
      const serialized = JSON.stringify(data)
      if (!force && serialized === this.lastSerialized) return
      this.lastSerialized = serialized

      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const payload: BackupFile = { savedAt: new Date().toISOString(), reason, data }
      writeFileSync(join(this.dir, `${PREFIX}${stamp}.json`), JSON.stringify(payload), 'utf8')
      this.prune()
    } catch {
      /* a failed backup must never break the app */
    }
  }

  private prune(): void {
    const files = this.files()
    for (const file of files.slice(KEEP)) {
      try {
        unlinkSync(join(this.dir, file))
      } catch {
        /* ignore */
      }
    }
  }

  /** Newest first. */
  private files(): string[] {
    try {
      return readdirSync(this.dir)
        .filter((f) => f.startsWith(PREFIX) && f.endsWith('.json'))
        .sort()
        .reverse()
    } catch {
      return []
    }
  }

  list(): BackupInfo[] {
    const out: BackupInfo[] = []
    for (const file of this.files()) {
      const parsed = this.readFile(file)
      if (!parsed) continue
      out.push({
        file,
        savedAt: parsed.savedAt,
        reason: parsed.reason,
        boards: parsed.data.boards?.length ?? 0,
        cards: parsed.data.cards?.length ?? 0,
        tasks: parsed.data.tasks?.length ?? 0,
        ideas: parsed.data.ideas?.length ?? 0,
        transactions: parsed.data.finance?.transactions?.length ?? 0
      })
    }
    return out
  }

  private readFile(file: string): BackupFile | null {
    try {
      return JSON.parse(readFileSync(join(this.dir, file), 'utf8')) as BackupFile
    } catch {
      return null
    }
  }

  /** The document stored in a snapshot, or null if it can't be read. */
  restore(file: string): AppData | null {
    // Never let a crafted name escape the backups folder.
    if (!file.startsWith(PREFIX) || file.includes('/') || file.includes('\\')) return null
    return this.readFile(file)?.data ?? null
  }

  get folder(): string {
    return this.dir
  }
}

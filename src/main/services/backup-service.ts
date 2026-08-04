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

import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  AppData,
  Board,
  BoardCard,
  CardAttachment,
  FlowConfig,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from '../../shared/types'
import type {
  BudgetPlan,
  FinanceEntity,
  FinanceEntityMap,
  FinanceSettings
} from '../../shared/finance'
import type { PlannerEntity, PlannerEntityMap, PlannerSettings } from '../../shared/planner'
import type { SharePermissions, ShareRole } from '../../shared/sync'
import type { Repository } from '../store/repository'
import type { LocalFile, SyncService } from '../services/sync-service'
import {
  MAX_ATTACHMENT_BYTES,
  fileNameOf,
  folderNameOf,
  sizeLabel
} from '../services/attachment-files'
import type { BackupService } from '../services/backup-service'
import { parseBackupDocument } from '../services/backup-service'
import type { FlowService } from '../services/flow-service'
import type { WindowManager } from '../windows/window-manager'

/** Human-readable names for the "backup taken before…" reason line. */
const FINANCE_LABEL: Record<FinanceEntity, string> = {
  accounts: 'conta',
  cards: 'cartão',
  categories: 'categoria',
  transactions: 'transação',
  recurring: 'recorrência',
  goals: 'meta'
}

const PLANNER_LABEL: Record<PlannerEntity, string> = {
  events: 'compromisso',
  habits: 'hábito',
  plannerGoals: 'meta'
}

/** Quote a CSV cell only when it needs it. */
function escapeCsv(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

interface Deps {
  repo: Repository
  flow: FlowService
  windows: WindowManager
  backups: BackupService
  sync: SyncService
}

export function registerIpc({ repo, flow, windows, backups, sync }: Deps): void {
  const changed = (data: AppData): AppData => {
    windows.broadcast(IPC.EVT_DATA_CHANGED, data)
    return data
  }

  /** Snapshot the document *before* running something that removes data. */
  const guard = <T>(reason: string, run: () => T): T => {
    backups.snapshot(repo.getAll(), reason)
    return run()
  }

  // ---- Data ----
  ipcMain.handle(IPC.DATA_GET_ALL, () => repo.getAll())
  ipcMain.handle(IPC.PROJECTS_SAVE, (_e, p: Project) => changed(repo.saveProject(p)))
  ipcMain.handle(IPC.PROJECTS_DELETE, (_e, id: string) =>
    guard('antes de excluir projeto', () => changed(repo.deleteProject(id)))
  )
  ipcMain.handle(IPC.TASKS_SAVE, (_e, t: Task) => changed(repo.saveTask(t)))
  ipcMain.handle(IPC.TASKS_SAVE_MANY, (_e, tasks: Task[]) => changed(repo.saveTasks(tasks)))
  ipcMain.handle(IPC.TASKS_DELETE, (_e, id: string) =>
    guard('antes de excluir tarefa', () => changed(repo.deleteTask(id)))
  )
  ipcMain.handle(IPC.IDEAS_SAVE, (_e, i: Idea) => changed(repo.saveIdea(i)))
  ipcMain.handle(IPC.IDEAS_DELETE, (_e, id: string) =>
    guard('antes de excluir ideia', () => changed(repo.deleteIdea(id)))
  )
  /*
    Boards and cards also feed the sync. Every write here reads the record as
    it was first: the sync sends only what changed, and a member's role is
    checked against the change before it is applied — a refused write leaves
    the document untouched and hands the screen the unchanged copy back.
  */
  const cardsBefore = (ids: string[]): Map<string, BoardCard> => {
    const wanted = new Set(ids)
    return new Map(
      repo
        .getAll()
        .cards.filter((c) => wanted.has(c.id))
        .map((c) => [c.id, structuredClone(c)])
    )
  }

  const saveCards = (incoming: BoardCard[]): AppData => {
    const ids = incoming.map((c) => c.id)
    const before = cardsBefore(ids)
    const current = repo.getAll()
    for (const card of incoming) {
      const refusal = sync.checkCardWrite(before.get(card.id), card, current)
      if (refusal) {
        sync.refused(refusal)
        return changed(current)
      }
    }
    const data = incoming.length === 1 ? repo.saveCard(incoming[0]) : repo.saveCards(incoming)
    sync.cardsWritten(before, data, ids)
    return changed(data)
  }

  ipcMain.handle(IPC.BOARDS_SAVE, (_e, b: Board) => {
    const before = repo.getAll().boards.find((x) => x.id === b.id)
    // Whether a board is shared is the sync's to decide, never the screen's.
    const incoming: Board = { ...b, shared: before?.shared }
    const refusal = sync.checkBoardWrite(before, incoming)
    if (refusal) {
      sync.refused(refusal)
      return changed(repo.getAll())
    }
    const data = repo.saveBoard(incoming)
    sync.boardWritten(before, incoming)
    return changed(data)
  })
  ipcMain.handle(IPC.BOARDS_DELETE, (_e, id: string) =>
    guard('antes de excluir quadro', () => {
      const current = repo.getAll()
      const board = current.boards.find((x) => x.id === id)
      const cardIds = new Set(current.cards.filter((c) => c.boardId === id).map((c) => c.id))
      const data = repo.deleteBoard(id)
      sync.boardDeleted(board, cardIds)
      return changed(data)
    })
  )
  ipcMain.handle(IPC.CARDS_SAVE, (_e, c: BoardCard) => saveCards([c]))
  ipcMain.handle(IPC.CARDS_SAVE_MANY, (_e, cards: BoardCard[]) => saveCards(cards))
  ipcMain.handle(IPC.CARDS_DELETE, (_e, id: string) => {
    const current = repo.getAll()
    const card = current.cards.find((c) => c.id === id)
    const refusal = sync.checkCardDelete(card, current)
    if (refusal) {
      sync.refused(refusal)
      return changed(current)
    }
    return guard('antes de excluir card', () => {
      const data = repo.deleteCard(id)
      sync.cardDeleted(card, data)
      return changed(data)
    })
  })

  // ---- Shared boards ----
  ipcMain.handle(IPC.SYNC_STATUS, () => sync.status())
  ipcMain.handle(IPC.SYNC_SIGN_UP, (_e, email: string, password: string) =>
    sync.signUp(email, password)
  )
  ipcMain.handle(IPC.SYNC_SIGN_IN, (_e, email: string, password: string) =>
    sync.signIn(email, password)
  )
  ipcMain.handle(IPC.SYNC_SIGN_OUT, () => sync.signOut())
  ipcMain.handle(IPC.SYNC_SHARE_BOARD, (_e, boardId: string) => sync.shareBoard(boardId))
  ipcMain.handle(IPC.SYNC_UNSHARE_BOARD, (_e, boardId: string) => sync.unshareBoard(boardId))
  ipcMain.handle(IPC.SYNC_LEAVE_BOARD, (_e, boardId: string) => sync.leaveBoard(boardId))
  ipcMain.handle(IPC.SYNC_JOIN_BOARD, (_e, code: string) => sync.joinBoard(code))
  ipcMain.handle(
    IPC.SYNC_CREATE_INVITE,
    (_e, boardId: string, role: ShareRole, can: SharePermissions) =>
      sync.createInvite(boardId, role, can)
  )
  ipcMain.handle(IPC.SYNC_LIST_INVITES, (_e, boardId: string) => sync.listInvites(boardId))
  ipcMain.handle(IPC.SYNC_REVOKE_INVITE, (_e, code: string) => sync.revokeInvite(code))
  ipcMain.handle(IPC.SYNC_LIST_MEMBERS, (_e, boardId: string) => sync.listMembers(boardId))
  ipcMain.handle(
    IPC.SYNC_UPDATE_MEMBER,
    (_e, boardId: string, userId: string, role: ShareRole, can: SharePermissions) =>
      sync.updateMember(boardId, userId, role, can)
  )
  ipcMain.handle(IPC.SYNC_REMOVE_MEMBER, (_e, boardId: string, userId: string) =>
    sync.removeMember(boardId, userId)
  )

  // ---- Attachments ----
  /*
    Paths reach this point two ways, and neither is a string the screen made
    up: the file dialog opens here in main, and a drop arrives as the File
    objects of a real drag, turned into paths by the preload. A File built in
    page script has no path, so the screen cannot be made to send an
    arbitrary file from disk.
  */
  const attachPaths = async (
    cardId: string,
    paths: string[]
  ): Promise<{ ok: boolean; error?: string; count?: number }> => {
    const current = repo.getAll()
    const card = current.cards.find((c) => c.id === cardId)
    if (!card) return { ok: false, error: 'Card não encontrado.' }

    const sizes = await Promise.all(paths.map(async (p) => (await fs.stat(p)).size))
    const board = current.boards.find((b) => b.id === card.boardId)
    let added: CardAttachment[]
    if (board?.shared) {
      const files: LocalFile[] = []
      for (const [i, path] of paths.entries()) {
        if (sizes[i] > MAX_ATTACHMENT_BYTES) {
          return {
            ok: false,
            error: `“${basename(path)}” tem ${sizeLabel(sizes[i])}. O limite é 10 MB por arquivo.`
          }
        }
        files.push({ name: basename(path), bytes: await fs.readFile(path) })
      }
      const res = await sync.uploadAttachments(board.id, files)
      if (!res.ok || !res.attachments) return { ok: false, error: res.error }
      added = res.attachments
    } else {
      // Only on this PC: keep where the file is, like before sharing existed.
      const stamp = new Date().toISOString()
      added = paths.map((path, i) => ({
        id: randomUUID(),
        name: basename(path),
        size: sizes[i],
        localPath: path,
        uploadedAt: stamp
      }))
    }

    // Read the card again: an upload takes a moment and the card may have
    // been edited, or deleted, in the meantime.
    const fresh = repo.getAll().cards.find((c) => c.id === cardId)
    if (!fresh) {
      void sync.removeStoredFiles(added.flatMap((a) => (a.storagePath ? [a.storagePath] : [])))
      return { ok: false, error: 'O card foi apagado enquanto os arquivos subiam.' }
    }
    saveCards([{ ...fresh, attachments: [...(fresh.attachments ?? []), ...added] }])
    return { ok: true, count: added.length }
  }

  ipcMain.handle(IPC.ATTACH_FILES, async (_e, cardId: string) => {
    const picked = await dialog.showOpenDialog({
      title: 'Anexar ao card',
      properties: ['openFile', 'multiSelections']
    })
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false }
    return attachPaths(cardId, picked.filePaths)
  })

  ipcMain.handle(IPC.ATTACH_PATHS, async (_e, cardId: string, paths: string[]) => {
    // A drop can carry folders, and a path the preload could not resolve
    // comes through empty. Only real files go on.
    const isFile = await Promise.all(
      paths.map((p) =>
        p
          ? fs
              .stat(p)
              .then((s) => s.isFile())
              .catch(() => false)
          : Promise.resolve(false)
      )
    )
    if (paths.length === 0 || isFile.some((ok) => !ok)) {
      return { ok: false, error: 'Arraste arquivos — pastas não podem ser anexadas.' }
    }
    return attachPaths(cardId, paths)
  })

  /*
    Downloads land in Downloads/Focus HUB/<card title>/ and that folder opens,
    so the files are one drag away from the video editor. A file kept only as
    a path on this PC just opens where it is.
  */
  ipcMain.handle(IPC.DOWNLOAD_ATTACHMENTS, async (_e, cardId: string, attachmentId?: string) => {
    const card = repo.getAll().cards.find((c) => c.id === cardId)
    if (!card) return { ok: false, error: 'Card não encontrado.' }
    const wanted = (card.attachments ?? []).filter((a) => !attachmentId || a.id === attachmentId)
    if (wanted.length === 0) return { ok: false, error: 'Nada para baixar.' }

    if (attachmentId && wanted[0].localPath) {
      const err = await shell.openPath(wanted[0].localPath)
      return err
        ? { ok: false, error: 'Não deu para abrir: o arquivo pode ter sido movido ou apagado.' }
        : { ok: true }
    }

    const folder = join(app.getPath('downloads'), 'Focus HUB', folderNameOf(card.title))
    await fs.mkdir(folder, { recursive: true })
    for (const a of wanted) {
      const target = join(folder, fileNameOf(a.name))
      if (a.storagePath) {
        const res = await sync.downloadAttachment(a.storagePath)
        if (!res.ok || !res.bytes) return { ok: false, error: res.error }
        await fs.writeFile(target, res.bytes)
      } else if (a.localPath) {
        await fs.copyFile(a.localPath, target).catch(() => undefined)
      }
    }
    await shell.openPath(folder)
    return { ok: true, folder }
  })

  ipcMain.handle(IPC.REMOVE_ATTACHMENT, async (_e, cardId: string, attachmentId: string) => {
    const card = repo.getAll().cards.find((c) => c.id === cardId)
    const target = card?.attachments?.find((a) => a.id === attachmentId)
    if (!card || !target) return { ok: false }
    saveCards([
      { ...card, attachments: (card.attachments ?? []).filter((a) => a.id !== attachmentId) }
    ])
    // The card no longer points at it; whatever fails here, the sweep catches.
    if (target.storagePath) void sync.removeStoredFiles([target.storagePath])
    return { ok: true }
  })
  ipcMain.handle(IPC.SESSIONS_RECORD, (_e, s: Session) => changed(repo.recordSession(s)))
  ipcMain.handle(IPC.STATS_SAVE, (_e, s: Stats) => changed(repo.saveStats(s)))
  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, s: Settings) => changed(repo.saveSettings(s)))

  // ---- Backup ----
  ipcMain.handle(IPC.BACKUP_EXPORT, async () => {
    const res = await dialog.showSaveDialog({
      title: 'Exportar dados do Focus HUB',
      defaultPath: `focus-hub-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false }
    await fs.writeFile(res.filePath, JSON.stringify(repo.getAll(), null, 2), 'utf8')
    return { ok: true, path: res.filePath }
  })

  ipcMain.handle(IPC.BACKUP_IMPORT, async () => {
    const res = await dialog.showOpenDialog({
      title: 'Importar dados do Focus HUB',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return { ok: false }

    let raw: string
    try {
      raw = await fs.readFile(res.filePaths[0], 'utf8')
    } catch {
      return { ok: false, error: 'Não foi possível ler o arquivo.' }
    }

    // Every failure here used to return a bare `ok: false` that the screen
    // ignored, so a refused import looked exactly like nothing happening.
    const parsed = parseBackupDocument(raw)
    if (!parsed.ok) {
      return {
        ok: false,
        error:
          parsed.reason === 'invalid-json'
            ? 'O arquivo não é um JSON válido.'
            : 'O arquivo é um JSON, mas não tem dados do Focus HUB dentro.'
      }
    }

    backups.snapshot(repo.getAll(), 'antes de importar backup')
    const saved = repo.replaceAll(parsed.data)
    changed(saved)
    return { ok: true, data: saved }
  })

  // ---- Automatic snapshots ----
  ipcMain.handle(IPC.BACKUPS_LIST, () => backups.list())
  ipcMain.handle(IPC.BACKUPS_RESTORE, (_e, file: string) => {
    const data = backups.restore(file)
    if (!data) return { ok: false }
    // Snapshot the current state too, so restoring is itself undoable.
    backups.snapshot(repo.getAll(), 'antes de restaurar backup', true)
    const saved = repo.replaceAll(data)
    changed(saved)
    return { ok: true, data: saved }
  })
  ipcMain.on(IPC.BACKUPS_OPEN_DIR, () => void shell.openPath(backups.folder))

  // ---- Finance HUB ----
  ipcMain.handle(
    IPC.FINANCE_SAVE,
    <K extends FinanceEntity>(_e: unknown, entity: K, items: FinanceEntityMap[K][]) =>
      changed(repo.saveFinance(entity, items))
  )
  ipcMain.handle(IPC.FINANCE_DELETE, (_e, entity: FinanceEntity, id: string) =>
    guard(`antes de excluir ${FINANCE_LABEL[entity]}`, () => changed(repo.deleteFinance(entity, id)))
  )
  ipcMain.handle(IPC.FINANCE_DELETE_MANY_TX, (_e, ids: string[]) =>
    guard('antes de excluir transações', () => changed(repo.deleteTransactions(ids)))
  )
  ipcMain.handle(IPC.FINANCE_BUDGET_SAVE, (_e, plan: BudgetPlan) => changed(repo.saveBudget(plan)))
  ipcMain.handle(IPC.FINANCE_SETTINGS_SAVE, (_e, s: FinanceSettings) =>
    changed(repo.saveFinanceSettings(s))
  )

  // ---- Focus Planner ----
  ipcMain.handle(
    IPC.PLANNER_SAVE,
    <K extends PlannerEntity>(_e: unknown, entity: K, items: PlannerEntityMap[K][]) =>
      changed(repo.savePlanner(entity, items))
  )
  ipcMain.handle(IPC.PLANNER_DELETE, (_e, entity: PlannerEntity, id: string) =>
    guard(`antes de excluir ${PLANNER_LABEL[entity]}`, () =>
      changed(repo.deletePlanner(entity, id))
    )
  )
  ipcMain.handle(IPC.PLANNER_SETTINGS_SAVE, (_e, s: PlannerSettings) =>
    changed(repo.savePlannerSettings(s))
  )

  ipcMain.handle(IPC.FINANCE_EXPORT_CSV, async (_e, rows: string[][]) => {
    const res = await dialog.showSaveDialog({
      title: 'Exportar transações',
      defaultPath: `financas-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false }
    // Semicolons + BOM so Excel in pt-BR opens it with the columns split.
    const csv = rows.map((row) => row.map(escapeCsv).join(';')).join('\r\n')
    await fs.writeFile(res.filePath, `﻿${csv}`, 'utf8')
    return { ok: true, path: res.filePath }
  })

  // ---- Flow ----
  ipcMain.handle(IPC.FLOW_APPLY, (_e, config: FlowConfig) => flow.apply(config))
  ipcMain.handle(IPC.FLOW_RELEASE, () => flow.release())
  ipcMain.handle(IPC.FLOW_IS_ELEVATED, () => flow.isElevated())
  ipcMain.handle(IPC.PICK_PATH, async (_e, kind: 'file' | 'folder') => {
    const res = await dialog.showOpenDialog({
      properties: [kind === 'folder' ? 'openDirectory' : 'openFile']
    })
    return res.canceled ? null : res.filePaths[0] ?? null
  })

  ipcMain.handle(IPC.OPEN_PATH, async (_e, value: string) => {
    const target = value.trim()
    if (!target) return false
    try {
      if (/^https?:\/\//i.test(target)) {
        await shell.openExternal(target)
        return true
      }
      // shell.openPath resolves to an error string (empty means success).
      const err = await shell.openPath(target)
      return err === ''
    } catch {
      return false
    }
  })

  // ---- Window controls ----
  const fromEvent = (
    e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent
  ): BrowserWindow | null => BrowserWindow.fromWebContents(e.sender)

  ipcMain.on(IPC.WIN_MINIMIZE, (e) => fromEvent(e)?.minimize())
  ipcMain.on(IPC.WIN_MAXIMIZE, (e) => {
    const win = fromEvent(e)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(IPC.WIN_CLOSE, (e) => fromEvent(e)?.close())

  /*
    Screenshot the app from inside the app.

    Windows' own capture tools depend on an overlay that, on some machines,
    never appears while this window has focus — leaving no way to grab a
    picture of it at all. capturePage() asks the renderer for its own pixels,
    so it works regardless of what the desktop is doing.
  */
  ipcMain.handle(IPC.WIN_CAPTURE, async (e) => {
    const win = fromEvent(e)
    if (!win) return null
    try {
      const image = await win.webContents.capturePage()
      clipboard.writeImage(image)
      const dir = join(app.getPath('pictures'), 'Focus HUB')
      await fs.mkdir(dir, { recursive: true })
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const file = join(dir, `focus-hub-${stamp}.png`)
      await fs.writeFile(file, image.toPNG())
      return file
    } catch {
      return null
    }
  })
  ipcMain.on(IPC.WIN_ULTRA, (e, enabled: boolean) => {
    const win = fromEvent(e)
    if (!win) return
    /*
      Fullscreen only — deliberately not alwaysOnTop.

      Fullscreen already gives Ultra Focus what it's for: nothing else on
      screen. Always-on-top added nothing on top of that except a fight with
      the OS, sitting above the Snipping Tool overlay so you couldn't screenshot
      the app while a session was running.
    */
    win.setFullScreen(enabled)
    if (!enabled) win.setAlwaysOnTop(false)
  })

  // ---- Quick capture ----
  ipcMain.handle(IPC.QUICK_CAPTURE_SAVE, (_e, content: string) => {
    const idea: Idea = {
      id: crypto.randomUUID(),
      content,
      createdAt: new Date().toISOString(),
      archived: false
    }
    changed(repo.saveIdea(idea))
  })
  ipcMain.on(IPC.QUICK_CAPTURE_CLOSE, () => windows.closeQuickCapture())
}

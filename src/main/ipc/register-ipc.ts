import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { IPC } from '../../shared/ipc'
import type {
  AppData,
  Board,
  BoardCard,
  FlowConfig,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from '../../shared/types'
import type { Repository } from '../store/repository'
import type { BackupService } from '../services/backup-service'
import type { FlowService } from '../services/flow-service'
import type { WindowManager } from '../windows/window-manager'

interface Deps {
  repo: Repository
  flow: FlowService
  windows: WindowManager
  backups: BackupService
}

export function registerIpc({ repo, flow, windows, backups }: Deps): void {
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
  ipcMain.handle(IPC.BOARDS_SAVE, (_e, b: Board) => changed(repo.saveBoard(b)))
  ipcMain.handle(IPC.BOARDS_DELETE, (_e, id: string) =>
    guard('antes de excluir quadro', () => changed(repo.deleteBoard(id)))
  )
  ipcMain.handle(IPC.CARDS_SAVE, (_e, c: BoardCard) => changed(repo.saveCard(c)))
  ipcMain.handle(IPC.CARDS_SAVE_MANY, (_e, cards: BoardCard[]) => changed(repo.saveCards(cards)))
  ipcMain.handle(IPC.CARDS_DELETE, (_e, id: string) =>
    guard('antes de excluir card', () => changed(repo.deleteCard(id)))
  )
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
    try {
      const raw = await fs.readFile(res.filePaths[0], 'utf8')
      const data = JSON.parse(raw) as AppData
      backups.snapshot(repo.getAll(), 'antes de importar backup')
      const saved = repo.replaceAll(data)
      changed(saved)
      return { ok: true, data: saved }
    } catch {
      return { ok: false }
    }
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
  const fromEvent = (e: Electron.IpcMainEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(e.sender)

  ipcMain.on(IPC.WIN_MINIMIZE, (e) => fromEvent(e)?.minimize())
  ipcMain.on(IPC.WIN_MAXIMIZE, (e) => {
    const win = fromEvent(e)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on(IPC.WIN_CLOSE, (e) => fromEvent(e)?.close())
  ipcMain.on(IPC.WIN_ULTRA, (e, enabled: boolean) => {
    const win = fromEvent(e)
    if (!win) return
    win.setFullScreen(enabled)
    win.setAlwaysOnTop(enabled)
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

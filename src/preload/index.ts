import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { FocusHubApi } from '../shared/ipc'
import type {
  AppData,
  FlowConfig,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from '../shared/types'

const api: FocusHubApi = {
  getAllData: () => ipcRenderer.invoke(IPC.DATA_GET_ALL),
  saveProject: (p: Project) => ipcRenderer.invoke(IPC.PROJECTS_SAVE, p),
  deleteProject: (id: string) => ipcRenderer.invoke(IPC.PROJECTS_DELETE, id),
  saveTask: (t: Task) => ipcRenderer.invoke(IPC.TASKS_SAVE, t),
  saveTasks: (tasks: Task[]) => ipcRenderer.invoke(IPC.TASKS_SAVE_MANY, tasks),
  deleteTask: (id: string) => ipcRenderer.invoke(IPC.TASKS_DELETE, id),
  saveIdea: (i: Idea) => ipcRenderer.invoke(IPC.IDEAS_SAVE, i),
  deleteIdea: (id: string) => ipcRenderer.invoke(IPC.IDEAS_DELETE, id),
  recordSession: (s: Session) => ipcRenderer.invoke(IPC.SESSIONS_RECORD, s),
  saveStats: (s: Stats) => ipcRenderer.invoke(IPC.STATS_SAVE, s),
  saveSettings: (s: Settings) => ipcRenderer.invoke(IPC.SETTINGS_SAVE, s),
  exportBackup: () => ipcRenderer.invoke(IPC.BACKUP_EXPORT),
  importBackup: () => ipcRenderer.invoke(IPC.BACKUP_IMPORT),

  applyFlow: (config: FlowConfig) => ipcRenderer.invoke(IPC.FLOW_APPLY, config),
  releaseFlow: () => ipcRenderer.invoke(IPC.FLOW_RELEASE),
  isElevated: () => ipcRenderer.invoke(IPC.FLOW_IS_ELEVATED),
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_GET_INFO),
  relaunchElevated: () => ipcRenderer.send(IPC.APP_RELAUNCH_ELEVATED),
  pickPath: (kind) => ipcRenderer.invoke(IPC.PICK_PATH, kind),

  minimize: () => ipcRenderer.send(IPC.WIN_MINIMIZE),
  toggleMaximize: () => ipcRenderer.send(IPC.WIN_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WIN_CLOSE),
  setUltraFocus: (enabled: boolean) => ipcRenderer.send(IPC.WIN_ULTRA, enabled),

  saveQuickIdea: (content: string) => ipcRenderer.invoke(IPC.QUICK_CAPTURE_SAVE, content),
  closeQuickCapture: () => ipcRenderer.send(IPC.QUICK_CAPTURE_CLOSE),

  onQuickCaptureOpen: (cb) => subscribe(IPC.EVT_QUICK_CAPTURE_OPEN, () => cb()),
  onTrayNewSession: (cb) => subscribe(IPC.EVT_TRAY_NEW_SESSION, () => cb()),
  onGlobalTogglePause: (cb) => subscribe(IPC.EVT_GLOBAL_TOGGLE_PAUSE, () => cb()),
  onDataChanged: (cb) => subscribe(IPC.EVT_DATA_CHANGED, (_e, data) => cb(data as AppData))
}

function subscribe(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapped = (_e: Electron.IpcRendererEvent, ...args: unknown[]): void =>
    listener(_e, ...args)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('focusHub', api)

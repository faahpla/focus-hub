/**
 * IPC channel contract. Both the preload bridge and the main-process handlers
 * import these names so the two sides can never drift apart.
 */

import type {
  AppData,
  FlowApplyResult,
  FlowConfig,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from './types'

export const IPC = {
  // Data / persistence
  DATA_GET_ALL: 'data:getAll',
  PROJECTS_SAVE: 'projects:save',
  PROJECTS_DELETE: 'projects:delete',
  TASKS_SAVE: 'tasks:save',
  TASKS_SAVE_MANY: 'tasks:saveMany',
  TASKS_DELETE: 'tasks:delete',
  IDEAS_SAVE: 'ideas:save',
  IDEAS_DELETE: 'ideas:delete',
  SESSIONS_RECORD: 'sessions:record',
  STATS_SAVE: 'stats:save',
  SETTINGS_SAVE: 'settings:save',
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',

  // Flow / OS integration
  FLOW_APPLY: 'flow:apply',
  FLOW_RELEASE: 'flow:release',
  FLOW_IS_ELEVATED: 'flow:isElevated',
  APP_GET_INFO: 'app:getInfo',
  APP_RELAUNCH_ELEVATED: 'app:relaunchElevated',
  PICK_PATH: 'os:pickPath',

  // Window controls
  WIN_MINIMIZE: 'win:minimize',
  WIN_MAXIMIZE: 'win:maximize',
  WIN_CLOSE: 'win:close',
  WIN_ULTRA: 'win:ultraFocus',

  // Quick capture (main -> renderer + renderer -> main)
  QUICK_CAPTURE_SAVE: 'quickCapture:save',
  QUICK_CAPTURE_CLOSE: 'quickCapture:close',

  // Events pushed from main -> renderer
  EVT_QUICK_CAPTURE_OPEN: 'evt:quickCaptureOpen',
  EVT_TRAY_NEW_SESSION: 'evt:trayNewSession',
  EVT_GLOBAL_TOGGLE_PAUSE: 'evt:globalTogglePause',
  EVT_DATA_CHANGED: 'evt:dataChanged'
} as const

export interface FocusHubApi {
  getAllData(): Promise<AppData>
  saveProject(project: Project): Promise<AppData>
  deleteProject(id: string): Promise<AppData>
  saveTask(task: Task): Promise<AppData>
  saveTasks(tasks: Task[]): Promise<AppData>
  deleteTask(id: string): Promise<AppData>
  saveIdea(idea: Idea): Promise<AppData>
  deleteIdea(id: string): Promise<AppData>
  recordSession(session: Session): Promise<AppData>
  saveStats(stats: Stats): Promise<AppData>
  saveSettings(settings: Settings): Promise<AppData>
  exportBackup(): Promise<{ ok: boolean; path?: string }>
  importBackup(): Promise<{ ok: boolean; data?: AppData }>

  applyFlow(config: FlowConfig): Promise<FlowApplyResult>
  releaseFlow(): Promise<void>
  isElevated(): Promise<boolean>
  getAppInfo(): Promise<{ isPackaged: boolean; elevated: boolean }>
  relaunchElevated(): void
  pickPath(kind: 'file' | 'folder'): Promise<string | null>

  minimize(): void
  toggleMaximize(): void
  close(): void
  setUltraFocus(enabled: boolean): void

  saveQuickIdea(content: string): Promise<void>
  closeQuickCapture(): void

  onQuickCaptureOpen(cb: () => void): () => void
  onTrayNewSession(cb: () => void): () => void
  onGlobalTogglePause(cb: () => void): () => void
  onDataChanged(cb: (data: AppData) => void): () => void
}

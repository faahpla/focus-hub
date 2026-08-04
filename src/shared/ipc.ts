/**
 * IPC channel contract. Both the preload bridge and the main-process handlers
 * import these names so the two sides can never drift apart.
 */

import type {
  AppData,
  BackupInfo,
  Board,
  BoardCard,
  FlowApplyResult,
  FlowConfig,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task,
  UpdateStatus
} from './types'
import type {
  BudgetPlan,
  FinanceEntity,
  FinanceEntityMap,
  FinanceSettings
} from './finance'
import type { PlannerEntity, PlannerEntityMap, PlannerSettings } from './planner'

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
  BOARDS_SAVE: 'boards:save',
  BOARDS_DELETE: 'boards:delete',
  CARDS_SAVE: 'cards:save',
  CARDS_SAVE_MANY: 'cards:saveMany',
  CARDS_DELETE: 'cards:delete',
  SESSIONS_RECORD: 'sessions:record',
  STATS_SAVE: 'stats:save',
  SETTINGS_SAVE: 'settings:save',
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',
  BACKUPS_LIST: 'backups:list',
  BACKUPS_RESTORE: 'backups:restore',
  BACKUPS_OPEN_DIR: 'backups:openDir',

  // Finance HUB — one generic path per operation, addressed by entity name.
  FINANCE_SAVE: 'finance:save',
  FINANCE_DELETE: 'finance:delete',
  FINANCE_DELETE_MANY_TX: 'finance:deleteTransactions',
  FINANCE_BUDGET_SAVE: 'finance:saveBudget',
  FINANCE_SETTINGS_SAVE: 'finance:saveSettings',
  FINANCE_EXPORT_CSV: 'finance:exportCsv',

  // Focus Planner
  PLANNER_SAVE: 'planner:save',
  PLANNER_DELETE: 'planner:delete',
  PLANNER_SETTINGS_SAVE: 'planner:saveSettings',

  // Flow / OS integration
  FLOW_APPLY: 'flow:apply',
  FLOW_RELEASE: 'flow:release',
  FLOW_IS_ELEVATED: 'flow:isElevated',
  APP_GET_INFO: 'app:getInfo',
  APP_RELAUNCH_ELEVATED: 'app:relaunchElevated',

  // Updates
  UPDATE_GET_STATUS: 'update:getStatus',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  PICK_PATH: 'os:pickPath',
  OPEN_PATH: 'os:openPath',

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
  EVT_DATA_CHANGED: 'evt:dataChanged',
  EVT_UPDATE_STATUS: 'evt:updateStatus'
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
  saveBoard(board: Board): Promise<AppData>
  deleteBoard(id: string): Promise<AppData>
  saveCard(card: BoardCard): Promise<AppData>
  saveCards(cards: BoardCard[]): Promise<AppData>
  deleteCard(id: string): Promise<AppData>
  recordSession(session: Session): Promise<AppData>
  saveStats(stats: Stats): Promise<AppData>
  saveSettings(settings: Settings): Promise<AppData>
  exportBackup(): Promise<{ ok: boolean; path?: string }>
  importBackup(): Promise<{ ok: boolean; data?: AppData }>
  listBackups(): Promise<BackupInfo[]>
  restoreBackup(file: string): Promise<{ ok: boolean; data?: AppData }>
  openBackupsFolder(): void

  /** Upsert one or many rows of a finance collection. */
  saveFinance<K extends FinanceEntity>(
    entity: K,
    items: FinanceEntityMap[K] | FinanceEntityMap[K][]
  ): Promise<AppData>
  deleteFinance(entity: FinanceEntity, id: string): Promise<AppData>
  /** Remove several transactions in one write (a whole installment group). */
  deleteTransactions(ids: string[]): Promise<AppData>
  saveBudget(plan: BudgetPlan): Promise<AppData>
  saveFinanceSettings(settings: FinanceSettings): Promise<AppData>
  /** Write the given rows to a .csv the user picks. */
  exportTransactionsCsv(rows: string[][]): Promise<{ ok: boolean; path?: string }>

  savePlanner<K extends PlannerEntity>(
    entity: K,
    items: PlannerEntityMap[K] | PlannerEntityMap[K][]
  ): Promise<AppData>
  deletePlanner(entity: PlannerEntity, id: string): Promise<AppData>
  savePlannerSettings(settings: PlannerSettings): Promise<AppData>

  applyFlow(config: FlowConfig): Promise<FlowApplyResult>
  releaseFlow(): Promise<void>
  isElevated(): Promise<boolean>
  getAppInfo(): Promise<{ isPackaged: boolean; elevated: boolean; version: string }>
  relaunchElevated(): void

  getUpdateStatus(): Promise<UpdateStatus>
  checkForUpdate(): Promise<UpdateStatus>
  /** Quit and install the downloaded update. */
  installUpdate(): void
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
  pickPath(kind: 'file' | 'folder'): Promise<string | null>
  /** Open a local path in Explorer/default app, or a URL in the browser. */
  openPath(value: string): Promise<boolean>

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

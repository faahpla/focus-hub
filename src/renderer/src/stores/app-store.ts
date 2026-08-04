import { create } from 'zustand'
import type {
  AppData,
  Board,
  BoardCard,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from '@shared/types'
import type {
  BudgetPlan,
  FinanceEntity,
  FinanceEntityMap,
  FinanceSettings
} from '@shared/finance'
import { emptyFinanceData } from '@shared/finance'
import type { PlannerEntity, PlannerEntityMap, PlannerSettings } from '@shared/planner'
import { DEFAULT_PLANNER_SETTINGS } from '@shared/planner'

interface AppState extends AppData {
  loaded: boolean
  init: () => Promise<void>
  hydrate: (data: AppData) => void

  saveProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  saveTask: (task: Task) => Promise<void>
  saveTasks: (tasks: Task[]) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  saveIdea: (idea: Idea) => Promise<void>
  deleteIdea: (id: string) => Promise<void>
  saveBoard: (board: Board) => Promise<void>
  deleteBoard: (id: string) => Promise<void>
  saveCard: (card: BoardCard) => Promise<void>
  saveCards: (cards: BoardCard[]) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  recordSession: (session: Session) => Promise<void>
  saveStats: (stats: Stats) => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>

  saveFinance: <K extends FinanceEntity>(
    entity: K,
    items: FinanceEntityMap[K] | FinanceEntityMap[K][]
  ) => Promise<void>
  deleteFinance: (entity: FinanceEntity, id: string) => Promise<void>
  deleteTransactions: (ids: string[]) => Promise<void>
  saveBudget: (plan: BudgetPlan) => Promise<void>
  saveFinanceSettings: (patch: Partial<FinanceSettings>) => Promise<void>

  savePlanner: <K extends PlannerEntity>(
    entity: K,
    items: PlannerEntityMap[K] | PlannerEntityMap[K][]
  ) => Promise<void>
  deletePlanner: (entity: PlannerEntity, id: string) => Promise<void>
  savePlannerSettings: (patch: Partial<PlannerSettings>) => Promise<void>
}

const EMPTY: AppData = {
  projects: [],
  tasks: [],
  ideas: [],
  boards: [],
  cards: [],
  sessions: [],
  stats: {
    xp: 0,
    level: 1,
    streakDays: 0,
    longestStreakDays: 0,
    totalFocusedSeconds: 0,
    totalSessions: 0,
    longestSessionSeconds: 0,
    days: [],
    achievements: []
  },
  settings: {
    theme: 'dark',
    accentColor: '250 82% 68%',
    fontSans: 'Inter',
    timerFormat: 'mm:ss',
    defaultDurationMinutes: 45,
    defaultSound: 'none',
    masterVolume: 0.6,
    minimizeToTray: true,
    launchOnStartup: false,
    quickCaptureShortcut: 'CommandOrControl+Shift+Space',
    notificationsEnabled: true,
    musicSources: [],
    alwaysElevate: false
  },
  finance: emptyFinanceData(),
  events: [],
  habits: [],
  plannerGoals: [],
  planner: { ...DEFAULT_PLANNER_SETTINGS }
}

export const useAppStore = create<AppState>((set, get) => ({
  ...EMPTY,
  loaded: false,

  init: async () => {
    const data = await window.focusHub.getAllData()
    set({ ...data, loaded: true })
    window.focusHub.onDataChanged((fresh) => set({ ...fresh }))
  },

  hydrate: (data) => set({ ...data }),

  saveProject: async (project) => set({ ...(await window.focusHub.saveProject(project)) }),
  deleteProject: async (id) => set({ ...(await window.focusHub.deleteProject(id)) }),
  saveTask: async (task) => set({ ...(await window.focusHub.saveTask(task)) }),
  saveTasks: async (tasks) => set({ ...(await window.focusHub.saveTasks(tasks)) }),
  deleteTask: async (id) => set({ ...(await window.focusHub.deleteTask(id)) }),
  saveIdea: async (idea) => set({ ...(await window.focusHub.saveIdea(idea)) }),
  deleteIdea: async (id) => set({ ...(await window.focusHub.deleteIdea(id)) }),
  saveBoard: async (board) => set({ ...(await window.focusHub.saveBoard(board)) }),
  deleteBoard: async (id) => set({ ...(await window.focusHub.deleteBoard(id)) }),
  saveCard: async (card) => set({ ...(await window.focusHub.saveCard(card)) }),
  saveCards: async (cards) => set({ ...(await window.focusHub.saveCards(cards)) }),
  deleteCard: async (id) => set({ ...(await window.focusHub.deleteCard(id)) }),
  recordSession: async (session) => set({ ...(await window.focusHub.recordSession(session)) }),
  saveStats: async (stats) => set({ ...(await window.focusHub.saveStats(stats)) }),
  saveSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ ...(await window.focusHub.saveSettings(next)) })
  },

  saveFinance: async (entity, items) =>
    set({ ...(await window.focusHub.saveFinance(entity, items)) }),
  deleteFinance: async (entity, id) =>
    set({ ...(await window.focusHub.deleteFinance(entity, id)) }),
  deleteTransactions: async (ids) =>
    set({ ...(await window.focusHub.deleteTransactions(ids)) }),
  saveBudget: async (plan) => set({ ...(await window.focusHub.saveBudget(plan)) }),
  saveFinanceSettings: async (patch) => {
    const next = { ...get().finance.settings, ...patch }
    set({ ...(await window.focusHub.saveFinanceSettings(next)) })
  },

  savePlanner: async (entity, items) =>
    set({ ...(await window.focusHub.savePlanner(entity, items)) }),
  deletePlanner: async (entity, id) =>
    set({ ...(await window.focusHub.deletePlanner(entity, id)) }),
  savePlannerSettings: async (patch) => {
    const next = { ...get().planner, ...patch }
    set({ ...(await window.focusHub.savePlannerSettings(next)) })
  }
}))

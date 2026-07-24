import { create } from 'zustand'
import type {
  AppData,
  Idea,
  Project,
  Session,
  Settings,
  Stats,
  Task
} from '@shared/types'

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
  recordSession: (session: Session) => Promise<void>
  saveStats: (stats: Stats) => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
}

const EMPTY: AppData = {
  projects: [],
  tasks: [],
  ideas: [],
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
  }
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
  recordSession: async (session) => set({ ...(await window.focusHub.recordSession(session)) }),
  saveStats: async (stats) => set({ ...(await window.focusHub.saveStats(stats)) }),
  saveSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    set({ ...(await window.focusHub.saveSettings(next)) })
  }
}))

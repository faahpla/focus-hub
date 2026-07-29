import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
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
} from '../../shared/types'
import { XP_PER_LEVEL } from '../../shared/types'

const now = (): string => new Date().toISOString()
const today = (): string => new Date().toISOString().slice(0, 10)

const DEFAULT_SETTINGS: Settings = {
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

const DEFAULT_STATS: Stats = {
  xp: 0,
  level: 1,
  streakDays: 0,
  longestStreakDays: 0,
  totalFocusedSeconds: 0,
  totalSessions: 0,
  longestSessionSeconds: 0,
  days: [],
  achievements: [
    { id: 'first-session', title: 'Primeiro Foco', description: 'Complete sua primeira sessão', icon: 'Sparkles' },
    { id: 'hours-10', title: '10 Horas', description: 'Acumule 10 horas de foco', icon: 'Flame' },
    { id: 'hours-50', title: '50 Horas', description: 'Acumule 50 horas de foco', icon: 'Zap' },
    { id: 'hours-100', title: '100 Horas', description: 'Acumule 100 horas de foco', icon: 'Trophy' },
    { id: 'streak-7', title: 'Semana de Ferro', description: '7 dias consecutivos', icon: 'Calendar' },
    { id: 'streak-30', title: 'Mês Impecável', description: '30 dias consecutivos', icon: 'CalendarCheck' },
    { id: 'streak-100', title: 'Lenda do Foco', description: '100 dias consecutivos', icon: 'Crown' }
  ]
}

function seedProjects(): { projects: Project[]; tasks: Task[] } {
  const projectId = randomUUID()
  const project: Project = {
    id: projectId,
    name: 'Dopanimes',
    icon: 'Clapperboard',
    color: '270 80% 66%',
    description: 'Edição de episódios do canal.',
    defaultDurationMinutes: 45,
    defaultSound: 'lofi',
    flow: {
      launchApps: [],
      closeApps: [
        { id: randomUUID(), name: 'Discord', path: 'Discord.exe' },
        { id: randomUUID(), name: 'Steam', path: 'steam.exe' }
      ],
      openResources: [],
      blockSites: ['youtube.com', 'reddit.com', 'x.com', 'twitter.com', 'instagram.com'],
      allowSites: ['docs.google.com'],
      doNotDisturb: true,
      ultraFocus: true
    },
    createdAt: now(),
    updatedAt: now(),
    archived: false,
    order: 0
  }
  const task: Task = {
    id: randomUUID(),
    projectId,
    title: 'Editar Episódio 05',
    description: 'Corte, áudio, color e exportação do episódio 05.',
    checklist: [
      { id: randomUUID(), label: 'Cortar vídeo', done: false },
      { id: randomUUID(), label: 'Organizar mídia', done: false },
      { id: randomUUID(), label: 'Ajustar áudio', done: false },
      { id: randomUUID(), label: 'Zoom', done: false },
      { id: randomUUID(), label: 'Legendas', done: false },
      { id: randomUUID(), label: 'Color', done: false },
      { id: randomUUID(), label: 'Exportar', done: false },
      { id: randomUUID(), label: 'Upload', done: false }
    ],
    priority: 'high',
    status: 'todo',
    estimatedMinutes: 180,
    actualMinutes: 0,
    tags: ['edição', 'vídeo'],
    createdAt: now(),
    updatedAt: now(),
    order: 0
  }
  return { projects: [project], tasks: [task] }
}

function defaultData(): AppData {
  const seed = seedProjects()
  return {
    projects: seed.projects,
    tasks: seed.tasks,
    ideas: [],
    boards: [],
    cards: [],
    sessions: [],
    stats: DEFAULT_STATS,
    settings: DEFAULT_SETTINGS
  }
}

/**
 * Repository — the single gateway to persisted app data. Everything is kept in
 * one electron-store JSON document so backup/restore is trivial. All mutations
 * return the full, fresh AppData so the renderer can replace its cache atomically.
 */
export class Repository {
  private store: Store<{ data: AppData }>

  constructor() {
    this.store = new Store<{ data: AppData }>({
      name: 'focus-hub-data',
      defaults: { data: defaultData() }
    })
    this.migrate()
  }

  /** Fill in any newly-added fields on older saved documents. */
  private migrate(): void {
    const data = this.store.get('data')
    let changed = false
    if (!data.settings) {
      data.settings = DEFAULT_SETTINGS
      changed = true
    } else if (!Array.isArray(data.settings.musicSources)) {
      data.settings.musicSources = DEFAULT_SETTINGS.musicSources
      changed = true
    } else if (data.settings.musicSources.some((s) => s.id === 'seed-lofi-girl')) {
      // The old seed pointed at a live stream that has since ended.
      data.settings.musicSources = data.settings.musicSources.filter(
        (s) => s.id !== 'seed-lofi-girl'
      )
      changed = true
    }
    if (!data.stats) {
      data.stats = DEFAULT_STATS
      changed = true
    } else if (!data.stats.achievements?.length) {
      data.stats.achievements = DEFAULT_STATS.achievements
      changed = true
    }
    for (const key of ['projects', 'tasks', 'ideas', 'boards', 'cards', 'sessions'] as const) {
      if (!Array.isArray(data[key])) {
        ;(data[key] as unknown[]) = []
        changed = true
      }
    }
    // Cards gained `assets` after the first Kanban release.
    for (const card of data.cards) {
      if (!Array.isArray(card.assets)) {
        card.assets = []
        changed = true
      }
      if (!Array.isArray(card.tags)) {
        card.tags = []
        changed = true
      }
    }
    if (changed) this.store.set('data', data)
  }

  getAll(): AppData {
    return this.store.get('data')
  }

  private setAll(data: AppData): AppData {
    this.store.set('data', data)
    return data
  }

  replaceAll(data: AppData): AppData {
    return this.setAll(data)
  }

  saveProject(project: Project): AppData {
    const data = this.getAll()
    const idx = data.projects.findIndex((p) => p.id === project.id)
    project.updatedAt = now()
    if (idx >= 0) data.projects[idx] = project
    else data.projects.push({ ...project, order: data.projects.length })
    return this.setAll(data)
  }

  deleteProject(id: string): AppData {
    const data = this.getAll()
    data.projects = data.projects.filter((p) => p.id !== id)
    const orphanTasks = new Set(data.tasks.filter((t) => t.projectId === id).map((t) => t.id))
    data.tasks = data.tasks.filter((t) => t.projectId !== id)
    // Boards survive a deleted project — they just lose the link, and any card
    // that pointed at one of the removed tasks becomes a plain card again.
    data.boards = data.boards.map((b) =>
      b.projectId === id ? { ...b, projectId: undefined, updatedAt: now() } : b
    )
    data.cards = data.cards.map((c) =>
      c.taskId && orphanTasks.has(c.taskId) ? { ...c, taskId: undefined, updatedAt: now() } : c
    )
    return this.setAll(data)
  }

  saveTask(task: Task): AppData {
    const data = this.getAll()
    const idx = data.tasks.findIndex((t) => t.id === task.id)
    task.updatedAt = now()
    if (idx >= 0) data.tasks[idx] = task
    else data.tasks.push({ ...task, order: data.tasks.length })
    return this.setAll(data)
  }

  /** Upsert several tasks at once (used for drag-and-drop reordering). */
  saveTasks(tasks: Task[]): AppData {
    const data = this.getAll()
    const byId = new Map(data.tasks.map((t) => [t.id, t]))
    for (const task of tasks) byId.set(task.id, { ...task, updatedAt: now() })
    data.tasks = Array.from(byId.values())
    return this.setAll(data)
  }

  deleteTask(id: string): AppData {
    const data = this.getAll()
    data.tasks = data.tasks.filter((t) => t.id !== id)
    // Any card that mirrored this task falls back to being a plain card.
    data.cards = data.cards.map((c) =>
      c.taskId === id ? { ...c, taskId: undefined, updatedAt: now() } : c
    )
    return this.setAll(data)
  }

  saveBoard(board: Board): AppData {
    const data = this.getAll()
    const idx = data.boards.findIndex((b) => b.id === board.id)
    board.updatedAt = now()
    if (idx >= 0) data.boards[idx] = board
    else data.boards.push({ ...board, order: data.boards.length })
    return this.setAll(data)
  }

  deleteBoard(id: string): AppData {
    const data = this.getAll()
    data.boards = data.boards.filter((b) => b.id !== id)
    // Cards belong to their board; linked tasks are intentionally kept.
    data.cards = data.cards.filter((c) => c.boardId !== id)
    return this.setAll(data)
  }

  saveCard(card: BoardCard): AppData {
    const data = this.getAll()
    const idx = data.cards.findIndex((c) => c.id === card.id)
    card.updatedAt = now()
    if (idx >= 0) data.cards[idx] = card
    else data.cards.push(card)
    return this.setAll(data)
  }

  /** Upsert several cards at once (used when dragging between columns). */
  saveCards(cards: BoardCard[]): AppData {
    const data = this.getAll()
    const byId = new Map(data.cards.map((c) => [c.id, c]))
    for (const card of cards) byId.set(card.id, { ...card, updatedAt: now() })
    data.cards = Array.from(byId.values())
    return this.setAll(data)
  }

  deleteCard(id: string): AppData {
    const data = this.getAll()
    data.cards = data.cards.filter((c) => c.id !== id)
    return this.setAll(data)
  }

  saveIdea(idea: Idea): AppData {
    const data = this.getAll()
    const idx = data.ideas.findIndex((i) => i.id === idea.id)
    if (idx >= 0) data.ideas[idx] = idea
    else data.ideas.unshift(idea)
    return this.setAll(data)
  }

  deleteIdea(id: string): AppData {
    const data = this.getAll()
    data.ideas = data.ideas.filter((i) => i.id !== id)
    return this.setAll(data)
  }

  saveStats(stats: Stats): AppData {
    const data = this.getAll()
    data.stats = stats
    return this.setAll(data)
  }

  saveSettings(settings: Settings): AppData {
    const data = this.getAll()
    data.settings = settings
    return this.setAll(data)
  }

  /**
   * Record a finished session and update aggregate stats, XP, level, streak,
   * daily heatmap buckets and achievement unlocks in one pass.
   */
  recordSession(session: Session): AppData {
    const data = this.getAll()
    data.sessions.unshift(session)

    const stats = data.stats
    stats.totalSessions += 1
    stats.totalFocusedSeconds += session.focusedSeconds
    stats.longestSessionSeconds = Math.max(stats.longestSessionSeconds, session.focusedSeconds)

    // XP: 1 xp per focused minute, +50 bonus if the full session completed.
    const gainedXp = Math.round(session.focusedSeconds / 60) + (session.completed ? 50 : 0)
    stats.xp += gainedXp
    stats.level = Math.max(1, Math.floor(stats.xp / XP_PER_LEVEL) + 1)

    // Daily heatmap bucket.
    const day = session.startedAt.slice(0, 10)
    const bucket = stats.days.find((d) => d.date === day)
    if (bucket) {
      bucket.focusedSeconds += session.focusedSeconds
      bucket.sessions += 1
    } else {
      stats.days.push({ date: day, focusedSeconds: session.focusedSeconds, sessions: 1 })
    }

    // Streak.
    const t = today()
    if (stats.lastActiveDate !== t) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      stats.streakDays = stats.lastActiveDate === yesterday ? stats.streakDays + 1 : 1
      stats.lastActiveDate = t
      stats.longestStreakDays = Math.max(stats.longestStreakDays, stats.streakDays)
    }

    this.unlockAchievements(stats)
    return this.setAll(data)
  }

  private unlockAchievements(stats: Stats): void {
    const hours = stats.totalFocusedSeconds / 3600
    const unlock = (id: string, cond: boolean): void => {
      const a = stats.achievements.find((x) => x.id === id)
      if (a && !a.unlockedAt && cond) a.unlockedAt = now()
    }
    unlock('first-session', stats.totalSessions >= 1)
    unlock('hours-10', hours >= 10)
    unlock('hours-50', hours >= 50)
    unlock('hours-100', hours >= 100)
    unlock('streak-7', stats.streakDays >= 7)
    unlock('streak-30', stats.streakDays >= 30)
    unlock('streak-100', stats.streakDays >= 100)
  }
}

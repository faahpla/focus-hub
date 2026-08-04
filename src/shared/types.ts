/**
 * Focus HUB — Domain types shared between the Electron main process and the
 * React renderer. This is the single source of truth for the data contract.
 */

import type { FinanceData } from './finance'
import type { CalendarEvent, Habit, PlannerGoal, PlannerSettings } from './planner'

export type ID = string

export type ThemeName = 'dark' | 'oled' | 'graphite' | 'midnight'

export type AmbientSound =
  | 'none'
  | 'rain'
  | 'cafe'
  | 'forest'
  | 'white-noise'
  | 'lofi'
  | 'brown-noise'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskStatus = 'todo' | 'in-progress' | 'done'

export interface ChecklistItem {
  id: ID
  label: string
  done: boolean
}

/** How much gas a task needs — the scheduler puts heavy work early. */
export type TaskEnergy = 'low' | 'medium' | 'high'

export interface Task {
  id: ID
  /** Optional: a task can live in the inbox, or belong to a card instead. */
  projectId?: ID
  title: string
  description?: string
  checklist: ChecklistItem[]
  priority: Priority
  status: TaskStatus
  estimatedMinutes?: number
  actualMinutes: number
  tags: string[]
  dueDate?: string // ISO

  // --- Scheduling ---------------------------------------------------------
  // Deliberately separate from `status`: *what state the work is in* and
  // *when you plan to do it* are different questions. Dragging a task to
  // another day must never silently mark it as started.
  /** YYYY-MM-DD — the day you intend to do it. */
  scheduledDate?: string
  /** HH:mm — set only when it occupies a real block on the calendar. */
  startTime?: string
  /** Length of the block. Falls back to `estimatedMinutes`, then the default. */
  durationMinutes?: number
  /** True once the user placed it by hand, so auto-planning leaves it alone. */
  pinned?: boolean
  energy?: TaskEnergy

  // --- Relationships ------------------------------------------------------
  /** Tasks that must be done first. Cycles are rejected on save. */
  blockedBy?: ID[]
  /** The board card this task helps deliver (a video, an article…). */
  cardId?: ID
  /** Production goal this task feeds when completed. */
  goalId?: ID
  /** Expected cost in cents — shows as *committed* against a project budget. */
  expectedCost?: number
  /** When it was marked done, for stats and goal progress. */
  completedAt?: string

  createdAt: string
  updatedAt: string
  order: number
}

/** A program that Flow mode can launch or close (by executable name / path). */
export interface FlowApp {
  id: ID
  name: string
  /** Full path OR executable name (e.g. "Discord.exe"). */
  path: string
}

/** A file or folder Flow mode opens when a session starts. */
export interface FlowResource {
  id: ID
  label: string
  path: string
  kind: 'file' | 'folder' | 'url'
}

export interface FlowConfig {
  /** Apps launched when the session starts. */
  launchApps: FlowApp[]
  /** Apps closed when the session starts. */
  closeApps: FlowApp[]
  /** Files / folders / urls opened when the session starts. */
  openResources: FlowResource[]
  /** Hostnames blocked during the session (e.g. "youtube.com"). */
  blockSites: string[]
  /** Only these urls are "allowed" — informational, opened on start. */
  allowSites: string[]
  /** Enable Windows Do-Not-Disturb / Focus Assist. */
  doNotDisturb: boolean
  /** Enter the minimal Ultra Focus screen automatically. */
  ultraFocus: boolean
}

export interface Project {
  id: ID
  name: string
  icon: string // lucide icon name or emoji
  color: string // hsl string or hex
  description?: string
  defaultDurationMinutes: number
  defaultSound: AmbientSound
  /** Optional spending budget for this project, in cents (Finance HUB). */
  budget?: number
  flow: FlowConfig
  createdAt: string
  updatedAt: string
  archived: boolean
  order: number
}

export interface Idea {
  id: ID
  content: string
  projectId?: ID
  createdAt: string
  archived: boolean
}

/** A single lane of a Kanban board (e.g. "Roteiro", "Gravação"). */
export interface BoardColumn {
  id: ID
  name: string
  color: string // hsl string
  order: number
  /** Landing here means the work is finished — cards get a "done" look. */
  done?: boolean
}

/**
 * A Kanban board. Columns live inline (there are only a handful and they always
 * move with the board); cards are kept in a flat list so drag-and-drop between
 * columns is a single field update.
 */
export interface Board {
  id: ID
  name: string
  icon: string // lucide icon name
  color: string // hsl string
  description?: string
  /** Optional link to a project — gives cards a project to inherit. */
  projectId?: ID
  columns: BoardColumn[]
  createdAt: string
  updatedAt: string
  archived: boolean
  order: number
}

/** Something attached to a card: a link, a local path, or a plain text note. */
export interface CardAsset {
  id: ID
  label: string
  /** A URL, a local file/folder path, or free text. */
  value: string
  /** 'text' entries are copy-only; links and paths can also be opened. */
  kind?: 'link' | 'path' | 'text'
}

/** A card on a board. Lightweight by default; may be linked to a real Task. */
export interface BoardCard {
  id: ID
  boardId: ID
  columnId: ID
  title: string
  /** The long-form body — the script itself. Read in "Modo leitura". */
  notes?: string
  /** Publish-ready description, kept apart from the script for easy copying. */
  description?: string
  /** Publish-ready hashtags, stored verbatim so copy/paste round-trips. */
  hashtags?: string
  assets: CardAsset[]
  tags: string[]
  /** Marked finished — either by hand or by landing in a "done" column. */
  done?: boolean
  /**
   * @deprecated A card is a deliverable and needs many tasks, not one. Tasks
   * now point at their card through `Task.cardId`; this is kept so older
   * documents migrate cleanly and is no longer written to.
   */
  taskId?: ID
  dueDate?: string // ISO
  createdAt: string
  updatedAt: string
  order: number
}

export type SessionState = 'idle' | 'running' | 'paused' | 'finished'

export interface Session {
  id: ID
  projectId?: ID
  taskId?: ID
  taskTitle: string
  plannedMinutes: number
  focusedSeconds: number
  startedAt: string
  endedAt?: string
  completed: boolean
}

export interface DayStat {
  date: string // YYYY-MM-DD
  focusedSeconds: number
  sessions: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: string
}

export interface Stats {
  xp: number
  level: number
  streakDays: number
  longestStreakDays: number
  lastActiveDate?: string
  totalFocusedSeconds: number
  totalSessions: number
  longestSessionSeconds: number
  days: DayStat[]
  achievements: Achievement[]
}

/** A saved YouTube playlist / video / live stream used as music source. */
export interface MusicSource {
  id: ID
  name: string
  url: string
}

export interface Settings {
  theme: ThemeName
  accentColor: string
  fontSans: string
  timerFormat: 'mm:ss' | 'hh:mm:ss'
  defaultDurationMinutes: number
  defaultSound: AmbientSound
  masterVolume: number
  minimizeToTray: boolean
  launchOnStartup: boolean
  quickCaptureShortcut: string
  notificationsEnabled: boolean
  musicSources: MusicSource[]
  alwaysElevate: boolean
}

export interface AppData {
  projects: Project[]
  tasks: Task[]
  ideas: Idea[]
  boards: Board[]
  cards: BoardCard[]
  sessions: Session[]
  stats: Stats
  settings: Settings
  finance: FinanceData
  events: CalendarEvent[]
  habits: Habit[]
  plannerGoals: PlannerGoal[]
  planner: PlannerSettings
}

/** One automatic snapshot of the whole app document. */
export interface BackupInfo {
  file: string
  savedAt: string // ISO
  reason: string
  boards: number
  cards: number
  tasks: number
  ideas: number
  transactions: number
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  /** Dev build — electron-updater only works on an installed app. */
  | 'unsupported'

export interface UpdateStatus {
  state: UpdateState
  /** Version being offered, when one is. */
  version?: string
  /** Download progress, 0-100. */
  percent?: number
  message?: string
}

/** Result returned by the main process after applying a Flow config. */
export interface FlowApplyResult {
  launched: string[]
  closed: string[]
  opened: string[]
  blockedSites: string[]
  doNotDisturb: boolean
  warnings: string[]
}

export const DURATION_PRESETS = [25, 45, 60, 90] as const
export const XP_PER_LEVEL = 1000

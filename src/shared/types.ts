/**
 * Focus HUB — Domain types shared between the Electron main process and the
 * React renderer. This is the single source of truth for the data contract.
 */

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

export interface Task {
  id: ID
  projectId: ID
  title: string
  description?: string
  checklist: ChecklistItem[]
  priority: Priority
  status: TaskStatus
  estimatedMinutes?: number
  actualMinutes: number
  tags: string[]
  dueDate?: string // ISO
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
  sessions: Session[]
  stats: Stats
  settings: Settings
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

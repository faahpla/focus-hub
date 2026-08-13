import { create } from 'zustand'
import type { Achievement, BoardCard, FlowApplyResult, Project, Session, Task } from '@shared/types'
import { flowIsEmpty, mergeFlow } from '@shared/flow'
import { uid } from '@/lib/utils'
import { todayKey } from '@/lib/format'
import { useAppStore } from './app-store'
import { useToastStore } from './toast-store'

type Phase = 'idle' | 'running' | 'paused' | 'finished'

/** Snapshot of what a finished session achieved, shown in the report screen. */
export interface SessionReport {
  taskTitle: string
  focusedSeconds: number
  plannedMinutes: number
  completed: boolean
  xpGained: number
  leveledUp: boolean
  newLevel: number
  checklistDone: number
  checklistTotal: number
  newAchievements: Achievement[]
  streakDays: number
  sessionsToday: number
}

interface SessionState {
  phase: Phase
  projectId?: string
  taskId?: string
  /** Set when focusing a board card — the card is the work, not a task. */
  cardId?: string
  taskTitle: string
  plannedSeconds: number
  focusedSeconds: number
  startedAt?: string
  ultraFocus: boolean
  flowResult?: FlowApplyResult
  applyingFlow: boolean
  notified: Record<number, boolean>
  report: SessionReport | null

  configure: (opts: {
    project?: Project
    task?: Task
    card?: BoardCard
    minutes: number
    taskTitle?: string
  }) => void
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  togglePause: () => void
  stop: (completed?: boolean) => Promise<void>
  reset: () => void
  dismissReport: () => void
  setUltraFocus: (v: boolean) => void
  _tick: () => void
}

let interval: ReturnType<typeof setInterval> | null = null
let lastTick = 0

function clearTimer(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

function notify(title: string, body: string): void {
  const enabled = useAppStore.getState().settings.notificationsEnabled
  if (!enabled) return
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, silent: false })
    }
  } catch {
    /* ignore */
  }
}

const NOTIFY_AT = [600, 300, 60]

export const useSessionStore = create<SessionState>((set, get) => ({
  phase: 'idle',
  taskTitle: 'Sessão de Foco',
  plannedSeconds: 45 * 60,
  focusedSeconds: 0,
  ultraFocus: false,
  applyingFlow: false,
  notified: {},
  report: null,

  configure: ({ project, task, card, minutes, taskTitle }) => {
    if (get().phase === 'running') return
    set({
      projectId: project?.id,
      taskId: task?.id,
      cardId: card?.id,
      taskTitle: taskTitle || task?.title || card?.title || project?.name || 'Sessão de Foco',
      plannedSeconds: Math.round(minutes * 60),
      focusedSeconds: 0,
      phase: 'idle',
      notified: {},
      flowResult: undefined
    })
  },

  start: async () => {
    const { projectId } = get()
    const project = useAppStore.getState().projects.find((p) => p.id === projectId)

    // Ask for notification permission once, up front.
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    } catch {
      /* ignore */
    }

    // Apply the Flow environment (best effort). The global config always runs;
    // a project only adds to it. Without this a session with no project
    // selected silently skipped Flow entirely — nothing blocked, no warning.
    const flow = mergeFlow(useAppStore.getState().settings.flow, project?.flow)
    if (!flowIsEmpty(flow)) {
      set({ applyingFlow: true })
      try {
        const flowResult = await window.focusHub.applyFlow(flow)
        set({ flowResult, ultraFocus: flow.ultraFocus })
        if (flow.ultraFocus) window.focusHub.setUltraFocus(true)

        // Surface exactly what happened to the machine.
        const lines: string[] = []
        if (flowResult.closed.length) lines.push(`Fechou: ${flowResult.closed.join(', ')}`)
        if (flowResult.launched.length) lines.push(`Abriu: ${flowResult.launched.join(', ')}`)
        if (flowResult.opened.length) lines.push(`Abriu ${flowResult.opened.length} recurso(s)`)
        if (flowResult.blockedSites.length)
          lines.push(`Bloqueou ${flowResult.blockedSites.length} site(s)`)
        const warnings = flowResult.warnings
        if (lines.length || warnings.length) {
          useToastStore.getState().push({
            title: warnings.length ? 'Ambiente pronto — com avisos' : 'Ambiente de foco pronto',
            lines: [...lines, ...warnings],
            variant: warnings.length ? 'warning' : 'success',
            duration: warnings.length ? 8000 : 4500
          })
        }
      } catch {
        /* ignore */
      } finally {
        set({ applyingFlow: false })
      }
    }

    lastTick = Date.now()
    set({ phase: 'running', startedAt: new Date().toISOString() })
    clearTimer()
    interval = setInterval(() => get()._tick(), 250)
    notify('Sessão iniciada', `${get().taskTitle} — foco total. Você consegue.`)
  },

  _tick: () => {
    const state = get()
    if (state.phase !== 'running') return
    const now = Date.now()
    const delta = (now - lastTick) / 1000
    lastTick = now
    const focused = state.focusedSeconds + delta
    const remaining = state.plannedSeconds - focused

    // Threshold notifications.
    const notified = { ...state.notified }
    for (const t of NOTIFY_AT) {
      if (remaining <= t && !notified[t] && remaining > 0) {
        notified[t] = true
        const mins = Math.round(t / 60)
        notify('Foco', `Faltam ${mins} min para o fim da sessão.`)
      }
    }

    if (remaining <= 0) {
      set({ focusedSeconds: state.plannedSeconds, notified })
      void get().stop(true)
      return
    }
    set({ focusedSeconds: focused, notified })
  },

  pause: () => {
    if (get().phase !== 'running') return
    clearTimer()
    set({ phase: 'paused' })
  },

  resume: () => {
    if (get().phase !== 'paused') return
    lastTick = Date.now()
    set({ phase: 'running' })
    clearTimer()
    interval = setInterval(() => get()._tick(), 250)
  },

  togglePause: () => {
    const phase = get().phase
    if (phase === 'running') get().pause()
    else if (phase === 'paused') get().resume()
  },

  stop: async (completed = false) => {
    const state = get()
    if (state.phase === 'idle' || state.phase === 'finished') return
    clearTimer()

    const focusedSeconds = Math.round(state.focusedSeconds)
    const session: Session = {
      id: uid(),
      projectId: state.projectId,
      taskId: state.taskId,
      cardId: state.cardId,
      taskTitle: state.taskTitle,
      plannedMinutes: Math.round(state.plannedSeconds / 60),
      focusedSeconds,
      startedAt: state.startedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      completed
    }

    set({ phase: 'finished' })

    // Update task actual minutes + capture checklist progress for the report.
    let checklistDone = 0
    let checklistTotal = 0
    if (state.taskId) {
      const task = useAppStore.getState().tasks.find((t) => t.id === state.taskId)
      if (task) {
        checklistTotal = task.checklist.length
        checklistDone = task.checklist.filter((c) => c.done).length
        void useAppStore.getState().saveTask({
          ...task,
          actualMinutes: task.actualMinutes + Math.round(focusedSeconds / 60)
        })
      }
    } else if (state.cardId) {
      const card = useAppStore.getState().cards.find((c) => c.id === state.cardId)
      const list = card?.checklist ?? []
      checklistTotal = list.length
      checklistDone = list.filter((c) => c.done).length
    }

    // Snapshot stats before recording so we can compute the gains.
    const before = useAppStore.getState().stats
    const xpBefore = before.xp
    const levelBefore = before.level
    const unlockedBefore = new Set(
      before.achievements.filter((a) => a.unlockedAt).map((a) => a.id)
    )

    if (focusedSeconds > 5) {
      await useAppStore.getState().recordSession(session)

      const after = useAppStore.getState().stats
      const today = after.days.find((d) => d.date === todayKey())
      set({
        report: {
          taskTitle: state.taskTitle,
          focusedSeconds,
          plannedMinutes: Math.round(state.plannedSeconds / 60),
          completed,
          xpGained: after.xp - xpBefore,
          leveledUp: after.level > levelBefore,
          newLevel: after.level,
          checklistDone,
          checklistTotal,
          newAchievements: after.achievements.filter(
            (a) => a.unlockedAt && !unlockedBefore.has(a.id)
          ),
          streakDays: after.streakDays,
          sessionsToday: today?.sessions ?? 0
        }
      })
    }

    // Release the machine.
    window.focusHub.setUltraFocus(false)
    await window.focusHub.releaseFlow()
    notify(
      completed ? 'Sessão concluída! 🎉' : 'Sessão encerrada',
      `Você focou por ${Math.round(focusedSeconds / 60)} min.`
    )

    // Too short to count — just go back to idle without a report.
    if (focusedSeconds <= 5) {
      set({ phase: 'idle', focusedSeconds: 0, ultraFocus: false, notified: {} })
    }
    // Belt and braces: the window must never stay pinned on top once the
    // session is over, whatever path got us here.
    window.focusHub.setUltraFocus(false)
  },

  reset: () => {
    clearTimer()
    get().setUltraFocus(false)
    set({ phase: 'idle', focusedSeconds: 0, notified: {} })
  },

  dismissReport: () => {
    clearTimer()
    // Through setUltraFocus, never `set({ ultraFocus: false })` on its own: the
    // flag also drives setFullScreen/setAlwaysOnTop on the real window. Setting
    // it directly left the window pinned above everything else — including
    // whatever the OS wants to draw on top of it.
    get().setUltraFocus(false)
    set({ phase: 'idle', focusedSeconds: 0, notified: {}, report: null })
  },

  setUltraFocus: (v) => {
    set({ ultraFocus: v })
    window.focusHub.setUltraFocus(v)
  }
}))

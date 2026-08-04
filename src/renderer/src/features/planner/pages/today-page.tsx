import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  Plus,
  Sparkles,
  Target
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useToastStore } from '@/stores/toast-store'
import { usePlannerUi } from '@/stores/planner-ui-store'
import { useSessionStore } from '@/stores/session-store'
import { uid } from '@/lib/utils'
import type { Task } from '@shared/types'
import { TaskDetailDialog } from '@/features/projects/task-detail-dialog'
import { HomeFinanceCard } from '@/features/finance/components/home-finance-card'
import { NowBar } from '../components/now-bar'
import { CapacityBar } from '../components/capacity-bar'
import { HabitStrip } from '../components/habit-strip'
import { TaskRow } from '../components/task-row'
import { TimerPanel } from '../components/timer-panel'
import { useCapacity, useDayTasks, useRollover } from '../hooks/use-planner'
import { applyPlan, planDay, taskDuration } from '../services/scheduler'
import { goalProgress, leadGoal } from '../services/goals-service'
import { formatMinutes, nowClock } from '../utils/time'
import { today, weekdayLong, dayLabel } from '@/lib/dates'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Ainda acordado'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * The screen the app opens on, built to answer one question before the user
 * has to click anything: what do I need to do now?
 */
export function TodayPage(): JSX.Element {
  const day = today()
  const navigate = useNavigate()
  const tasks = useAppStore((s) => s.tasks)
  const events = useAppStore((s) => s.events)
  const projects = useAppStore((s) => s.projects)
  const settings = useAppStore((s) => s.planner)
  const saveTask = useAppStore((s) => s.saveTask)
  const saveTasks = useAppStore((s) => s.saveTasks)
  const pushToast = useToastStore((s) => s.push)
  const setDay = usePlannerUi((s) => s.setDay)
  const session = useSessionStore()

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useRollover()

  const dayTasks = useDayTasks(day)
  const capacity = useCapacity(day)
  const data = useAppStore()

  const pending = dayTasks.filter((t) => t.status !== 'done')
  const done = dayTasks.filter((t) => t.status === 'done')
  const timed = pending.filter((t) => t.startTime)
  const loose = pending.filter((t) => !t.startTime)

  const todayEvents = useMemo(
    () => events.filter((e) => e.date === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, day]
  )

  const goal = useMemo(() => leadGoal(data, day), [data, day])
  const goalStats = goal ? goalProgress(goal, data, day) : undefined

  const progress = dayTasks.length > 0 ? done.length / dayTasks.length : 0

  const organize = (): void => {
    const plan = planDay({ day, tasks, events, settings, notBefore: nowClock() })
    const changed = applyPlan(plan, tasks)
    if (changed.length > 0) void saveTasks(changed)

    const lines = [
      `${plan.placements.length} tarefa(s) encaixada(s) em ${formatMinutes(plan.usedMinutes)}.`
    ]
    if (plan.freeMinutes > 0) lines.push(`Sobraram ${formatMinutes(plan.freeMinutes)} livres.`)
    if (plan.rejections.length > 0) {
      lines.push(`${plan.rejections.length} não coube(ram): ${plan.rejections[0].reason}`)
    }
    pushToast({
      title: plan.placements.length > 0 ? 'Dia organizado' : 'Nada para encaixar',
      lines,
      variant: plan.placements.length > 0 ? 'success' : 'default',
      duration: 8000
    })
  }

  const quickAdd = (): void => {
    const title = draft.trim()
    if (!title) return
    const stamp = new Date().toISOString()
    void saveTask({
      id: uid(),
      title,
      checklist: [],
      priority: 'medium',
      status: 'todo',
      actualMinutes: 0,
      tags: [],
      scheduledDate: day,
      createdAt: stamp,
      updatedAt: stamp,
      order: tasks.length
    })
    setDraft('')
  }

  const startSession = (task: Task): void => {
    session.configure({
      project: projects.find((p) => p.id === task.projectId),
      task,
      minutes: Math.max(5, taskDuration(task, settings))
    })
    void session.start()
  }

  const openAgenda = (): void => {
    setDay(day)
    navigate('/agenda')
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-5 px-8 pb-24 pt-8">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, FAAH.</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {weekdayLong(day)}, {dayLabel(day)} ·{' '}
                {pending.length === 0
                  ? 'nada pendente'
                  : `${pending.length} pendente${pending.length === 1 ? '' : 's'}`}
                {todayEvents.length > 0 && ` · ${todayEvents.length} compromisso(s)`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openAgenda}>
                <CalendarDays className="h-4 w-4" /> Agenda
              </Button>
              <Button variant="primary" onClick={organize} disabled={pending.length === 0}>
                <Sparkles className="h-4 w-4" /> Organizar meu dia
              </Button>
            </div>
          </div>

          <NowBar day={day} onOpenTask={(t) => setOpenTaskId(t.id)} />

          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-4">
              {/* Quick add */}
              <div className="relative">
                <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draft}
                  placeholder="O que mais precisa acontecer hoje?"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
                  className="pl-10"
                />
              </div>

              {/* Timed blocks */}
              {timed.length > 0 && (
                <Card className="p-4">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground">Com horário</h3>
                  </div>
                  <AnimatePresence initial={false}>
                    {timed.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onOpen={(t) => setOpenTaskId(t.id)}
                        onStart={startSession}
                      />
                    ))}
                  </AnimatePresence>
                </Card>
              )}

              {/* Loose tasks */}
              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      {timed.length > 0 ? 'Sem horário definido' : 'Para hoje'}
                    </h3>
                  </div>
                  {loose.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatMinutes(
                        loose.reduce((sum, t) => sum + taskDuration(t, settings), 0)
                      )}
                    </span>
                  )}
                </div>

                {loose.length === 0 && timed.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    Nada planejado ainda. Escreva ali em cima e aperte Enter.
                  </p>
                ) : loose.length === 0 ? (
                  <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                    Tudo com horário definido.
                  </p>
                ) : (
                  <AnimatePresence initial={false}>
                    {loose.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onOpen={(t) => setOpenTaskId(t.id)}
                        onStart={startSession}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </Card>

              {/* Events */}
              {todayEvents.length > 0 && (
                <Card className="p-4">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-semibold text-muted-foreground">Compromissos</h3>
                  </div>
                  <div className="space-y-1">
                    {todayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2"
                        style={{ background: `hsl(${event.color} / 0.08)` }}
                      >
                        <span
                          className="h-8 w-[3px] shrink-0 rounded-full"
                          style={{ background: `hsl(${event.color})` }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{event.title}</p>
                          {event.location && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {event.location}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs tabular text-muted-foreground">
                          {event.allDay ? 'dia todo' : `${event.startTime}–${event.endTime}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Completed */}
              {done.length > 0 && (
                <Card className="p-4">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      Feito hoje ({done.length})
                    </h3>
                  </div>
                  {done.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenTaskId(t.id)} compact />
                  ))}
                </Card>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <CapacityBar capacity={capacity} />

              {dayTasks.length > 0 && (
                <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                    <span className="text-xs tabular">
                      {done.length}/{dayTasks.length}
                    </span>
                  </div>
                  <ProgressBar
                    value={progress}
                    indicatorClassName={progress === 1 ? 'bg-success' : undefined}
                  />
                  {progress === 1 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 flex items-center gap-1 text-[11px] text-success"
                    >
                      <Flame className="h-3 w-3" /> Dia fechado. Muito bem.
                    </motion.p>
                  )}
                </div>
              )}

              {settings.showHabitsOnToday && <HabitStrip day={day} />}

              {goal && goalStats && (
                <button
                  onClick={() => navigate('/agenda')}
                  className="no-drag block w-full rounded-2xl border border-border/70 bg-surface/50 p-4 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Meta</span>
                    <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ background: `hsl(${goal.color} / 0.15)`, color: `hsl(${goal.color})` }}
                    >
                      <DynamicIcon name={goal.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">{goal.name}</span>
                    <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                      {goalStats.current}/{goalStats.target}
                    </span>
                  </div>
                  <ProgressBar value={goalStats.ratio} className="h-1.5" />
                </button>
              )}

              {settings.showFinanceOnToday && <HomeFinanceCard />}

              <TimerPanel />
            </div>
          </div>
        </div>
      </div>

      {openTaskId && (
        <TaskDetailDialog taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}
    </div>
  )
}

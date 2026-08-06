import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Flame,
  Pause,
  Play,
  Square,
  Timer,
  CheckCircle2,
  SlidersHorizontal,
  Maximize2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { DynamicIcon } from '@/components/dynamic-icon'
import { TimerDisplay } from '@/features/session/timer-display'
import { ChecklistPanel } from '@/features/session/checklist-panel'
import { FlowSummary } from '@/features/session/flow-summary'
import { TaskDetailDialog } from '@/features/projects/task-detail-dialog'
import { AmbientBar } from '@/features/ambient/ambient-bar'
import { HomeFinanceCard } from '@/features/finance/components/home-finance-card'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { DURATION_PRESETS } from '@shared/types'
import { formatDuration, todayKey } from '@/lib/format'
import { cn } from '@/lib/utils'

export function HomePage(): JSX.Element {
  const allProjects = useAppStore((s) => s.projects)
  const tasks = useAppStore((s) => s.tasks)
  const stats = useAppStore((s) => s.stats)
  const projects = allProjects.filter((p) => !p.archived)

  const session = useSessionStore()
  const {
    phase,
    projectId,
    taskId,
    taskTitle,
    plannedSeconds,
    focusedSeconds,
    applyingFlow
  } = session

  const [minutes, setMinutes] = useState(45)
  const [customOpen, setCustomOpen] = useState(false)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

  const activeProject = projects.find((p) => p.id === projectId) ?? projects[0]
  const projectTasks = tasks
    .filter((t) => t.projectId === activeProject?.id && t.status !== 'done')
    .sort((a, b) => a.order - b.order)
  const activeTask = tasks.find((t) => t.id === taskId)

  // Configure a default session on first load. Skipped when something already
  // configured the session (e.g. "Iniciar sessão" from a Kanban card), so we
  // don't overwrite the task the user actually picked.
  useEffect(() => {
    if (phase === 'idle' && activeProject && !projectId) {
      const task = projectTasks[0]
      session.configure({
        project: activeProject,
        task,
        minutes: activeProject.defaultDurationMinutes
      })
      setMinutes(activeProject.defaultDurationMinutes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const today = stats.days.find((d) => d.date === todayKey())
  const remaining = Math.max(0, plannedSeconds - focusedSeconds)
  const progress = plannedSeconds > 0 ? focusedSeconds / plannedSeconds : 0
  const isActive = phase === 'running' || phase === 'paused'
  const isCustom = !(DURATION_PRESETS as readonly number[]).includes(minutes)

  const selectProject = (id: string): void => {
    const project = projects.find((p) => p.id === id)
    const firstTask = tasks.find((t) => t.projectId === id && t.status !== 'done')
    session.configure({
      project,
      task: firstTask,
      minutes: project?.defaultDurationMinutes ?? minutes
    })
    if (project) setMinutes(project.defaultDurationMinutes)
  }

  const selectTask = (id: string): void => {
    const task = tasks.find((t) => t.id === id)
    session.configure({ project: activeProject, task, minutes })
  }

  const setDuration = (m: number): void => {
    setMinutes(m)
    session.configure({ project: activeProject, task: activeTask, minutes: m })
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col items-center overflow-y-auto scrollbar-thin px-8">
       <div className="flex w-full max-w-2xl flex-col items-center py-5 my-auto">
        {/* Project + task selector */}
        <div className="mb-6 flex flex-col items-center gap-3">
          {!isActive && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="no-drag flex items-center gap-2 rounded-full border border-border/70 bg-surface/60 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
                    {activeProject && (
                      <DynamicIcon
                        name={activeProject.icon}
                        className="h-4 w-4"
                        style={{ color: `hsl(${activeProject.color})` }}
                      />
                    )}
                    {activeProject?.name ?? 'Selecionar projeto'}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuLabel>Projetos</DropdownMenuLabel>
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      active={p.id === activeProject?.id}
                      onSelect={() => selectProject(p.id)}
                    >
                      <span className="flex items-center gap-2">
                        <DynamicIcon
                          name={p.icon}
                          className="h-4 w-4"
                          style={{ color: `hsl(${p.color})` }}
                        />
                        {p.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {projects.length === 0 && (
                    <div className="px-2.5 py-2 text-sm text-muted-foreground">
                      Crie um projeto primeiro.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={taskTitle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {isActive ? (
                <h1 className="text-center text-3xl font-semibold tracking-tight">{taskTitle}</h1>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="no-drag group flex items-center gap-2 text-center">
                      <h1 className="text-3xl font-semibold tracking-tight transition-colors group-hover:text-primary">
                        {taskTitle}
                      </h1>
                      <ChevronDown className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-[16rem]">
                    <DropdownMenuLabel>Tarefas de {activeProject?.name}</DropdownMenuLabel>
                    {projectTasks.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        active={t.id === taskId}
                        onSelect={() => selectTask(t.id)}
                      >
                        {t.title}
                      </DropdownMenuItem>
                    ))}
                    {projectTasks.length === 0 && (
                      <div className="px-2.5 py-2 text-sm text-muted-foreground">
                        Sem tarefas pendentes.
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        session.configure({
                          project: activeProject,
                          minutes,
                          taskTitle: 'Sessão Livre'
                        })
                      }
                    >
                      Sessão livre (sem tarefa)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Timer */}
        <TimerDisplay
          remainingSeconds={remaining}
          progress={progress}
          running={phase === 'running'}
          size={300}
        />

        {/* Duration presets */}
        <AnimatePresence>
          {!isActive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 flex items-center gap-2"
            >
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setCustomOpen(false)
                    setDuration(m)
                  }}
                  className={cn(
                    'no-drag h-9 rounded-full px-4 text-sm font-medium transition-all',
                    !customOpen && minutes === m
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'bg-surface/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  )}
                >
                  {m}min
                </button>
              ))}

              {/* Custom duration */}
              {customOpen ? (
                <div
                  className={cn(
                    'no-drag flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium transition-all',
                    isCustom
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'bg-surface-hover text-foreground'
                  )}
                >
                  <input
                    autoFocus
                    type="number"
                    min={1}
                    max={600}
                    value={minutes}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(600, Math.floor(Number(e.target.value) || 0)))
                      setDuration(v)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                    }}
                    onBlur={() => setCustomOpen(false)}
                    className="w-9 bg-transparent text-center tabular focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  min
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (!isCustom) setDuration(10)
                    setCustomOpen(true)
                  }}
                  className={cn(
                    'no-drag flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-all',
                    isCustom
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : 'bg-surface/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {isCustom ? `${minutes}min` : 'Outro'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="mt-6 flex items-center gap-3">
          {phase === 'idle' || phase === 'finished' ? (
            <Button
              size="xl"
              variant="primary"
              disabled={!activeProject || applyingFlow}
              onClick={() => session.start()}
              className="min-w-[220px]"
            >
              {applyingFlow ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Preparando ambiente…
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  Iniciar Sessão
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                size="xl"
                variant={phase === 'paused' ? 'primary' : 'secondary'}
                onClick={() => session.togglePause()}
                className="min-w-[150px]"
              >
                {phase === 'paused' ? (
                  <>
                    <Play className="h-5 w-5 fill-current" /> Retomar
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5" /> Pausar
                  </>
                )}
              </Button>
              <Button size="xl" variant="destructive" onClick={() => session.stop(false)}>
                <Square className="h-4 w-4 fill-current" /> Encerrar
              </Button>
            </>
          )}
        </div>

        {!isActive && <FlowSummary project={activeProject} />}

        <AmbientBar />
       </div>
      </div>

      {/* Right rail (extra bottom padding so the floating capture button never
          overlaps the checklist input) */}
      <aside className="hidden w-[280px] shrink-0 flex-col gap-4 border-l border-border/60 p-5 pb-24 lg:flex">
        <div className="grid gap-3">
          <StatCard
            icon={<Timer className="h-4 w-4" />}
            label="Foco hoje"
            value={formatDuration(today?.focusedSeconds ?? 0)}
            accent
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Sessões hoje"
            value={String(today?.sessions ?? 0)}
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Dias consecutivos"
            value={String(stats.streakDays)}
          />
        </div>

        <HomeFinanceCard />

        {activeTask && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <button
              onClick={() => setTaskDetailOpen(true)}
              className="no-drag group flex items-start gap-2 rounded-2xl border border-border/70 bg-surface/60 p-3.5 text-left transition-colors hover:border-border hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground">Tarefa atual</p>
                <p className="truncate text-sm font-semibold">{activeTask.title}</p>
                {activeTask.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {activeTask.description}
                  </p>
                )}
              </div>
              <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
            </button>
            <div className="min-h-0 flex-1">
              <ChecklistPanel task={activeTask} />
            </div>
          </div>
        )}
      </aside>

      {taskDetailOpen && activeTask && (
        <TaskDetailDialog taskId={activeTask.id} onClose={() => setTaskDetailOpen(false)} />
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-surface/60 p-4',
        accent && 'bg-primary/10 border-primary/20'
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn(accent && 'text-primary')}>{icon}</span>
        {label}
      </div>
      <div className={cn('text-2xl font-semibold tabular', accent && 'text-primary')}>{value}</div>
    </div>
  )
}

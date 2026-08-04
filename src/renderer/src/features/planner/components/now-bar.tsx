import { motion } from 'framer-motion'
import { ArrowRight, Coffee, Play, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { cn } from '@/lib/utils'
import type { Task } from '@shared/types'
import { formatMinutes } from '../utils/time'
import { useNow } from '../hooks/use-planner'
import { taskDuration } from '../services/scheduler'

/**
 * The answer to "o que eu preciso fazer agora?".
 *
 * It degrades through three levels so it is never blank while there is work
 * left: the block running right now, the one coming up, or — when nothing is
 * booked — the task the scheduler would have picked first anyway. Only when
 * there is genuinely nothing does it say so, and it says so kindly.
 */
export function NowBar({
  day,
  onOpenTask
}: {
  day: string
  onOpenTask: (task: Task) => void
}): JSX.Element {
  const now = useNow(day)
  const settings = useAppStore((s) => s.planner)
  const projects = useAppStore((s) => s.projects)
  const session = useSessionStore()

  const active = now.current?.task ?? now.next?.task ?? now.suggestion
  const isRunning = session.phase === 'running' || session.phase === 'paused'

  const start = (task: Task): void => {
    const project = projects.find((p) => p.id === task.projectId)
    session.configure({
      project,
      task,
      minutes: Math.max(5, taskDuration(task, settings))
    })
    void session.start()
  }

  if (!active) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface/50 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/12 text-success">
          <Coffee className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Nada pendente para hoje</p>
          <p className="text-xs text-muted-foreground">
            Dia limpo. Aproveite — ou puxe algo do backlog se estiver com gás.
          </p>
        </div>
      </div>
    )
  }

  const label = now.current
    ? 'Agora'
    : now.next
      ? `Às ${now.next.startTime}`
      : 'Sugestão'

  const progress = now.current
    ? 1 - now.current.minutesLeft / taskDuration(now.current.task, settings)
    : 0

  return (
    <motion.div
      layout
      className={cn(
        'relative overflow-hidden rounded-2xl border p-5',
        now.current ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/70 bg-surface/50'
      )}
    >
      {now.current && (
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-20 blur-3xl"
          style={{ background: 'hsl(var(--primary))' }}
        />
      )}

      <div className="relative flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                now.current ? 'bg-primary/20 text-primary' : 'bg-surface-elevated text-muted-foreground'
              )}
            >
              {label}
            </span>
            {now.current && (
              <span className="text-xs tabular text-muted-foreground">
                faltam {formatMinutes(now.current.minutesLeft)}
              </span>
            )}
            {now.next && !now.current && (
              <span className="text-xs tabular text-muted-foreground">
                em {formatMinutes(now.next.minutesUntil)}
              </span>
            )}
            {!now.current && !now.next && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" /> pelo que é mais urgente
              </span>
            )}
          </div>

          <button
            onClick={() => onOpenTask(active)}
            className="no-drag block max-w-full truncate text-left text-xl font-semibold tracking-tight transition-colors hover:text-primary"
          >
            {active.title}
          </button>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              projects.find((p) => p.id === active.projectId)?.name,
              formatMinutes(taskDuration(active, settings))
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenTask(active)}>
            Detalhes <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="primary"
            onClick={() => start(active)}
            disabled={isRunning}
            title={isRunning ? 'Já existe uma sessão em andamento' : 'Iniciar sessão de foco'}
          >
            <Play className="h-4 w-4 fill-current" />
            {isRunning ? 'Sessão em andamento' : 'Focar nisso'}
          </Button>
        </div>
      </div>

      {now.current && (
        <div className="relative mt-4">
          <ProgressBar value={Math.max(0, Math.min(1, progress))} className="h-1.5" />
        </div>
      )}
    </motion.div>
  )
}

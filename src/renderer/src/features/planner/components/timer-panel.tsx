import { Maximize2, Pause, Play, Square, Timer as TimerIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TimerDisplay } from '@/features/session/timer-display'
import { useAppStore } from '@/stores/app-store'
import { useSessionStore } from '@/stores/session-store'
import { DURATION_PRESETS } from '@shared/types'
import { formatDuration, todayKey } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The focus timer, as a panel rather than a whole screen.
 *
 * It used to *be* the home screen. Demoting it is the point of this release:
 * the timer is how you do the work, but the day is what tells you which work —
 * so the day comes first and the timer sits beside it, always one click away.
 */
export function TimerPanel(): JSX.Element {
  const session = useSessionStore()
  const stats = useAppStore((s) => s.stats)
  const navigate = useNavigate()
  const { phase, plannedSeconds, focusedSeconds, taskTitle, applyingFlow } = session

  const remaining = Math.max(0, plannedSeconds - focusedSeconds)
  const progress = plannedSeconds > 0 ? focusedSeconds / plannedSeconds : 0
  const active = phase === 'running' || phase === 'paused'
  const todayStat = stats.days.find((d) => d.date === todayKey())

  return (
    <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <TimerIcon className="h-3.5 w-3.5" />
          Foco
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular text-muted-foreground">
            {formatDuration(todayStat?.focusedSeconds ?? 0)} hoje
          </span>
          <button
            onClick={() => navigate('/foco')}
            className="no-drag text-muted-foreground transition-colors hover:text-foreground"
            title="Modo foco: tela cheia com som ambiente, Flow e checklist"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <TimerDisplay
          remainingSeconds={remaining}
          progress={progress}
          running={phase === 'running'}
          size={168}
        />

        {active && taskTitle && (
          <p className="mt-2 line-clamp-2 text-center text-xs text-muted-foreground">{taskTitle}</p>
        )}

        {!active ? (
          <div className="mt-3 w-full">
            <div className="flex gap-1.5">
              {DURATION_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => session.configure({ minutes })}
                  className={cn(
                    'no-drag h-8 flex-1 rounded-lg text-xs transition-colors',
                    plannedSeconds === minutes * 60
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-elevated text-muted-foreground hover:text-foreground'
                  )}
                >
                  {minutes}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              className="mt-2 w-full"
              disabled={applyingFlow}
              onClick={() => void session.start()}
            >
              <Play className="h-4 w-4 fill-current" />
              {applyingFlow ? 'Preparando…' : 'Iniciar sessão'}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex w-full gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => session.togglePause()}>
              {phase === 'paused' ? (
                <>
                  <Play className="h-4 w-4 fill-current" /> Retomar
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Pausar
                </>
              )}
            </Button>
            <Button variant="ghost" className="px-3" onClick={() => session.stop(false)}>
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

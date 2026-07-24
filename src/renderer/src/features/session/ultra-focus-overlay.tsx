import { AnimatePresence, motion } from 'framer-motion'
import { Minimize2, Pause, Play, Square } from 'lucide-react'
import { TimerDisplay } from './timer-display'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/stores/session-store'

export function UltraFocusOverlay(): JSX.Element {
  const session = useSessionStore()
  const { phase, ultraFocus, taskTitle, plannedSeconds, focusedSeconds } = session
  const visible = ultraFocus && (phase === 'running' || phase === 'paused')

  const remaining = Math.max(0, plannedSeconds - focusedSeconds)
  const progress = plannedSeconds > 0 ? focusedSeconds / plannedSeconds : 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background drag"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-12 text-4xl font-semibold tracking-tight text-foreground"
          >
            {taskTitle}
          </motion.h1>

          <TimerDisplay
            remainingSeconds={remaining}
            progress={progress}
            running={phase === 'running'}
            size={420}
          />

          <div className="no-drag mt-14 flex items-center gap-3">
            <Button
              size="lg"
              variant={phase === 'paused' ? 'primary' : 'secondary'}
              onClick={() => session.togglePause()}
            >
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
            <Button size="lg" variant="destructive" onClick={() => session.stop(false)}>
              <Square className="h-4 w-4 fill-current" /> Encerrar
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => session.setUltraFocus(false)}
              title="Sair do modo Ultra Focus"
            >
              <Minimize2 className="h-4 w-4" /> Sair do Ultra
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

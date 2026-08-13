import { useEffect, useState } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import {
  ArrowUpRight,
  CheckCircle2,
  Flame,
  ListChecks,
  PartyPopper,
  Sparkles,
  Trophy,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useSessionStore } from '@/stores/session-store'
import { formatDuration } from '@/lib/format'

function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }): JSX.Element {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v))
    })
    return () => controls.stop()
  }, [value, duration])
  return <>{display}</>
}

export function SessionReportOverlay(): JSX.Element {
  const report = useSessionStore((s) => s.report)
  const dismissReport = useSessionStore((s) => s.dismissReport)

  return (
    <AnimatePresence>
      {report && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          /*
            pointer-events must be stated, not inherited. A Radix dialog open
            underneath (reading a card's script during the session) sets
            `pointer-events: none` on <body> to block the rest of the screen —
            and this overlay, being a sibling, inherited the block. The report
            showed up and every click fell through to the dialog behind it, so
            the whole app looked frozen.
          */
          className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
        >
          {/* soft celebratory glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.5, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/25 blur-[100px]"
            />
            {report.completed &&
              Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute left-1/2 top-1/2 text-primary"
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: (i % 2 ? 1 : -1) * (60 + i * 26),
                    y: -80 - i * 20,
                    scale: [0, 1, 0.6]
                  }}
                  transition={{ duration: 1.6, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div>
              ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-surface-elevated shadow-elevated"
          >
            {/* Header */}
            <div className="flex flex-col items-center px-8 pb-6 pt-8 text-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary"
              >
                {report.completed ? (
                  <PartyPopper className="h-8 w-8" />
                ) : (
                  <CheckCircle2 className="h-8 w-8" />
                )}
              </motion.div>
              <h2 className="text-xl font-semibold tracking-tight">
                {report.completed ? 'Sessão concluída!' : 'Sessão encerrada'}
              </h2>
              <p className="mt-1 max-w-[16rem] truncate text-sm text-muted-foreground">
                {report.taskTitle}
              </p>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="tabular text-5xl font-bold text-foreground">
                  {Math.round(report.focusedSeconds / 60)}
                </span>
                <span className="text-lg text-muted-foreground">min focados</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                de {report.plannedMinutes} min planejados ·{' '}
                {formatDuration(report.focusedSeconds)}
              </p>
            </div>

            {/* Level up banner */}
            <AnimatePresence>
              {report.leveledUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mx-6 mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3"
                >
                  <ArrowUpRight className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Subiu para o nível {report.newLevel}!
                    </p>
                    <p className="text-xs text-muted-foreground">Continue nesse ritmo.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 px-6">
              <Stat
                icon={<Zap className="h-4 w-4" />}
                value={<>+<CountUp value={report.xpGained} /></>}
                label="XP"
                highlight
              />
              <Stat
                icon={<CheckCircle2 className="h-4 w-4" />}
                value={report.sessionsToday}
                label="Hoje"
              />
              <Stat
                icon={<Flame className="h-4 w-4" />}
                value={report.streakDays}
                label="Sequência"
              />
            </div>

            {/* Checklist progress */}
            {report.checklistTotal > 0 && (
              <div className="mx-6 mt-4 rounded-2xl border border-border/70 bg-surface/50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ListChecks className="h-4 w-4" /> Checklist
                  </span>
                  <span className="tabular font-medium">
                    {report.checklistDone}/{report.checklistTotal}
                  </span>
                </div>
                <ProgressBar value={report.checklistDone / report.checklistTotal} />
              </div>
            )}

            {/* New achievements */}
            {report.newAchievements.length > 0 && (
              <div className="mx-6 mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-primary" /> Conquista
                  {report.newAchievements.length > 1 ? 's' : ''} desbloqueada
                  {report.newAchievements.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {report.newAchievements.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.12 }}
                      className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <DynamicIcon name={a.icon} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 pt-5">
              <Button variant="primary" size="lg" className="w-full" onClick={dismissReport}>
                Continuar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Stat({
  icon,
  value,
  label,
  highlight
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  highlight?: boolean
}): JSX.Element {
  return (
    <div
      className={
        'flex flex-col items-center gap-1 rounded-2xl border p-3 text-center ' +
        (highlight
          ? 'border-primary/25 bg-primary/10 text-primary'
          : 'border-border/70 bg-surface/50 text-foreground')
      }
    >
      <span className={highlight ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      <span className="tabular text-xl font-bold">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

import { motion } from 'framer-motion'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TimerDisplayProps {
  remainingSeconds: number
  progress: number // 0..1 elapsed
  running: boolean
  size?: number
  className?: string
  withHours?: boolean
}

export function TimerDisplay({
  remainingSeconds,
  progress,
  running,
  size = 340,
  className,
  withHours
}: TimerDisplayProps): JSX.Element {
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * Math.min(1, Math.max(0, progress))

  /**
   * The clock used to be a fixed 3.4rem at every size, which crowds the ring
   * once the widget gets small — the Today panel draws it at 168px. Cap it at
   * the original size so the full-screen timers are untouched, and let it
   * scale down proportionally below that.
   */
  const fontSize = Math.min(54.4, size * 0.19)

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      {running && (
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl animate-pulse-ring" />
      )}
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted) / 0.5)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.55))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tabular font-mono font-semibold leading-none tracking-tight text-foreground"
          style={{ fontSize }}
        >
          {formatClock(remainingSeconds, withHours)}
        </span>
      </div>
    </div>
  )
}

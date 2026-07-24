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
        <span className="tabular font-mono text-[3.4rem] font-semibold leading-none tracking-tight text-foreground">
          {formatClock(remainingSeconds, withHours)}
        </span>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0..1
  className?: string
  indicatorClassName?: string
}

export function ProgressBar({ value, className, indicatorClassName }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted/60', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-500 ease-out',
          indicatorClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

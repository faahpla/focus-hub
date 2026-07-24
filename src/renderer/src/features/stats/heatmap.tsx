import { useMemo } from 'react'
import type { DayStat } from '@shared/types'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const WEEKS = 26 // ~6 months

export function Heatmap({ days }: { days: DayStat[] }): JSX.Element {
  const { cells, max } = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.focusedSeconds]))
    const today = new Date()
    // Start on the Sunday WEEKS ago.
    const start = new Date(today)
    start.setDate(start.getDate() - WEEKS * 7 - today.getDay())
    const arr: { date: string; seconds: number }[] = []
    let maxSeconds = 1
    for (let i = 0; i <= WEEKS * 7 + today.getDay(); i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const seconds = map.get(key) ?? 0
      maxSeconds = Math.max(maxSeconds, seconds)
      arr.push({ date: key, seconds })
    }
    return { cells: arr, max: maxSeconds }
  }, [days])

  const level = (s: number): number => {
    if (s === 0) return 0
    const r = s / max
    if (r < 0.25) return 1
    if (r < 0.5) return 2
    if (r < 0.75) return 3
    return 4
  }

  const columns: { date: string; seconds: number }[][] = []
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7))

  return (
    <div className="flex gap-[3px] overflow-x-auto scrollbar-thin pb-1">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-[3px]">
          {col.map((cell) => (
            <Tooltip
              key={cell.date}
              side="top"
              label={`${cell.date} · ${cell.seconds > 0 ? formatDuration(cell.seconds) : 'sem foco'}`}
            >
              <div
                className={cn(
                  'h-3 w-3 rounded-[3px] transition-colors',
                  [
                    'bg-muted/40',
                    'bg-primary/25',
                    'bg-primary/45',
                    'bg-primary/70',
                    'bg-primary'
                  ][level(cell.seconds)]
                )}
              />
            </Tooltip>
          ))}
        </div>
      ))}
    </div>
  )
}

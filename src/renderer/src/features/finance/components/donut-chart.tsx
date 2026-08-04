import { useState } from 'react'
import { DynamicIcon } from '@/components/dynamic-icon'
import { cn } from '@/lib/utils'
import { formatPercent } from '../utils/money'
import { Money } from './money'
import type { CategorySlice } from '../services/finance-engine'

const SIZE = 190
const STROKE = 26
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Spending by category. Drawn with stroke-dasharray on a single circle so each
 * slice is one element — cheap to animate and to hover.
 */
export function DonutChart({
  slices,
  onSelect
}: {
  slices: CategorySlice[]
  onSelect?: (categoryId: string) => void
}): JSX.Element {
  const [hover, setHover] = useState<string | null>(null)
  const total = slices.reduce((sum, s) => sum + s.amount, 0)
  const active = slices.find((s) => s.categoryId === hover)

  if (total === 0) {
    return (
      <div className="flex h-[190px] items-center justify-center text-sm text-muted-foreground">
        Nenhuma despesa registrada no período.
      </div>
    )
  }

  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeOpacity={0.35}
            strokeWidth={STROKE}
          />
          {slices.map((slice) => {
            const length = slice.share * CIRCUMFERENCE
            const dash = `${Math.max(0, length - 2)} ${CIRCUMFERENCE - length + 2}`
            const dimmed = hover !== null && hover !== slice.categoryId
            const element = (
              <circle
                key={slice.categoryId}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={`hsl(${slice.color})`}
                strokeWidth={hover === slice.categoryId ? STROKE + 4 : STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                opacity={dimmed ? 0.3 : 1}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHover(slice.categoryId)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(slice.categoryId)}
              />
            )
            offset += length
            return element
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">
            {active ? active.name : 'Total'}
          </span>
          <Money cents={active ? active.amount : total} className="text-base font-semibold" />
          {active && (
            <span className="text-[11px] text-muted-foreground">{formatPercent(active.share)}</span>
          )}
        </div>
      </div>

      <ul className="max-h-[210px] w-full min-w-0 space-y-1 overflow-y-auto scrollbar-thin pr-1">
        {slices.map((slice) => (
          <li key={slice.categoryId}>
            <button
              onMouseEnter={() => setHover(slice.categoryId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(slice.categoryId)}
              className={cn(
                'no-drag flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                hover === slice.categoryId ? 'bg-surface-hover' : 'hover:bg-surface-hover/60'
              )}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: `hsl(${slice.color} / 0.18)`, color: `hsl(${slice.color})` }}
              >
                <DynamicIcon name={slice.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs">{slice.name}</span>
              <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                {formatPercent(slice.share)}
              </span>
              <Money cents={slice.amount} className="shrink-0 text-xs font-medium" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

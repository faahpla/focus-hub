import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatMoney, formatMoneyCompact } from '../utils/money'
import type { SeriesPoint } from '../services/finance-engine'

type SeriesId = 'income' | 'expense' | 'balance'

const SERIES: { id: SeriesId; label: string; color: string }[] = [
  { id: 'income', label: 'Receitas', color: 'hsl(var(--success))' },
  { id: 'expense', label: 'Despesas', color: 'hsl(var(--destructive))' },
  { id: 'balance', label: 'Saldo', color: 'hsl(var(--primary))' }
]

const PAD = { left: 52, right: 14, top: 16, bottom: 26 }
const HEIGHT = 260

/** Track the container's width so the SVG can be drawn at real pixel size. */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Income and expense as grouped bars, running balance as a line.
 *
 * Bars and the balance line are scaled independently and each axis is labelled,
 * because a balance in the tens of thousands would otherwise flatten daily
 * movements of a few hundred reais into a straight line.
 */
export function TrendChart({ points }: { points: SeriesPoint[] }): JSX.Element {
  const [ref, width] = useWidth()
  const [visible, setVisible] = useState<Set<SeriesId>>(
    () => new Set<SeriesId>(['income', 'expense', 'balance'])
  )
  const [hover, setHover] = useState<number | null>(null)

  const toggle = (id: SeriesId): void =>
    setVisible((prev) => {
      const next = new Set(prev)
      // Never let the user turn every series off — an empty chart says nothing.
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else next.add(id)
      return next
    })

  const chart = useMemo(() => {
    const innerW = Math.max(0, width - PAD.left - PAD.right)
    const innerH = HEIGHT - PAD.top - PAD.bottom
    const barMax = Math.max(
      1,
      ...points.map((p) =>
        Math.max(visible.has('income') ? p.income : 0, visible.has('expense') ? p.expense : 0)
      )
    )
    const balances = points.map((p) => p.balance)
    const balMin = Math.min(0, ...balances)
    const balMax = Math.max(1, ...balances)
    const step = points.length > 0 ? innerW / points.length : 0

    const yBar = (value: number): number => PAD.top + innerH - (value / barMax) * innerH
    const yBal = (value: number): number =>
      PAD.top + innerH - ((value - balMin) / (balMax - balMin || 1)) * innerH
    const xCenter = (i: number): number => PAD.left + step * i + step / 2

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i).toFixed(1)} ${yBal(p.balance).toFixed(1)}`)
      .join(' ')
    const area =
      points.length > 0
        ? `${line} L ${xCenter(points.length - 1).toFixed(1)} ${PAD.top + innerH} L ${xCenter(0).toFixed(1)} ${PAD.top + innerH} Z`
        : ''

    return { innerW, innerH, barMax, balMin, balMax, step, yBar, yBal, xCenter, line, area }
  }, [points, width, visible])

  if (points.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Sem movimentações neste período.
      </div>
    )
  }

  const barWidth = Math.max(2, Math.min(14, chart.step / 3))
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  // Keep the axis readable: at most ~12 labels regardless of range.
  const labelEvery = Math.max(1, Math.ceil(points.length / 12))
  const active = hover !== null ? points[hover] : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SERIES.map((s) => {
          const on = visible.has(s.id)
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={cn(
                'no-drag flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                on
                  ? 'border-border bg-surface-elevated text-foreground'
                  : 'border-border/50 text-muted-foreground opacity-60 hover:opacity-100'
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color, opacity: on ? 1 : 0.4 }}
              />
              {s.label}
            </button>
          )
        })}
      </div>

      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            onMouseLeave={() => setHover(null)}
            className="overflow-visible"
          >
            {/* Horizontal grid + left axis (bars) */}
            {gridLines.map((t) => {
              const y = PAD.top + chart.innerH * t
              return (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                    strokeDasharray={t === 1 ? undefined : '3 4'}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {formatMoneyCompact(chart.barMax * (1 - t))}
                  </text>
                </g>
              )
            })}

            {/* Hover column */}
            {hover !== null && (
              <rect
                x={PAD.left + chart.step * hover}
                y={PAD.top}
                width={chart.step}
                height={chart.innerH}
                fill="hsl(var(--foreground))"
                opacity={0.04}
                rx={6}
              />
            )}

            {/* Bars */}
            {points.map((p, i) => {
              const center = chart.xCenter(i)
              const bars: JSX.Element[] = []
              if (visible.has('income') && p.income > 0) {
                const y = chart.yBar(p.income)
                bars.push(
                  <rect
                    key="in"
                    x={center - barWidth - 1}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, PAD.top + chart.innerH - y)}
                    rx={Math.min(3, barWidth / 2)}
                    fill="hsl(var(--success))"
                    opacity={0.85}
                  />
                )
              }
              if (visible.has('expense') && p.expense > 0) {
                const y = chart.yBar(p.expense)
                bars.push(
                  <rect
                    key="out"
                    x={center + 1}
                    y={y}
                    width={barWidth}
                    height={Math.max(1, PAD.top + chart.innerH - y)}
                    rx={Math.min(3, barWidth / 2)}
                    fill="hsl(var(--destructive))"
                    opacity={0.8}
                  />
                )
              }
              return <g key={p.key}>{bars}</g>
            })}

            {/* Balance line */}
            {visible.has('balance') && (
              <>
                <defs>
                  <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={chart.area} fill="url(#balanceFill)" />
                <path
                  d={chart.line}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {hover !== null && (
                  <circle
                    cx={chart.xCenter(hover)}
                    cy={chart.yBal(points[hover].balance)}
                    r={4}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                )}
              </>
            )}

            {/* X labels */}
            {points.map((p, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={`x-${p.key}`}
                  x={chart.xCenter(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {p.label}
                </text>
              ) : null
            )}

            {/* Invisible hit areas — one column per bucket. */}
            {points.map((p, i) => (
              <rect
                key={`hit-${p.key}`}
                x={PAD.left + chart.step * i}
                y={PAD.top}
                width={chart.step}
                height={chart.innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>
        )}

        {active && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[9.5rem] rounded-xl border border-border bg-surface-elevated p-2.5 text-xs shadow-elevated"
            style={{
              left: Math.min(Math.max(chart.xCenter(hover!) - 76, 0), Math.max(0, width - 160))
            }}
          >
            <p className="mb-1.5 font-semibold">{active.label}</p>
            <Row label="Receitas" value={active.income} color="text-success" />
            <Row label="Despesas" value={active.expense} color="text-destructive" />
            <Row label="Saldo" value={active.balance} color="text-primary" />
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('tabular font-medium', color)}>{formatMoney(value)}</span>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Receipt, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import { Money } from '../components/money'
import { DonutChart } from '../components/donut-chart'
import { SegmentedControl } from '../components/form'
import { useFinance } from '../hooks/use-finance'
import {
  type ComparisonRow,
  buildEvolution,
  buildMonthReport,
  buildYearReport,
  compareMonths
} from '../services/reports-service'
import { formatMoneyCompact, formatPercent } from '../utils/money'
import { addMonthsToKey, monthLabel } from '../utils/dates'

type Scope = 'month' | 'year'

export function ReportsPage(): JSX.Element {
  const finance = useFinance()
  const month = useFinanceUi((s) => s.month)
  const [scope, setScope] = useState<Scope>('month')
  const [against, setAgainst] = useState(() => addMonthsToKey(month, -1))

  const report = useMemo(() => buildMonthReport(finance, month), [finance, month])
  const year = useMemo(() => buildYearReport(finance, month.slice(0, 4)), [finance, month])
  const evolution = useMemo(() => buildEvolution(finance, 12), [finance])
  const comparison = useMemo(
    () => compareMonths(finance, month, against),
    [finance, month, against]
  )

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const key = addMonthsToKey(month, -(i + 1))
        return { value: key, label: monthLabel(key) }
      }),
    [month]
  )

  const active = scope === 'month' ? report : null

  return (
    <div className="space-y-5 px-8 pb-24">
      <SegmentedControl<Scope>
        value={scope}
        onChange={setScope}
        className="max-w-xs"
        options={[
          { value: 'month', label: monthLabel(month) },
          { value: 'year', label: `Ano de ${month.slice(0, 4)}` }
        ]}
      />

      {/* Headline */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Receitas" value={scope === 'month' ? report.income : year.income} tone="success" />
        <Stat label="Despesas" value={scope === 'month' ? report.expense : year.expense} tone="destructive" />
        <Stat label="Saldo" value={scope === 'month' ? report.net : year.net} tone="primary" />
        <Card className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Taxa de economia</p>
          <p className="text-lg font-semibold tabular">
            {scope === 'month'
              ? formatPercent(report.savingsRate, 1)
              : formatPercent(year.income > 0 ? year.net / year.income : 0, 1)}
          </p>
          <p className="text-[11px] text-muted-foreground">do que entrou, sobrou</p>
        </Card>
      </div>

      {/* Evolution */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Evolução patrimonial (12 meses)</h3>
        <EvolutionBars points={evolution} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Categories */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">
            Gastos por categoria · {scope === 'month' ? monthLabel(month) : year.year}
          </h3>
          <DonutChart slices={scope === 'month' ? report.categories : year.categories} />
        </Card>

        {/* Highlights */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Destaques</h3>
          <div className="space-y-2.5">
            {scope === 'month' ? (
              <>
                <Highlight
                  icon={<Receipt className="h-4 w-4" />}
                  label="Maior gasto"
                  title={active?.biggestExpense?.description ?? '—'}
                  value={active?.biggestExpense?.amount}
                />
                <Highlight
                  icon={<ArrowUp className="h-4 w-4" />}
                  label="Maior categoria"
                  title={active?.topCategory?.name ?? '—'}
                  value={active?.topCategory?.amount}
                />
                <Highlight
                  icon={<Minus className="h-4 w-4" />}
                  label="Transações no mês"
                  title={`${report.transactionCount} lançamento(s)`}
                />
              </>
            ) : (
              <>
                <Highlight
                  icon={<Trophy className="h-4 w-4" />}
                  label="Melhor mês"
                  title={year.bestMonth?.label ?? '—'}
                  value={year.bestMonth?.net}
                />
                <Highlight
                  icon={<ArrowDown className="h-4 w-4" />}
                  label="Mês mais apertado"
                  title={year.worstMonth?.label ?? '—'}
                  value={year.worstMonth?.net}
                />
                <Highlight
                  icon={<ArrowUp className="h-4 w-4" />}
                  label="Maior categoria do ano"
                  title={year.categories[0]?.name ?? '—'}
                  value={year.categories[0]?.amount}
                />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Comparison */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Comparar {monthLabel(month)} com</h3>
          <Select<string>
            value={against}
            options={monthOptions}
            onChange={setAgainst}
            align="end"
            className="w-44"
          />
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {comparison.headline.map((row) => (
            <ComparisonCard key={row.label} row={row} />
          ))}
        </div>

        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
          O que mais mudou por categoria
        </h4>
        <div className="space-y-1">
          {comparison.categories.slice(0, 8).map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-hover/60"
            >
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <Money cents={row.previous} className="w-24 shrink-0 text-right text-xs text-muted-foreground" />
              <span className="text-xs text-muted-foreground">→</span>
              <Money cents={row.current} className="w-24 shrink-0 text-right text-xs" />
              <span
                className={cn(
                  'w-20 shrink-0 text-right text-xs tabular font-medium',
                  row.delta > 0 ? 'text-destructive' : row.delta < 0 ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {row.ratio !== undefined
                  ? `${row.delta > 0 ? '+' : ''}${formatPercent(row.ratio)}`
                  : row.delta !== 0
                    ? 'novo'
                    : '—'}
              </span>
            </div>
          ))}
          {comparison.categories.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem dados suficientes para comparar.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  tone
}: {
  label: string
  value: number
  tone: 'success' | 'destructive' | 'primary'
}): JSX.Element {
  return (
    <Card className="p-4">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <Money
        cents={value}
        className={cn(
          'text-lg font-semibold',
          tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : ''
        )}
        colored={tone === 'primary'}
      />
    </Card>
  )
}

function Highlight({
  icon,
  label,
  title,
  value
}: {
  icon: React.ReactNode
  label: string
  title: string
  value?: number
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{title}</p>
      </div>
      {value !== undefined && <Money cents={value} className="shrink-0 text-sm font-semibold" />}
    </div>
  )
}

function ComparisonCard({ row }: { row: ComparisonRow }): JSX.Element {
  // For expenses "up" is bad; for income and balance "up" is good. Labels are
  // fixed strings from compareMonths, so the mapping is safe to hardcode.
  const goodWhenUp = row.label !== 'Despesas'
  const up = row.delta > 0
  const positive = row.delta === 0 ? null : up === goodWhenUp

  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <p className="mb-1 text-xs text-muted-foreground">{row.label}</p>
      <Money cents={row.current} className="block text-base font-semibold" />
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            'flex items-center gap-0.5 tabular font-medium',
            positive === null
              ? 'text-muted-foreground'
              : positive
                ? 'text-success'
                : 'text-destructive'
          )}
        >
          {row.delta !== 0 && (up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          {row.ratio !== undefined ? formatPercent(Math.abs(row.ratio)) : '—'}
        </span>
        <span className="text-muted-foreground">
          antes <Money cents={row.previous} />
        </span>
      </div>
    </div>
  )
}

function EvolutionBars({
  points
}: {
  points: { month: string; label: string; balance: number }[]
}): JSX.Element {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.balance)))

  return (
    <div className="flex items-end gap-1.5 overflow-x-auto scrollbar-thin pb-1">
      {points.map((point) => {
        const height = Math.max(3, (Math.abs(point.balance) / max) * 100)
        const negative = point.balance < 0
        return (
          <div key={point.month} className="flex min-w-[3rem] flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular text-muted-foreground">
              {formatMoneyCompact(point.balance).replace('R$ ', '')}
            </span>
            <div className="flex h-28 w-full items-end">
              <div
                className={cn(
                  'w-full rounded-t-md transition-all',
                  negative ? 'bg-destructive/70' : 'bg-primary/70'
                )}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{point.label.slice(0, 3)}</span>
          </div>
        )
      })}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { CalendarRange, Layers } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { cn } from '@/lib/utils'
import type { Transaction } from '@shared/finance'
import { Money } from '../components/money'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { useFinance } from '../hooks/use-finance'
import { installmentGroups } from '../services/finance-engine'
import { forecastByMonth } from '../services/installments-service'
import { percent } from '../utils/money'
import { addMonthsToKey, currentMonth, dayLabel, monthLabel, monthsBetween } from '../utils/dates'

export function InstallmentsPage(): JSX.Element {
  const finance = useFinance()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const groups = useMemo(() => installmentGroups(finance.transactions), [finance.transactions])
  const open = groups.filter((g) => g.remaining > 0)
  const closed = groups.filter((g) => g.remaining === 0)

  const forecast = useMemo(() => {
    const months = monthsBetween(currentMonth(), addMonthsToKey(currentMonth(), 11))
    return forecastByMonth(finance.transactions, months)
  }, [finance.transactions])

  const committed = open.reduce((sum, g) => sum + g.remaining, 0)
  const peak = Math.max(1, ...forecast.map((f) => f.amount))
  const finishesAt = open.length > 0 ? open.map((g) => g.lastDate).sort().pop() : undefined

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Layers className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Nenhum parcelamento ativo</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Ao lançar uma compra, escolha o número de parcelas — cada uma vira um lançamento futuro
          e aparece aqui e no calendário.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-8 pb-24">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Comprometido" value={committed} accent />
        <Summary label="Parcelamentos abertos" text={`${open.length}`} />
        <Summary
          label="Termina em"
          text={finishesAt ? dayLabel(finishesAt) : '—'}
          icon={<CalendarRange className="h-4 w-4" />}
        />
      </div>

      {/* Forecast */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Parcelas futuras por mês</h3>
        <div className="flex items-end gap-2 overflow-x-auto scrollbar-thin pb-2">
          {forecast.map((point) => (
            <div key={point.month} className="flex min-w-[3.25rem] flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular text-muted-foreground">
                {point.amount > 0 ? (point.amount / 100).toFixed(0) : ''}
              </span>
              <div className="flex h-24 w-full items-end">
                <div
                  className={cn(
                    'w-full rounded-t-md transition-all',
                    point.amount > 0 ? 'bg-primary/70' : 'bg-muted/40'
                  )}
                  style={{ height: `${Math.max(3, (point.amount / peak) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {monthLabel(point.month).slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Section title="Em andamento" groups={open} openGroup={openGroup} setOpenGroup={setOpenGroup} onOpenTx={setEditingTx} />
      {closed.length > 0 && (
        <Section title="Concluídos" groups={closed} openGroup={openGroup} setOpenGroup={setOpenGroup} onOpenTx={setEditingTx} />
      )}

      {editingTx && <TransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />}
    </div>
  )
}

function Section({
  title,
  groups,
  openGroup,
  setOpenGroup,
  onOpenTx
}: {
  title: string
  groups: ReturnType<typeof installmentGroups>
  openGroup: string | null
  setOpenGroup: (id: string | null) => void
  onOpenTx: (tx: Transaction) => void
}): JSX.Element | null {
  const finance = useFinance()
  if (groups.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="space-y-2">
        {groups.map((group) => {
          const card = finance.cards.find((c) => c.id === group.cardId)
          const category = finance.categories.find((c) => c.id === group.categoryId)
          const expanded = openGroup === group.groupId
          return (
            <Card key={group.groupId} className="p-4">
              <button
                onClick={() => setOpenGroup(expanded ? null : group.groupId)}
                className="no-drag flex w-full items-center gap-3 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `hsl(${category?.color ?? '250 82% 68%'} / 0.15)`,
                    color: `hsl(${category?.color ?? '250 82% 68%'})`
                  }}
                >
                  <DynamicIcon name={category?.icon ?? 'Layers'} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{group.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.paidCount}/{group.totalCount} pagas · <Money cents={group.perParcel} />{' '}
                    por mês{card ? ` · ${card.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money cents={group.remaining} className="block text-sm font-semibold" />
                  <span className="text-[11px] text-muted-foreground">
                    de <Money cents={group.total} />
                  </span>
                </div>
              </button>

              <div className="mt-3">
                <ProgressBar
                  value={percent(group.paidCount, group.totalCount)}
                  indicatorClassName={group.remaining === 0 ? 'bg-success' : undefined}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Última parcela em {dayLabel(group.lastDate)}
                </p>
              </div>

              {expanded && (
                <div className="mt-3 border-t border-border/50 pt-3">
                  <TransactionList transactions={group.transactions} onOpen={onOpenTx} />
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Summary({
  label,
  value,
  text,
  accent,
  icon
}: {
  label: string
  value?: number
  text?: string
  accent?: boolean
  icon?: React.ReactNode
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        accent ? 'border-primary/25 bg-primary/[0.07]' : 'border-border/70 bg-surface/60'
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      {value !== undefined ? (
        <Money cents={value} className="text-xl font-semibold" />
      ) : (
        <span className="text-xl font-semibold">{text}</span>
      )}
    </div>
  )
}

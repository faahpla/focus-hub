import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionType } from '@shared/finance'
import { Money } from '../components/money'
import { TrendChart } from '../components/trend-chart'
import { DonutChart } from '../components/donut-chart'
import { TransactionDialog } from '../components/transaction-dialog'
import { TransactionList } from '../components/transaction-list'
import { AlertsPanel } from '../components/alerts-panel'
import { useFinance, useInsights } from '../hooks/use-finance'
import {
  RANGE_LABEL,
  type RangeKey,
  buildSeries,
  categoryBreakdown,
  monthTotals,
  totalBalance,
  transactionsInMonth
} from '../services/finance-engine'
import { percent } from '../utils/money'
import { currentMonth, monthLabel } from '@/lib/dates'

export function DashboardPage(): JSX.Element {
  const finance = useFinance()
  const saveFinanceSettings = useAppStore((s) => s.saveFinanceSettings)
  const setTab = useFinanceUi((s) => s.setTab)
  const month = useFinanceUi((s) => s.month)

  const [range, setRange] = useState<RangeKey>('30d')
  const [composing, setComposing] = useState<TransactionType | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const insights = useInsights(month)

  const { balance, totals, series, slices, recent } = useMemo(() => {
    const rows = transactionsInMonth(finance.transactions, month)
    return {
      balance: totalBalance(finance),
      totals: monthTotals(finance.transactions, month),
      series: buildSeries(finance, range),
      slices: categoryBreakdown(rows, finance.categories, 'expense'),
      recent: [...finance.transactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
    }
  }, [finance, month, range])

  const goal = finance.goals
    .filter((g) => !g.archived && g.currentAmount < g.targetAmount)
    .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)[0]

  const isCurrent = month === currentMonth()

  return (
    <div className="space-y-5 px-8 pb-24">
      {/* Headline balance */}
      <Card className="relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: 'hsl(var(--primary))' }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Saldo total</p>
              <button
                onClick={() =>
                  void saveFinanceSettings({ hideValues: !finance.settings.hideValues })
                }
                className="no-drag text-muted-foreground transition-colors hover:text-foreground"
                title={finance.settings.hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {finance.settings.hideValues ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <Money
              cents={balance}
              className="mt-1 block text-4xl font-semibold tracking-tight"
              colored={balance < 0}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {finance.accounts.filter((a) => !a.archived).length} conta(s) ·{' '}
              {isCurrent ? 'este mês' : monthLabel(month)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label="Receitas"
              value={totals.income}
              tone="success"
            />
            <MiniStat
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              label="Despesas"
              value={totals.expense}
              tone="destructive"
            />
            <MiniStat
              icon={<Wallet className="h-3.5 w-3.5" />}
              label="Sobrou"
              value={totals.net}
              tone={totals.net >= 0 ? 'primary' : 'destructive'}
            />
          </div>
        </div>

        {(totals.pendingExpense > 0 || totals.pendingIncome > 0) && (
          <div className="relative mt-4 flex flex-wrap gap-4 border-t border-border/50 pt-3 text-xs">
            {totals.pendingIncome > 0 && (
              <button
                onClick={() => setTab('transactions')}
                className="no-drag text-muted-foreground transition-colors hover:text-foreground"
              >
                A receber: <Money cents={totals.pendingIncome} className="text-success" />
              </button>
            )}
            {totals.pendingExpense > 0 && (
              <button
                onClick={() => setTab('transactions')}
                className="no-drag text-muted-foreground transition-colors hover:text-foreground"
              >
                A pagar: <Money cents={totals.pendingExpense} className="text-destructive" />
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickAction
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Receber"
          tone="success"
          onClick={() => setComposing('income')}
        />
        <QuickAction
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Pagar"
          tone="destructive"
          onClick={() => setComposing('expense')}
        />
        <QuickAction
          icon={<Plus className="h-4 w-4" />}
          label="Transação"
          tone="primary"
          onClick={() => setComposing('expense')}
        />
        <QuickAction
          icon={<ArrowLeftRight className="h-4 w-4" />}
          label="Transferir"
          onClick={() => setComposing('transfer')}
        />
        <QuickAction
          icon={<CreditCard className="h-4 w-4" />}
          label="Cartões"
          onClick={() => setTab('cards')}
        />
        <QuickAction
          icon={<Target className="h-4 w-4" />}
          label="Metas"
          onClick={() => setTab('goals')}
        />
      </div>

      <AlertsPanel />

      {/* Chart */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Movimentação</h3>
          <div className="flex gap-1 rounded-xl border border-border/70 bg-surface/50 p-1">
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={cn(
                  'no-drag rounded-lg px-2.5 py-1 text-xs font-medium transition-all',
                  range === key
                    ? 'bg-surface-elevated text-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {RANGE_LABEL[key]}
              </button>
            ))}
          </div>
        </div>
        <TrendChart points={series} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Distribution */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Distribuição de gastos</h3>
            <span className="text-xs text-muted-foreground">{monthLabel(month)}</span>
          </div>
          <DonutChart slices={slices} onSelect={() => setTab('transactions')} />
        </Card>

        {/* Insights */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Insights</h3>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Registre algumas semanas de movimentação e as análises aparecem aqui
              automaticamente.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {insights.map((insight, i) => (
                <motion.li
                  key={insight.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-surface/40 p-3"
                >
                  <span
                    className={cn(
                      'mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                      insight.tone === 'good'
                        ? 'bg-success/15 text-success'
                        : insight.tone === 'bad'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/15 text-primary'
                    )}
                  >
                    <DynamicIcon name={insight.icon} className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs leading-relaxed">{insight.text}</p>
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Goal + recent */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Meta principal</h3>
            <Button size="sm" variant="ghost" onClick={() => setTab('goals')}>
              Ver todas
            </Button>
          </div>
          {goal ? (
            <button
              onClick={() => setTab('goals', goal.id)}
              className="no-drag block w-full text-left"
            >
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `hsl(${goal.color} / 0.15)`, color: `hsl(${goal.color})` }}
                >
                  <DynamicIcon name={goal.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{goal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <Money cents={goal.currentAmount} /> de <Money cents={goal.targetAmount} />
                  </p>
                </div>
              </div>
              <ProgressBar value={percent(goal.currentAmount, goal.targetAmount)} />
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma meta em andamento. Criar uma é a forma mais rápida de dar destino ao que
              sobra.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Últimas transações</h3>
            <Button size="sm" variant="ghost" onClick={() => setTab('transactions')}>
              Ver todas
            </Button>
          </div>
          <TransactionList
            transactions={recent}
            onOpen={setEditing}
            empty="Nada lançado ainda. Comece por “Transação”."
          />
        </Card>
      </div>

      {composing && (
        <TransactionDialog defaultType={composing} onClose={() => setComposing(null)} />
      )}
      {editing && (
        <TransactionDialog transaction={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'success' | 'destructive' | 'primary'
}): JSX.Element {
  const toneClass = {
    success: 'bg-success/12 text-success',
    destructive: 'bg-destructive/12 text-destructive',
    primary: 'bg-primary/12 text-primary'
  }[tone]

  return (
    <div className="min-w-[7rem] rounded-xl border border-border/60 bg-surface/50 p-3">
      <div className={cn('mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg', toneClass)}>
        {icon}
      </div>
      <Money cents={value} className="block text-sm font-semibold" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  tone,
  onClick
}: {
  icon: React.ReactNode
  label: string
  tone?: 'success' | 'destructive' | 'primary'
  onClick: () => void
}): JSX.Element {
  const toneClass = tone
    ? {
        success: 'bg-success/12 text-success',
        destructive: 'bg-destructive/12 text-destructive',
        primary: 'bg-primary/12 text-primary'
      }[tone]
    : 'bg-surface-elevated text-muted-foreground'

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="no-drag flex items-center gap-2.5 rounded-2xl border border-border/70 bg-surface/60 p-3 text-left transition-colors hover:border-border hover:bg-surface-hover"
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', toneClass)}>
        {icon}
      </span>
      <span className="truncate text-sm font-medium">{label}</span>
    </motion.button>
  )
}

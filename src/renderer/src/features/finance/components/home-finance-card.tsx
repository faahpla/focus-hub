import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingDown, Wallet } from 'lucide-react'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DynamicIcon } from '@/components/dynamic-icon'
import { useAppStore } from '@/stores/app-store'
import { useFinanceUi } from '@/stores/finance-ui-store'
import { cn } from '@/lib/utils'
import { Money } from './money'
import { monthTotals, totalBalance } from '../services/finance-engine'
import { buildAlerts } from '../services/alerts-service'
import { percent } from '../utils/money'
import { currentMonth } from '@/lib/dates'

/**
 * The finance strip on the Focus HUB home screen: balance, what left this
 * month, what was saved, and the leading goal. Hidden entirely until there is
 * something to show, so it never competes with the timer on day one.
 */
export function HomeFinanceCard(): JSX.Element | null {
  const finance = useAppStore((s) => s.finance)
  const setTab = useFinanceUi((s) => s.setTab)
  const navigate = useNavigate()

  const { balance, totals, urgent } = useMemo(
    () => ({
      balance: totalBalance(finance),
      totals: monthTotals(finance.transactions, currentMonth()),
      urgent: buildAlerts(finance).filter((a) => a.severity === 'danger').length
    }),
    [finance]
  )

  if (!finance.settings.showOnHome) return null
  if (finance.accounts.length === 0 && finance.transactions.length === 0) return null

  const goal = finance.goals
    .filter((g) => !g.archived && g.currentAmount < g.targetAmount)
    .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)[0]

  const open = (tab: Parameters<typeof setTab>[0] = 'dashboard'): void => {
    setTab(tab)
    navigate('/finance')
  }

  return (
    <button
      onClick={() => open()}
      className="no-drag group w-full rounded-2xl border border-border/70 bg-surface/60 p-4 text-left transition-colors hover:border-border hover:bg-surface-hover"
    >
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Finance HUB</span>
        {urgent > 0 && (
          <span className="rounded-full bg-destructive/15 px-1.5 py-px text-[10px] font-semibold text-destructive">
            {urgent} urgente{urgent > 1 ? 's' : ''}
          </span>
        )}
        <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Cell label="Saldo">
          <Money cents={balance} colored={balance < 0} className="text-sm font-semibold" />
        </Cell>
        <Cell label="Gastos do mês">
          <Money cents={totals.expense} className="text-sm font-semibold text-destructive" />
        </Cell>
        <Cell label="Economia">
          <Money cents={totals.net} colored className="text-sm font-semibold" />
        </Cell>
      </div>

      {goal && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{ background: `hsl(${goal.color} / 0.15)`, color: `hsl(${goal.color})` }}
            >
              <DynamicIcon name={goal.icon} className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs">{goal.name}</span>
            <Money cents={goal.targetAmount - goal.currentAmount} className="text-[11px] text-muted-foreground" />
          </div>
          <ProgressBar value={percent(goal.currentAmount, goal.targetAmount)} className="h-1.5" />
        </div>
      )}

      {totals.pendingExpense > 0 && (
        <p className={cn('mt-2 flex items-center gap-1 text-[11px] text-muted-foreground')}>
          <TrendingDown className="h-3 w-3" />
          <Money cents={totals.pendingExpense} className="text-foreground" /> a pagar ainda este mês
        </p>
      )}
    </button>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

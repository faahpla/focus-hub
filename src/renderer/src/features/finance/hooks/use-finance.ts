import { useEffect, useMemo, useRef } from 'react'
import type { FinanceData } from '@shared/finance'
import { useAppStore } from '@/stores/app-store'
import { materializeRecurring } from '../services/recurrence-service'
import { buildAlerts, type FinanceAlert } from '../services/alerts-service'
import { buildInsights, type Insight } from '../services/insights-service'
import { totalBalance, monthTotals, type PeriodTotals } from '../services/finance-engine'
import { currentMonth, type MonthKey } from '@/lib/dates'

/**
 * The finance branch of the document.
 *
 * Zustand v5 note: this returns the stored object by reference. Selectors that
 * build a new array or object on every call re-render forever — every derived
 * value below goes through `useMemo` keyed on this reference instead.
 */
export function useFinance(): FinanceData {
  return useAppStore((s) => s.finance)
}

export function useFinanceTotals(month: MonthKey = currentMonth()): PeriodTotals & {
  balance: number
} {
  const finance = useFinance()
  return useMemo(
    () => ({ ...monthTotals(finance.transactions, month), balance: totalBalance(finance) }),
    [finance, month]
  )
}

export function useAlerts(): FinanceAlert[] {
  const finance = useFinance()
  return useMemo(() => buildAlerts(finance), [finance])
}

export function useInsights(month: MonthKey = currentMonth()): Insight[] {
  const finance = useFinance()
  return useMemo(() => buildInsights(finance, month), [finance, month])
}

/**
 * Materialise recurring bills and income once per app run.
 *
 * Generation is idempotent (deterministic ids), but the write itself is not
 * free, so the guard keeps it to a single pass even though the store updates
 * many times while the module is open.
 */
export function useRecurringGeneration(): void {
  const recurring = useAppStore((s) => s.finance.recurring)
  const transactions = useAppStore((s) => s.finance.transactions)
  const saveFinance = useAppStore((s) => s.saveFinance)
  const done = useRef(false)

  useEffect(() => {
    if (done.current || recurring.length === 0) return
    const created = materializeRecurring(recurring, transactions)
    done.current = true
    if (created.length > 0) void saveFinance('transactions', created)
  }, [recurring, transactions, saveFinance])
}

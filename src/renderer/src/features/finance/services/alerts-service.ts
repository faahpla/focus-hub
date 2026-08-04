/**
 * Alerts — things that need attention now, not analysis of the past.
 *
 * Each alert carries an `actionId` so the UI can jump straight to what it is
 * talking about instead of leaving the user to hunt for it.
 */

import type { FinanceData } from '@shared/finance'
import { type DayKey, currentMonth, diffDays, relativeDayLabel, today } from '../utils/dates'
import { formatMoney, formatPercent } from '../utils/money'
import { cardUsage, monthTotals } from './finance-engine'
import { averageMonthlyExpense } from './reports-service'

export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success'

export interface FinanceAlert {
  id: string
  severity: AlertSeverity
  icon: string
  title: string
  detail: string
  /** Where clicking should take the user. */
  target?: { tab: string; id?: string }
  date?: DayKey
}

export function buildAlerts(data: FinanceData): FinanceAlert[] {
  if (!data.settings.alertsEnabled) return []

  const out: FinanceAlert[] = []
  const todayKey = today()
  const window = data.settings.dueSoonDays

  // ---- Bills due or overdue -------------------------------------------
  const pending = data.transactions
    .filter((t) => !t.paid && t.type === 'expense')
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of pending) {
    const days = diffDays(todayKey, tx.date)
    if (days > window) continue
    const overdue = days < 0
    out.push({
      id: `due-${tx.id}`,
      severity: overdue ? 'danger' : days <= 1 ? 'warning' : 'info',
      icon: overdue ? 'AlertTriangle' : 'CalendarClock',
      title: overdue ? `${tx.description} venceu` : `${tx.description} vence ${relativeDayLabel(tx.date).toLowerCase()}`,
      detail: `${formatMoney(tx.amount)}${overdue ? ` · ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'} em atraso` : ''}`,
      target: { tab: 'transactions', id: tx.id },
      date: tx.date
    })
  }

  // ---- Income expected -------------------------------------------------
  for (const tx of data.transactions.filter((t) => !t.paid && t.type === 'income')) {
    const days = diffDays(todayKey, tx.date)
    if (days < -30 || days > window) continue
    out.push({
      id: `income-${tx.id}`,
      severity: days < 0 ? 'warning' : 'info',
      icon: 'ArrowDownLeft',
      title: days < 0 ? `${tx.description} ainda não caiu` : `${tx.description} previsto`,
      detail: `${formatMoney(tx.amount)} · ${relativeDayLabel(tx.date)}`,
      target: { tab: 'transactions', id: tx.id },
      date: tx.date
    })
  }

  // ---- Card limits and invoices ----------------------------------------
  for (const card of data.cards.filter((c) => !c.archived)) {
    const usage = cardUsage(card, data.transactions)
    if (card.limit > 0 && usage.ratio >= data.settings.cardAlertThreshold) {
      out.push({
        id: `limit-${card.id}`,
        severity: usage.ratio >= 0.95 ? 'danger' : 'warning',
        icon: 'CreditCard',
        title: `${card.name} com ${formatPercent(usage.ratio)} do limite usado`,
        detail: `Restam ${formatMoney(usage.available)} de ${formatMoney(card.limit)}`,
        target: { tab: 'cards', id: card.id }
      })
    }
    const invoice = usage.nextInvoice
    if (invoice && !invoice.paid && invoice.total > 0) {
      const days = diffDays(todayKey, invoice.dueDate)
      if (days <= window) {
        out.push({
          id: `invoice-${card.id}-${invoice.month}`,
          severity: days < 0 ? 'danger' : 'warning',
          icon: 'Receipt',
          title:
            days < 0
              ? `Fatura do ${card.name} venceu`
              : `Fatura do ${card.name} vence ${relativeDayLabel(invoice.dueDate).toLowerCase()}`,
          detail: formatMoney(invoice.total),
          target: { tab: 'cards', id: card.id },
          date: invoice.dueDate
        })
      }
    }
  }

  // ---- Spending pace ---------------------------------------------------
  const average = averageMonthlyExpense(data, 3)
  const totals = monthTotals(data.transactions, currentMonth())
  if (average > 0 && totals.expense > average * 1.25) {
    out.push({
      id: 'pace',
      severity: 'warning',
      icon: 'Activity',
      title: 'Gasto acima da média',
      detail: `${formatMoney(totals.expense)} este mês contra ${formatMoney(average)} de média`,
      target: { tab: 'reports' }
    })
  }

  // ---- Budget breaches -------------------------------------------------
  const plan = data.budgets.find((b) => b.month === currentMonth())
  if (plan) {
    if (plan.spendLimit > 0 && totals.expense > plan.spendLimit) {
      out.push({
        id: 'budget-total',
        severity: 'danger',
        icon: 'Gauge',
        title: 'Orçamento do mês estourado',
        detail: `${formatMoney(totals.expense)} de um teto de ${formatMoney(plan.spendLimit)}`,
        target: { tab: 'budget' }
      })
    }
    for (const entry of plan.categories) {
      if (entry.limit <= 0) continue
      const spent = data.transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.paid &&
            t.categoryId === entry.categoryId &&
            t.date.startsWith(currentMonth())
        )
        .reduce((sum, t) => sum + t.amount, 0)
      if (spent <= entry.limit) continue
      const category = data.categories.find((c) => c.id === entry.categoryId)
      out.push({
        id: `budget-${entry.categoryId}`,
        severity: 'warning',
        icon: 'Gauge',
        title: `${category?.name ?? 'Categoria'} passou do planejado`,
        detail: `${formatMoney(spent)} de ${formatMoney(entry.limit)}`,
        target: { tab: 'budget' }
      })
    }
  }

  // ---- Goals close to done ---------------------------------------------
  for (const goal of data.goals.filter((g) => !g.archived)) {
    if (goal.targetAmount <= 0) continue
    const ratio = goal.currentAmount / goal.targetAmount
    if (ratio >= 1) {
      out.push({
        id: `goal-${goal.id}`,
        severity: 'success',
        icon: 'PartyPopper',
        title: `Meta “${goal.name}” concluída`,
        detail: formatMoney(goal.targetAmount),
        target: { tab: 'goals', id: goal.id }
      })
    } else if (ratio >= 0.9) {
      out.push({
        id: `goal-${goal.id}`,
        severity: 'info',
        icon: 'Target',
        title: `Meta “${goal.name}” quase lá`,
        detail: `Faltam ${formatMoney(goal.targetAmount - goal.currentAmount)}`,
        target: { tab: 'goals', id: goal.id }
      })
    }
  }

  const rank: Record<AlertSeverity, number> = { danger: 0, warning: 1, success: 2, info: 3 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.date ?? '').localeCompare(b.date ?? ''))
}

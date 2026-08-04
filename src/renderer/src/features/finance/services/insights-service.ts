/**
 * Insights — the short sentences on the dashboard that say what the numbers
 * mean. Each rule only fires when it has enough history to be honest; a chart
 * with three transactions in it should not be told it's having a great month.
 */

import type { FinanceData } from '@shared/finance'
import { type MonthKey, addMonthsToKey, currentMonth, monthLabel } from '../utils/dates'
import { formatMoney, formatPercent } from '../utils/money'
import { categoryBreakdown, monthTotals, transactionsInMonth } from './finance-engine'
import { averageMonthlyExpense, buildMonthReport } from './reports-service'

export type InsightTone = 'good' | 'bad' | 'neutral'

export interface Insight {
  id: string
  icon: string
  tone: InsightTone
  text: string
}

/** Rules need at least this many rows in a month to say anything about it. */
const MIN_ROWS = 4

export function buildInsights(data: FinanceData, month: MonthKey = currentMonth()): Insight[] {
  const out: Insight[] = []
  const previous = addMonthsToKey(month, -1)
  const rows = transactionsInMonth(data.transactions, month)
  const totals = monthTotals(data.transactions, month)
  const prevTotals = monthTotals(data.transactions, previous)
  const hasHistory = transactionsInMonth(data.transactions, previous).length >= MIN_ROWS

  // ---- Category swings ------------------------------------------------
  if (hasHistory) {
    const current = categoryBreakdown(rows, data.categories, 'expense')
    const before = categoryBreakdown(
      transactionsInMonth(data.transactions, previous),
      data.categories,
      'expense'
    )
    for (const slice of current.slice(0, 6)) {
      const past = before.find((c) => c.categoryId === slice.categoryId)
      if (!past || past.amount < 5000) continue // ignore noise under R$ 50
      const ratio = (slice.amount - past.amount) / past.amount
      if (Math.abs(ratio) < 0.15) continue
      out.push({
        id: `cat-${slice.categoryId}`,
        icon: ratio > 0 ? 'TrendingUp' : 'TrendingDown',
        tone: ratio > 0 ? 'bad' : 'good',
        text:
          ratio > 0
            ? `Você gastou ${formatPercent(ratio)} a mais com ${slice.name} que em ${monthLabel(previous)}.`
            : `Seu gasto com ${slice.name} caiu ${formatPercent(Math.abs(ratio))} em relação a ${monthLabel(previous)}.`
      })
      if (out.length >= 3) break
    }
  }

  // ---- Savings --------------------------------------------------------
  if (totals.income > 0 && totals.net > 0) {
    out.push({
      id: 'saved',
      icon: 'PiggyBank',
      tone: 'good',
      text: `Você economizou ${formatMoney(totals.net)} este mês — ${formatPercent(totals.net / totals.income)} do que entrou.`
    })
  } else if (totals.net < 0 && rows.length >= MIN_ROWS) {
    out.push({
      id: 'negative',
      icon: 'AlertTriangle',
      tone: 'bad',
      text: `Você gastou ${formatMoney(Math.abs(totals.net))} a mais do que recebeu este mês.`
    })
  }

  // ---- Best month ever ------------------------------------------------
  if (hasHistory && totals.net > 0) {
    const history = [-1, -2, -3, -4, -5]
      .map((d) => monthTotals(data.transactions, addMonthsToKey(month, d)).net)
      .filter((n) => n !== 0)
    if (history.length >= 3 && totals.net > Math.max(...history)) {
      out.push({
        id: 'best-month',
        icon: 'Trophy',
        tone: 'good',
        text: 'Este foi seu melhor mês em saldo dos últimos seis.'
      })
    }
  }

  // ---- Pace against the average ---------------------------------------
  const average = averageMonthlyExpense(data, 3)
  if (average > 0 && totals.expense > average * 1.2 && rows.length >= MIN_ROWS) {
    out.push({
      id: 'above-average',
      icon: 'Activity',
      tone: 'bad',
      text: `Suas despesas estão ${formatPercent(totals.expense / average - 1)} acima da sua média dos últimos 3 meses.`
    })
  }

  // ---- Goals ----------------------------------------------------------
  const monthlySaving = totals.net > 0 ? totals.net : prevTotals.net
  for (const goal of data.goals.filter((g) => !g.archived)) {
    const missing = goal.targetAmount - goal.currentAmount
    if (missing <= 0) {
      out.push({
        id: `goal-done-${goal.id}`,
        icon: 'PartyPopper',
        tone: 'good',
        text: `Meta “${goal.name}” concluída. Bateu os ${formatMoney(goal.targetAmount)}.`
      })
      continue
    }
    if (monthlySaving > 0) {
      const months = Math.ceil(missing / monthlySaving)
      if (months <= 60) {
        out.push({
          id: `goal-eta-${goal.id}`,
          icon: 'Target',
          tone: 'neutral',
          text: `Nesse ritmo você atinge “${goal.name}” em ${months} ${months === 1 ? 'mês' : 'meses'}.`
        })
      }
    }
  }

  // ---- Subscriptions --------------------------------------------------
  const subscriptions = data.recurring.filter((r) => r.active && r.type === 'expense')
  if (subscriptions.length >= 2) {
    const monthly = subscriptions.reduce(
      (sum, r) => sum + (r.frequency === 'yearly' ? Math.round(r.amount / 12) : r.amount),
      0
    )
    if (monthly > 0) {
      out.push({
        id: 'fixed-cost',
        icon: 'Repeat',
        tone: 'neutral',
        text: `Suas contas fixas somam ${formatMoney(monthly)} por mês — ${formatMoney(monthly * 12)} no ano.`
      })
    }
  }

  // ---- Biggest single expense -----------------------------------------
  const report = buildMonthReport(data, month)
  if (report.biggestExpense && report.expense > 0) {
    const share = report.biggestExpense.amount / report.expense
    if (share >= 0.25) {
      out.push({
        id: 'biggest',
        icon: 'Receipt',
        tone: 'neutral',
        text: `“${report.biggestExpense.description}” sozinho representa ${formatPercent(share)} das suas despesas do mês.`
      })
    }
  }

  return out.slice(0, 6)
}

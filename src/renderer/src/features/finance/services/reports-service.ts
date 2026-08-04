/**
 * Reports — monthly and yearly rollups, comparisons and net-worth evolution.
 * Everything here reads the ledger and returns plain data; formatting is the
 * page's job.
 */

import type { FinanceData, Transaction } from '@shared/finance'
import {
  type MonthKey,
  addMonthsToKey,
  currentMonth,
  monthLabel,
  monthsBetween
} from '@/lib/dates'
import {
  type CategorySlice,
  accountDelta,
  categoryBreakdown,
  monthTotals,
  transactionsInMonth
} from './finance-engine'

export interface MonthReport {
  month: MonthKey
  label: string
  income: number
  expense: number
  net: number
  /** Fraction of income that was not spent. Negative when overspending. */
  savingsRate: number
  transactionCount: number
  topCategory?: CategorySlice
  biggestExpense?: Transaction
  categories: CategorySlice[]
}

export function buildMonthReport(data: FinanceData, month: MonthKey): MonthReport {
  const rows = transactionsInMonth(data.transactions, month)
  const totals = monthTotals(data.transactions, month)
  const categories = categoryBreakdown(rows, data.categories, 'expense')
  const biggest = rows
    .filter((t) => t.type === 'expense' && t.paid)
    .sort((a, b) => b.amount - a.amount)[0]

  return {
    month,
    label: monthLabel(month),
    income: totals.income,
    expense: totals.expense,
    net: totals.net,
    savingsRate: totals.income > 0 ? totals.net / totals.income : 0,
    transactionCount: rows.length,
    topCategory: categories[0],
    biggestExpense: biggest,
    categories
  }
}

export interface YearReport {
  year: string
  income: number
  expense: number
  net: number
  months: MonthReport[]
  bestMonth?: MonthReport
  worstMonth?: MonthReport
  categories: CategorySlice[]
}

export function buildYearReport(data: FinanceData, year: string): YearReport {
  const months = monthsBetween(`${year}-01`, `${year}-12`).map((m) => buildMonthReport(data, m))
  const active = months.filter((m) => m.transactionCount > 0)
  const rows = data.transactions.filter((t) => t.date.startsWith(year))

  return {
    year,
    income: months.reduce((s, m) => s + m.income, 0),
    expense: months.reduce((s, m) => s + m.expense, 0),
    net: months.reduce((s, m) => s + m.net, 0),
    months,
    bestMonth: [...active].sort((a, b) => b.net - a.net)[0],
    worstMonth: [...active].sort((a, b) => a.net - b.net)[0],
    categories: categoryBreakdown(rows, data.categories, 'expense')
  }
}

export interface ComparisonRow {
  label: string
  current: number
  previous: number
  delta: number
  /** Change as a fraction of the previous value; undefined when it was zero. */
  ratio?: number
}

function compare(label: string, current: number, previous: number): ComparisonRow {
  return {
    label,
    current,
    previous,
    delta: current - previous,
    ratio: previous > 0 ? (current - previous) / previous : undefined
  }
}

/** Month-over-month headline numbers plus the categories that moved most. */
export function compareMonths(
  data: FinanceData,
  month: MonthKey,
  against: MonthKey
): { headline: ComparisonRow[]; categories: ComparisonRow[] } {
  const a = buildMonthReport(data, month)
  const b = buildMonthReport(data, against)

  const categoryIds = new Set([
    ...a.categories.map((c) => c.categoryId),
    ...b.categories.map((c) => c.categoryId)
  ])
  const categories = Array.from(categoryIds)
    .map((id) => {
      const cur = a.categories.find((c) => c.categoryId === id)
      const prev = b.categories.find((c) => c.categoryId === id)
      return compare(cur?.name ?? prev?.name ?? '—', cur?.amount ?? 0, prev?.amount ?? 0)
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))

  return {
    headline: [
      compare('Receitas', a.income, b.income),
      compare('Despesas', a.expense, b.expense),
      compare('Saldo', a.net, b.net)
    ],
    categories
  }
}

export interface EvolutionPoint {
  month: MonthKey
  label: string
  balance: number
  income: number
  expense: number
}

/** Net worth month by month — the running end-of-month balance. */
export function buildEvolution(data: FinanceData, months = 12): EvolutionPoint[] {
  const from = addMonthsToKey(currentMonth(), -(months - 1))
  const keys = monthsBetween(from, currentMonth())

  let running = data.accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + a.openingBalance, 0)
  for (const tx of data.transactions) {
    if (tx.date.slice(0, 7) >= from) continue
    for (const account of data.accounts) {
      if (!account.archived) running += accountDelta(tx, account.id)
    }
  }

  return keys.map((month) => {
    const rows = transactionsInMonth(data.transactions, month)
    for (const tx of rows) {
      for (const account of data.accounts) {
        if (!account.archived) running += accountDelta(tx, account.id)
      }
    }
    const totals = monthTotals(data.transactions, month)
    return {
      month,
      label: monthLabel(month),
      balance: running,
      income: totals.income,
      expense: totals.expense
    }
  })
}

/** Average monthly expense over the last `months` complete months. */
export function averageMonthlyExpense(data: FinanceData, months = 3): number {
  const keys = monthsBetween(addMonthsToKey(currentMonth(), -months), addMonthsToKey(currentMonth(), -1))
  if (keys.length === 0) return 0
  const total = keys.reduce((sum, m) => sum + monthTotals(data.transactions, m).expense, 0)
  return Math.round(total / keys.length)
}

/** Rows for the CSV export — header first, one array per transaction. */
export function toCsvRows(data: FinanceData, transactions: Transaction[]): string[][] {
  const header = [
    'Data', 'Hora', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Forma',
    'Conta', 'Cartão', 'Parcela', 'Pago', 'Tags', 'Observações'
  ]
  const typeLabel = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }

  const rows = transactions.map((tx) => [
    tx.date,
    tx.time ?? '',
    typeLabel[tx.type],
    tx.description,
    data.categories.find((c) => c.id === tx.categoryId)?.name ?? '',
    // Excel in pt-BR expects a comma as the decimal separator.
    (tx.amount / 100).toFixed(2).replace('.', ','),
    tx.method,
    data.accounts.find((a) => a.id === tx.accountId)?.name ?? '',
    data.cards.find((c) => c.id === tx.cardId)?.name ?? '',
    tx.installment ? `${tx.installment.number}/${tx.installment.total}` : '',
    tx.paid ? 'Sim' : 'Não',
    tx.tags.join(', '),
    tx.notes ?? ''
  ])
  return [header, ...rows]
}

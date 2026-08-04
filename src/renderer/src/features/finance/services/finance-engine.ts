/**
 * Finance engine — every derived number in the module comes from here.
 *
 * Pure functions over the stored document: no React, no store, no IPC. That
 * makes the money math testable in isolation and keeps the pages dumb.
 *
 * Two rules govern the whole model:
 *  1. `paid: false` means "scheduled" — a bill, an invoice, a future parcel.
 *     Balances count only paid rows; forecasts count everything.
 *  2. A credit purchase never touches an account balance. It sits on the card
 *     until the invoice is paid, and paying it creates one real expense on the
 *     account. That is how the money actually moves.
 */

import type {
  FinanceAccount,
  FinanceCard,
  FinanceCategory,
  FinanceData,
  Transaction
} from '@shared/finance'
import {
  type DayKey,
  type MonthKey,
  addMonthsToKey,
  currentMonth,
  dayInMonth,
  daysBetween,
  monthOf,
  today
} from '../utils/dates'

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/** How a transaction moves the balance of `accountId`, in cents. */
export function accountDelta(tx: Transaction, accountId: string): number {
  if (!tx.paid) return 0
  // Credit purchases live on the card, not on the account.
  if (tx.method === 'credit' && tx.type !== 'transfer') return 0
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) return -tx.amount
    if (tx.toAccountId === accountId) return tx.amount
    return 0
  }
  if (tx.accountId !== accountId) return 0
  return tx.type === 'income' ? tx.amount : -tx.amount
}

export function accountBalance(account: FinanceAccount, transactions: Transaction[]): number {
  let total = account.openingBalance
  for (const tx of transactions) total += accountDelta(tx, account.id)
  return total
}

/** Sum of every active account. This is the headline "Saldo total". */
export function totalBalance(data: FinanceData): number {
  return data.accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + accountBalance(a, data.transactions), 0)
}

// ---------------------------------------------------------------------------
// Period totals
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  income: number
  expense: number
  net: number
  /** Bills and parcels in the period that are not settled yet. */
  pendingExpense: number
  pendingIncome: number
}

/**
 * Totals for a set of transactions. Transfers are deliberately excluded —
 * moving money between your own accounts is neither income nor expense, and
 * counting it double is the fastest way to make a dashboard lie.
 */
export function totalsOf(transactions: Transaction[]): PeriodTotals {
  let income = 0
  let expense = 0
  let pendingExpense = 0
  let pendingIncome = 0
  for (const tx of transactions) {
    if (tx.type === 'transfer') continue
    if (tx.type === 'income') {
      if (tx.paid) income += tx.amount
      else pendingIncome += tx.amount
    } else {
      if (tx.paid) expense += tx.amount
      else pendingExpense += tx.amount
    }
  }
  return { income, expense, net: income - expense, pendingExpense, pendingIncome }
}

export function transactionsInMonth(transactions: Transaction[], month: MonthKey): Transaction[] {
  return transactions.filter((t) => t.date.startsWith(month))
}

export function monthTotals(transactions: Transaction[], month: MonthKey): PeriodTotals {
  return totalsOf(transactionsInMonth(transactions, month))
}

export function transactionsBetween(
  transactions: Transaction[],
  from: DayKey,
  to: DayKey
): Transaction[] {
  return transactions.filter((t) => t.date >= from && t.date <= to)
}

// ---------------------------------------------------------------------------
// Time series (the dashboard chart)
// ---------------------------------------------------------------------------

export type RangeKey = '7d' | '30d' | '3m' | '1y'

export const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '3m': '3 meses',
  '1y': '1 ano'
}

export interface SeriesPoint {
  key: string
  label: string
  income: number
  expense: number
  /** Running balance at the end of the bucket. */
  balance: number
}

const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '3m': 90, '1y': 365 }

/**
 * Income / expense / running balance bucketed by day (short ranges) or by
 * month (3m and 1y, where 365 daily bars would be unreadable).
 */
export function buildSeries(data: FinanceData, range: RangeKey): SeriesPoint[] {
  const end = today()
  const byMonth = range === '3m' || range === '1y'
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (RANGE_DAYS[range] - 1))
  const pad = (n: number): string => n.toString().padStart(2, '0')
  const start = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`

  // Balance before the window, so the running line starts at the right height.
  let running = data.accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + a.openingBalance, 0)
  for (const tx of data.transactions) {
    if (tx.date >= start) continue
    for (const account of data.accounts) {
      if (account.archived) continue
      running += accountDelta(tx, account.id)
    }
  }

  const buckets = new Map<string, SeriesPoint>()
  const keys = byMonth
    ? Array.from(new Set(daysBetween(start, end).map(monthOf)))
    : daysBetween(start, end)

  for (const key of keys) {
    buckets.set(key, {
      key,
      label: byMonth ? key.slice(5) + '/' + key.slice(2, 4) : key.slice(8) + '/' + key.slice(5, 7),
      income: 0,
      expense: 0,
      balance: 0
    })
  }

  const inWindow = data.transactions
    .filter((t) => t.date >= start && t.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of inWindow) {
    const bucket = buckets.get(byMonth ? monthOf(tx.date) : tx.date)
    if (!bucket) continue
    if (tx.type === 'income' && tx.paid) bucket.income += tx.amount
    else if (tx.type === 'expense' && tx.paid) bucket.expense += tx.amount
  }

  // Second pass: the running balance has to follow account rules, not the
  // simplified income/expense above (credit purchases, transfers).
  const deltasByKey = new Map<string, number>()
  for (const tx of inWindow) {
    let delta = 0
    for (const account of data.accounts) {
      if (account.archived) continue
      delta += accountDelta(tx, account.id)
    }
    const key = byMonth ? monthOf(tx.date) : tx.date
    deltasByKey.set(key, (deltasByKey.get(key) ?? 0) + delta)
  }

  const points = Array.from(buckets.values())
  for (const point of points) {
    running += deltasByKey.get(point.key) ?? 0
    point.balance = running
  }
  return points
}

// ---------------------------------------------------------------------------
// Category distribution (the donut)
// ---------------------------------------------------------------------------

export interface CategorySlice {
  categoryId: string
  name: string
  color: string
  icon: string
  amount: number
  share: number
}

export function categoryBreakdown(
  transactions: Transaction[],
  categories: FinanceCategory[],
  type: 'expense' | 'income' = 'expense'
): CategorySlice[] {
  const totals = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== type || !tx.paid) continue
    const id = tx.categoryId ?? 'cat-other'
    totals.set(id, (totals.get(id) ?? 0) + tx.amount)
  }
  const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0)
  const slices: CategorySlice[] = []
  for (const [categoryId, amount] of totals) {
    const category = categories.find((c) => c.id === categoryId)
    slices.push({
      categoryId,
      name: category?.name ?? 'Sem categoria',
      color: category?.color ?? '240 8% 60%',
      icon: category?.icon ?? 'Shapes',
      amount,
      share: grand > 0 ? amount / grand : 0
    })
  }
  return slices.sort((a, b) => b.amount - a.amount)
}

// ---------------------------------------------------------------------------
// Credit cards & invoices
// ---------------------------------------------------------------------------

export interface CardInvoice {
  cardId: string
  /** Month the invoice is charged in — its identity. */
  month: MonthKey
  dueDate: DayKey
  closeDate: DayKey
  transactions: Transaction[]
  total: number
  paid: boolean
  /** The invoice currently accumulating purchases. */
  open: boolean
}

/**
 * Which invoice a purchase lands on. A buy after the closing day has already
 * missed this month's invoice and rolls into the next one.
 */
export function invoiceMonthFor(card: FinanceCard, date: DayKey): MonthKey {
  const day = Number(date.slice(8, 10))
  const month = monthOf(date)
  return day > card.closingDay ? addMonthsToKey(month, 1) : month
}

/** Invoices close in month M and are due in M if the due day is later, else M+1. */
export function invoiceDueDate(card: FinanceCard, month: MonthKey): DayKey {
  const dueMonth = card.dueDay > card.closingDay ? month : addMonthsToKey(month, 1)
  return dayInMonth(dueMonth, card.dueDay)
}

export function buildInvoices(card: FinanceCard, transactions: Transaction[]): CardInvoice[] {
  const byMonth = new Map<MonthKey, Transaction[]>()
  for (const tx of transactions) {
    if (tx.cardId !== card.id || tx.method !== 'credit') continue
    const month = invoiceMonthFor(card, tx.date)
    const list = byMonth.get(month) ?? []
    list.push(tx)
    byMonth.set(month, list)
  }

  const openMonth = invoiceMonthFor(card, today())
  return Array.from(byMonth.entries())
    .map(([month, list]) => ({
      cardId: card.id,
      month,
      dueDate: invoiceDueDate(card, month),
      closeDate: dayInMonth(month, card.closingDay),
      transactions: list.sort((a, b) => a.date.localeCompare(b.date)),
      total: list.reduce((sum, t) => sum + t.amount, 0),
      paid: list.every((t) => t.paid),
      open: month === openMonth
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

export interface CardUsage {
  used: number
  available: number
  ratio: number
  openInvoice?: CardInvoice
  nextInvoice?: CardInvoice
  invoices: CardInvoice[]
}

/** Used limit = everything charged to the card that has not been settled. */
export function cardUsage(card: FinanceCard, transactions: Transaction[]): CardUsage {
  const invoices = buildInvoices(card, transactions)
  const used = transactions
    .filter((t) => t.cardId === card.id && t.method === 'credit' && !t.paid)
    .reduce((sum, t) => sum + t.amount, 0)
  const openMonth = invoiceMonthFor(card, today())
  return {
    used,
    available: Math.max(0, card.limit - used),
    ratio: card.limit > 0 ? used / card.limit : 0,
    openInvoice: invoices.find((i) => i.month === openMonth),
    nextInvoice: invoices.find((i) => !i.paid && i.month < openMonth) ??
      invoices.filter((i) => !i.paid).sort((a, b) => a.month.localeCompare(b.month))[0],
    invoices
  }
}

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

export interface InstallmentGroup {
  groupId: string
  description: string
  cardId?: string
  categoryId?: string
  total: number
  totalCount: number
  paidCount: number
  paidAmount: number
  remaining: number
  /** Cents charged per parcel (the first parcel absorbs any rounding). */
  perParcel: number
  firstDate: DayKey
  lastDate: DayKey
  transactions: Transaction[]
}

export function installmentGroups(transactions: Transaction[]): InstallmentGroup[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (!tx.installment) continue
    const list = groups.get(tx.installment.groupId) ?? []
    list.push(tx)
    groups.set(tx.installment.groupId, list)
  }

  return Array.from(groups.entries())
    .map(([groupId, list]) => {
      const sorted = list.sort((a, b) => (a.installment!.number - b.installment!.number))
      const paid = sorted.filter((t) => t.paid)
      const first = sorted[0]
      return {
        groupId,
        description: first.description,
        cardId: first.cardId,
        categoryId: first.categoryId,
        total: sorted.reduce((sum, t) => sum + t.amount, 0),
        totalCount: first.installment!.total,
        paidCount: paid.length,
        paidAmount: paid.reduce((sum, t) => sum + t.amount, 0),
        remaining: sorted.filter((t) => !t.paid).reduce((sum, t) => sum + t.amount, 0),
        perParcel: first.amount,
        firstDate: sorted[0].date,
        lastDate: sorted[sorted.length - 1].date,
        transactions: sorted
      }
    })
    .sort((a, b) => {
      // Open purchases first, then by the soonest remaining parcel.
      const aOpen = a.remaining > 0 ? 0 : 1
      const bOpen = b.remaining > 0 ? 0 : 1
      return aOpen - bOpen || a.lastDate.localeCompare(b.lastDate)
    })
}

// ---------------------------------------------------------------------------
// Search & filtering
// ---------------------------------------------------------------------------

export interface TransactionFilters {
  query?: string
  types?: Set<Transaction['type']>
  categoryIds?: Set<string>
  accountIds?: Set<string>
  cardIds?: Set<string>
  methods?: Set<Transaction['method']>
  tags?: Set<string>
  from?: DayKey
  to?: DayKey
  minAmount?: number
  maxAmount?: number
  onlyPending?: boolean
  onlyFavorites?: boolean
}

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

/**
 * Global search. The query matches description, notes, tags, and — when it
 * parses as a number — the amount, so typing "89,90" finds the charge.
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  categories: FinanceCategory[] = []
): Transaction[] {
  const query = filters.query?.trim().toLowerCase() ?? ''
  const queryDigits = query.replace(/[^\d]/g, '')

  return transactions.filter((tx) => {
    if (filters.types?.size && !filters.types.has(tx.type)) return false
    if (filters.categoryIds?.size && !filters.categoryIds.has(tx.categoryId ?? '')) return false
    if (filters.methods?.size && !filters.methods.has(tx.method)) return false
    if (filters.cardIds?.size && !filters.cardIds.has(tx.cardId ?? '')) return false
    if (filters.accountIds?.size) {
      const hit =
        filters.accountIds.has(tx.accountId ?? '') || filters.accountIds.has(tx.toAccountId ?? '')
      if (!hit) return false
    }
    if (filters.tags?.size && !tx.tags.some((t) => filters.tags!.has(t))) return false
    if (filters.from && tx.date < filters.from) return false
    if (filters.to && tx.date > filters.to) return false
    if (filters.minAmount !== undefined && tx.amount < filters.minAmount) return false
    if (filters.maxAmount !== undefined && tx.amount > filters.maxAmount) return false
    if (filters.onlyPending && tx.paid) return false
    if (filters.onlyFavorites && !tx.favorite) return false

    if (!query) return true
    const categoryName =
      categories.find((c) => c.id === tx.categoryId)?.name.toLowerCase() ?? ''
    const haystack = [
      tx.description.toLowerCase(),
      tx.notes?.toLowerCase() ?? '',
      categoryName,
      tx.tags.join(' ').toLowerCase()
    ].join(' ')
    if (haystack.includes(query)) return true
    // Amount match: "89,90", "8990" and "89.90" all find the same charge.
    return queryDigits.length >= 2 && String(tx.amount).includes(queryDigits)
  })
}

export function sortTransactions(transactions: Transaction[], sort: SortKey): Transaction[] {
  const copy = [...transactions]
  switch (sort) {
    case 'date-asc':
      return copy.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount)
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount)
    default:
      return copy.sort(
        (a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '')
      )
  }
}

/** Group rows by day, newest first — the shape the transaction list renders. */
export function groupByDay(transactions: Transaction[]): { day: DayKey; rows: Transaction[] }[] {
  const map = new Map<DayKey, Transaction[]>()
  for (const tx of transactions) {
    const list = map.get(tx.date) ?? []
    list.push(tx)
    map.set(tx.date, list)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, rows]) => ({ day, rows }))
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function accountById(data: FinanceData, id?: string): FinanceAccount | undefined {
  return id ? data.accounts.find((a) => a.id === id) : undefined
}

export function cardById(data: FinanceData, id?: string): FinanceCard | undefined {
  return id ? data.cards.find((c) => c.id === id) : undefined
}

export function categoryById(data: FinanceData, id?: string): FinanceCategory | undefined {
  return id ? data.categories.find((c) => c.id === id) : undefined
}

/** Every distinct tag in use, for the filter bar and autocompletion. */
export function allTags(transactions: Transaction[]): string[] {
  const set = new Set<string>()
  for (const tx of transactions) for (const tag of tx.tags) set.add(tag)
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Money already spent against a Focus HUB project. */
export function projectSpend(transactions: Transaction[], projectId: string): number {
  return transactions
    .filter((t) => t.projectId === projectId && t.type === 'expense' && t.paid)
    .reduce((sum, t) => sum + t.amount, 0)
}

export { currentMonth }

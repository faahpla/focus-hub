/**
 * Installments — turning "R$ 1.200 em 10x" into ten real transactions.
 *
 * Splitting is done in cents with the remainder pushed onto the first parcel,
 * so the parcels always add back up to exactly the purchase price. Dividing
 * 100,00 by 3 and writing 33,33 three times loses a cent, and a ledger that
 * loses cents stops being trustworthy.
 */

import type { Transaction } from '@shared/finance'
import { type DayKey, addMonthsToDay, today } from '../utils/dates'
import { uid } from '@/lib/utils'

/** Parcel values in cents, summing exactly to `total`. */
export function splitAmount(total: number, count: number): number[] {
  const n = Math.max(1, Math.floor(count))
  const base = Math.floor(total / n)
  const remainder = total - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + remainder : base))
}

export interface InstallmentInput {
  /** Total price of the purchase, in cents. */
  total: number
  count: number
  firstDate: DayKey
  base: Omit<Transaction, 'id' | 'amount' | 'date' | 'installment' | 'createdAt' | 'updatedAt' | 'paid'>
}

/**
 * Build the parcels. Parcels dated today or earlier are marked paid; the ones
 * still ahead stay pending, which is what makes them show up in the forecast,
 * on the calendar and inside the card's future invoices.
 */
export function buildInstallments({ total, count, firstDate, base }: InstallmentInput): Transaction[] {
  const groupId = uid()
  const amounts = splitAmount(total, count)
  const now = new Date().toISOString()
  const todayKey = today()

  return amounts.map((amount, index) => {
    const date = addMonthsToDay(firstDate, index)
    return {
      ...base,
      id: uid(),
      amount,
      date,
      installment: { number: index + 1, total: amounts.length, groupId },
      paid: date <= todayKey,
      createdAt: now,
      updatedAt: now
    }
  })
}

/** Description shown on a parcel row: "Notebook (3/10)". */
export function installmentLabel(tx: Transaction): string | undefined {
  if (!tx.installment) return undefined
  return `${tx.installment.number}/${tx.installment.total}`
}

export interface InstallmentForecast {
  month: string
  amount: number
}

/** How much of the future is already committed, month by month. */
export function forecastByMonth(transactions: Transaction[], months: string[]): InstallmentForecast[] {
  return months.map((month) => ({
    month,
    amount: transactions
      .filter((t) => t.installment && !t.paid && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0)
  }))
}

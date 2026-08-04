/**
 * Recurring bills and income.
 *
 * A rule doesn't *become* money — it produces real Transaction rows so they can
 * be edited, skipped or paid individually like any other. Generation is
 * idempotent: each occurrence gets a deterministic id (`rec-<rule>-<date>`), so
 * running this on every app start can never duplicate a bill. Rows the user
 * later edited keep their edits, because existing ids are never overwritten.
 */

import type { RecurringRule, Transaction } from '@shared/finance'
import {
  type DayKey,
  addDaysToKey,
  addMonthsToKey,
  currentMonth,
  dayInMonth,
  monthsBetween,
  today,
  toDayKey,
  parseLocal
} from '@/lib/dates'

/** How far ahead bills are materialised — enough to fill the calendar. */
const HORIZON_MONTHS = 2
/** How far back a newly-created rule reaches. Avoids inventing old history. */
const BACKFILL_MONTHS = 1

export function occurrenceId(ruleId: string, date: DayKey): string {
  return `rec-${ruleId}-${date}`
}

/** Every date this rule fires between `from` and `to`, inclusive. */
export function occurrencesOf(rule: RecurringRule, from: DayKey, to: DayKey): DayKey[] {
  const start = rule.startDate > from ? rule.startDate : from
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to
  if (start > end) return []

  const out: DayKey[] = []
  if (rule.frequency === 'weekly') {
    const weekday = rule.weekday ?? parseLocal(rule.startDate).getDay()
    let cursor = start
    // Walk forward to the first matching weekday, then step a week at a time.
    for (let i = 0; i < 7 && parseLocal(cursor).getDay() !== weekday; i++) {
      cursor = addDaysToKey(cursor, 1)
    }
    while (cursor <= end) {
      out.push(cursor)
      cursor = addDaysToKey(cursor, 7)
    }
    return out
  }

  for (const month of monthsBetween(start.slice(0, 7), end.slice(0, 7))) {
    if (rule.frequency === 'yearly' && rule.month !== undefined) {
      if (Number(month.slice(5, 7)) - 1 !== rule.month) continue
    }
    const date = dayInMonth(month, rule.dayOfMonth)
    if (date >= start && date <= end) out.push(date)
  }
  return out
}

/**
 * Rows that should exist but don't yet. Returns only the *new* transactions —
 * the caller saves them in one write, or skips the write entirely when empty.
 */
export function materializeRecurring(
  rules: RecurringRule[],
  existing: Transaction[]
): Transaction[] {
  const known = new Set(existing.map((t) => t.id))
  const now = new Date().toISOString()
  const from = `${addMonthsToKey(currentMonth(), -BACKFILL_MONTHS)}-01`
  const lastMonth = addMonthsToKey(currentMonth(), HORIZON_MONTHS)
  const to = dayInMonth(lastMonth, 31)
  const todayKey = today()

  const created: Transaction[] = []
  for (const rule of rules) {
    if (!rule.active) continue
    for (const date of occurrencesOf(rule, from, to)) {
      const id = occurrenceId(rule.id, date)
      if (known.has(id)) continue
      created.push({
        id,
        type: rule.type,
        amount: rule.amount,
        categoryId: rule.categoryId,
        description: rule.name,
        date,
        method: rule.method,
        accountId: rule.accountId,
        cardId: rule.cardId,
        recurringId: rule.id,
        tags: [...rule.tags],
        notes: rule.notes,
        // Auto-paid rules (salary, automatic debit) settle on their date;
        // everything else shows up as a bill waiting to be paid.
        paid: rule.autoPay && date <= todayKey,
        createdAt: now,
        updatedAt: now
      })
    }
  }
  return created
}

/** The next time a rule fires, from today onwards. */
export function nextOccurrence(rule: RecurringRule): DayKey | undefined {
  const horizon = toDayKey(new Date(Date.now() + 400 * 86_400_000))
  return occurrencesOf(rule, today(), horizon)[0]
}

/** Monthly cost of a rule, normalised so weekly and yearly are comparable. */
export function monthlyCost(rule: RecurringRule): number {
  switch (rule.frequency) {
    case 'weekly':
      return Math.round((rule.amount * 52) / 12)
    case 'yearly':
      return Math.round(rule.amount / 12)
    default:
      return rule.amount
  }
}

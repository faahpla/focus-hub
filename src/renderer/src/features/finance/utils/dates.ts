/**
 * Date helpers for the finance module.
 *
 * Everything is a local `YYYY-MM-DD` string. `new Date('2026-08-03')` parses as
 * UTC midnight and shifts a day backwards in Brazil, so dates are never built
 * that way here — `parseLocal` is the only entry point.
 */

export type DayKey = string // YYYY-MM-DD
export type MonthKey = string // YYYY-MM

const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** A `YYYY-MM-DD` string as a local Date at midnight. */
export function parseLocal(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function toDayKey(date: Date): DayKey {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(): DayKey {
  return toDayKey(new Date())
}

export function nowTime(): string {
  const d = new Date()
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7)
}

export function currentMonth(): MonthKey {
  return today().slice(0, 7)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Build a day key from a month key and a day number, clamped to the month. */
export function dayInMonth(month: MonthKey, day: number): DayKey {
  const [y, m] = month.split('-').map(Number)
  const max = daysInMonth(y, m - 1)
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${month}-${pad(Math.min(Math.max(1, day), max))}`
}

export function addMonthsToKey(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function addDaysToKey(day: DayKey, delta: number): DayKey {
  const date = parseLocal(day)
  date.setDate(date.getDate() + delta)
  return toDayKey(date)
}

/** Same day-of-month `delta` months later, clamped (31 Jan + 1 → 28/29 Feb). */
export function addMonthsToDay(day: DayKey, delta: number): DayKey {
  const date = parseLocal(day)
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const max = daysInMonth(target.getFullYear(), target.getMonth())
  target.setDate(Math.min(date.getDate(), max))
  return toDayKey(target)
}

export function diffDays(from: DayKey, to: DayKey): number {
  const ms = parseLocal(to).getTime() - parseLocal(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function monthLabel(month: MonthKey, long = false): string {
  const [y, m] = month.split('-').map(Number)
  const names = long ? MONTHS_LONG : MONTHS_SHORT
  return `${names[m - 1]} ${long ? 'de ' : ''}${y}`
}

export function dayLabel(day: DayKey): string {
  const d = parseLocal(day)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function weekdayLabel(day: DayKey): string {
  return WEEKDAYS_SHORT[parseLocal(day).getDay()]
}

/** "Hoje" / "Ontem" / "3 Ago" — the label a transaction row shows. */
export function relativeDayLabel(day: DayKey): string {
  const delta = diffDays(today(), day)
  if (delta === 0) return 'Hoje'
  if (delta === -1) return 'Ontem'
  if (delta === 1) return 'Amanhã'
  return `${weekdayLabel(day)}, ${dayLabel(day)}`
}

/** Every day key in `[from, to]`, inclusive. */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  let cursor = from
  // Guard against an inverted range producing an endless loop.
  for (let i = 0; cursor <= to && i < 5000; i++) {
    out.push(cursor)
    cursor = addDaysToKey(cursor, 1)
  }
  return out
}

export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = []
  let cursor = from
  for (let i = 0; cursor <= to && i < 600; i++) {
    out.push(cursor)
    cursor = addMonthsToKey(cursor, 1)
  }
  return out
}

export const MONTH_NAMES_LONG = MONTHS_LONG
export const WEEKDAY_NAMES_SHORT = WEEKDAYS_SHORT

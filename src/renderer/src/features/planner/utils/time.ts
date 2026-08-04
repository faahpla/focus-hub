/**
 * Clock arithmetic. Times are "HH:mm" strings on the wire and minutes-from-
 * midnight integers while being computed — comparing "09:30" to "10:00" as
 * strings happens to work, adding 45 minutes to it does not.
 */

export type Clock = string // HH:mm

export function toMinutes(clock: Clock): number {
  const [h, m] = clock.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fromMinutes(total: number): Clock {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(clock: Clock, minutes: number): Clock {
  return fromMinutes(toMinutes(clock) + minutes)
}

/** "1h 30min" / "45min" — how long a block is, in words. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
  return `${rest}min`
}

/** "1h30" — the compact form for chips and badges. */
export function formatMinutesShort(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours > 0) return rest > 0 ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`
  return `${rest}min`
}

export interface Interval {
  start: number // minutes from midnight
  end: number
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

export function duration(interval: Interval): number {
  return Math.max(0, interval.end - interval.start)
}

/**
 * Remove `busy` from `open`, returning what is left. Busy intervals may
 * overlap each other and arrive in any order.
 */
export function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  const blockers = [...busy].sort((a, b) => a.start - b.start)
  let result = [...open]

  for (const block of blockers) {
    const next: Interval[] = []
    for (const slot of result) {
      if (!overlaps(slot, block)) {
        next.push(slot)
        continue
      }
      // Whatever sticks out on either side of the blocker survives.
      if (block.start > slot.start) next.push({ start: slot.start, end: block.start })
      if (block.end < slot.end) next.push({ start: block.end, end: slot.end })
    }
    result = next
  }
  return result.filter((slot) => duration(slot) > 0)
}

/** Where in the day we are right now, as minutes from midnight. */
export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function nowClock(): Clock {
  return fromMinutes(nowMinutes())
}

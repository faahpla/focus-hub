/** Time & number formatting helpers used across the UI. */

export function formatClock(totalSeconds: number, withHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const pad = (n: number): string => n.toString().padStart(2, '0')
  if (withHours || hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

/** Compact human duration, e.g. "2h 15m" or "45m". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${s}s`
}

export function formatHours(totalSeconds: number): string {
  return (totalSeconds / 3600).toFixed(1).replace('.', ',')
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

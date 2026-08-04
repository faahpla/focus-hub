/**
 * Money helpers. Every amount crossing this module is an integer of cents;
 * these are the only two places it becomes a string or comes back from one.
 */

/** "R$ 1.234,56" — the canonical display form. */
export function formatMoney(cents: number, opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, symbol = true } = opts
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const body = (abs / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const prefix = negative ? '−' : sign ? '+' : ''
  return `${prefix}${symbol ? 'R$ ' : ''}${body}`
}

/** "1,2 mil" / "1,3 mi" — for axis labels and tight cards. */
export function formatMoneyCompact(cents: number): string {
  const value = Math.abs(cents) / 100
  const negative = cents < 0
  const fmt = (n: number, suffix: string): string =>
    `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`
  let body: string
  if (value >= 1_000_000) body = fmt(value / 1_000_000, ' mi')
  else if (value >= 1000) body = fmt(value / 1000, ' mil')
  else body = value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  return `${negative ? '−' : ''}R$ ${body}`
}

/**
 * Read whatever the user typed into cents.
 *
 * Accepts "1234,56", "1.234,56", "1234.56", "R$ 1.234,56" and "1234". The rule
 * for the ambiguous cases: the last separator wins as the decimal mark, and a
 * dot is only a decimal mark when it isn't acting as a thousands separator.
 */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return 0

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized: string

  if (lastComma > lastDot) {
    // Brazilian: dots group thousands, comma is decimal.
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    const decimals = cleaned.length - lastDot - 1
    // "1.234" with exactly 3 digits after the dot is a thousands group.
    normalized =
      decimals === 3 && lastComma === -1
        ? cleaned.replace(/\./g, '')
        : cleaned.replace(/,/g, '')
  } else {
    normalized = cleaned
  }

  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

/** Cents as the plain "1234,56" an input field should show while editing. */
export function centsToInput(cents: number): string {
  if (!cents) return ''
  return (Math.abs(cents) / 100).toFixed(2).replace('.', ',')
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.min(1, Math.max(0, part / whole))
}

/** "23%" — rounded, never "NaN%". */
export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits).replace('.', ',')}%`
}

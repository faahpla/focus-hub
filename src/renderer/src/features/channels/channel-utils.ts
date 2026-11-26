import type { ChannelAccount, ChannelsState, PlatformVideo } from '@shared/channels'
import type { BoardCard } from '@shared/types'
import { searchable } from '../boards/card-flow'

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('pt-BR')
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "12,3 mil" — for tiles and tables. Undefined reads as a dash: the platform didn't say. */
export const fmtCompact = (n: number | undefined): string =>
  n === undefined ? '—' : compact.format(n)
export const fmtWhole = (n: number | undefined): string => (n === undefined ? '—' : whole.format(n))
export const fmtMoney = (n: number | null | undefined): string =>
  n === undefined || n === null ? '—' : money.format(n)

export function fmtSeconds(s: number | undefined): string {
  if (s === undefined) return '—'
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
}

export function fmtAgo(iso: string | undefined): string {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  })
}

/** A title with only letters and digits, to compare a video with a card. */
const key = (text: string | undefined): string =>
  searchable(text ?? '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * The card a published video most likely is: the same title, or one title
 * holding the other whole. Only a single clear match counts — two candidates
 * means guessing, and a wrong link is worse than none.
 */
export function autoMatch(
  video: PlatformVideo,
  account: ChannelAccount | undefined,
  cards: BoardCard[]
): BoardCard | undefined {
  const title = key(video.title)
  if (title.length < 8) return undefined
  const pool = account?.boardId ? cards.filter((c) => c.boardId === account.boardId) : cards
  const hits = pool.filter((card) =>
    [card.title, card.publishTitle].some((t) => {
      const k = key(t)
      if (!k) return false
      if (k === title) return true
      const [short, long] = k.length < title.length ? [k, title] : [title, k]
      return short.length >= 16 && long.includes(short)
    })
  )
  return hits.length === 1 ? hits[0] : undefined
}

/** The card a video is tied to: by hand first, then the automatic match. */
export function linkedCard(
  video: PlatformVideo,
  state: ChannelsState,
  cards: BoardCard[]
): { card?: BoardCard; auto: boolean } {
  const manual = state.links[video.id]
  if (manual === null) return { auto: false }
  if (manual) return { card: cards.find((c) => c.id === manual), auto: false }
  const account = state.accounts.find((a) => a.id === video.accountId)
  const card = autoMatch(video, account, cards)
  return { card, auto: card !== undefined }
}

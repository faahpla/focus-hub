import type {
  ChannelAccount,
  DailyPoint,
  PeriodStats,
  PlatformVideo
} from '../../../shared/channels'

/**
 * The user's own YouTube channel through the official APIs: the Data API for
 * the channel and its videos, the Analytics API for what only the owner sees
 * (watch time, retention, revenue). Every number is YouTube's own.
 *
 * Quota: an update costs a handful of units (lists cost 1 each) out of the
 * 10,000 a day — no search calls here.
 */

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
]

const DATA = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2/reports'
/** The most recent uploads looked at on each update. */
const MAX_VIDEOS = 300
/** The window the platforms show by default. */
const PERIOD_DAYS = 28

class YouTubeError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string }
  }
  if (!res.ok) {
    throw new YouTubeError(body.error?.message ?? `YouTube respondeu ${res.status}`, res.status)
  }
  return body
}

const num = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

const dayKey = (d: Date): string => d.toISOString().slice(0, 10)

/** "PT1H2M3S" → seconds. */
export function isoDuration(text: string | undefined): number | undefined {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(text ?? '')
  if (!m) return undefined
  const [, d, h, mi, s] = m.map((x) => Number(x ?? 0))
  return d * 86400 + h * 3600 + mi * 60 + s
}

interface ChannelResource {
  id: string
  snippet: {
    title: string
    customUrl?: string
    publishedAt: string
    thumbnails?: Record<string, { url: string }>
  }
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

/** The channel the sign-in picked. */
export async function fetchMyChannel(token: string): Promise<ChannelResource> {
  const res = await get<{ items?: ChannelResource[] }>(
    `${DATA}/channels?part=snippet,statistics,contentDetails&mine=true`,
    token
  )
  const channel = res.items?.[0]
  if (!channel) throw new Error('Essa conta Google não tem canal no YouTube.')
  return channel
}

export function accountFromChannel(
  channel: ChannelResource
): Pick<
  ChannelAccount,
  'externalId' | 'name' | 'handle' | 'avatarUrl' | 'followers' | 'totalViews' | 'videoCount'
> {
  const thumbs = channel.snippet.thumbnails ?? {}
  return {
    externalId: channel.id,
    name: channel.snippet.title,
    handle: channel.snippet.customUrl,
    avatarUrl: (thumbs.medium ?? thumbs.default ?? thumbs.high)?.url,
    followers: num(channel.statistics?.subscriberCount),
    totalViews: num(channel.statistics?.viewCount),
    videoCount: num(channel.statistics?.videoCount)
  }
}

interface VideoResource {
  id: string
  snippet: { title: string; publishedAt: string; thumbnails?: Record<string, { url: string }> }
  contentDetails?: { duration?: string }
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
}

/** The latest uploads with their public numbers. */
async function fetchVideos(
  token: string,
  uploads: string,
  accountId: string
): Promise<PlatformVideo[]> {
  const ids: string[] = []
  let page: string | undefined
  do {
    const res = await get<{
      items?: { contentDetails: { videoId: string } }[]
      nextPageToken?: string
    }>(
      `${DATA}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}` +
        (page ? `&pageToken=${page}` : ''),
      token
    )
    ids.push(...(res.items ?? []).map((i) => i.contentDetails.videoId))
    page = res.nextPageToken
  } while (page && ids.length < MAX_VIDEOS)

  const videos: PlatformVideo[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const res = await get<{ items?: VideoResource[] }>(
      `${DATA}/videos?part=snippet,contentDetails,statistics&id=${batch.join(',')}`,
      token
    )
    for (const v of res.items ?? []) {
      const thumbs = v.snippet.thumbnails ?? {}
      const duration = isoDuration(v.contentDetails?.duration)
      videos.push({
        id: `youtube:${v.id}`,
        accountId,
        platform: 'youtube',
        externalId: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnailUrl: (thumbs.medium ?? thumbs.default ?? thumbs.high)?.url,
        durationSec: duration,
        probablyShort: duration !== undefined && duration <= 180,
        views: num(v.statistics?.viewCount) ?? 0,
        likes: num(v.statistics?.likeCount),
        comments: num(v.statistics?.commentCount)
      })
    }
  }
  return videos
}

interface Report {
  columnHeaders?: { name: string }[]
  rows?: (string | number)[][]
}

/** A report's rows as objects keyed by column name. */
async function report(
  token: string,
  params: Record<string, string>
): Promise<Record<string, string | number>[]> {
  const query = new URLSearchParams({ ids: 'channel==MINE', currency: 'BRL', ...params })
  const res = await get<Report>(`${ANALYTICS}?${query}`, token)
  const names = (res.columnHeaders ?? []).map((c) => c.name)
  return (res.rows ?? []).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])))
}

/**
 * Revenue only exists for monetized channels, and only with the monetary
 * permission: anything else answers with an error, which here just means
 * "no revenue to show".
 */
async function tryReport(
  token: string,
  params: Record<string, string>
): Promise<Record<string, string | number>[] | null> {
  try {
    return await report(token, params)
  } catch (err) {
    if (err instanceof YouTubeError && (err.status === 403 || err.status === 400)) return null
    throw err
  }
}

async function fetchPeriod(token: string): Promise<PeriodStats> {
  // Analytics lag a day or two behind; the window ends yesterday.
  const end = new Date(Date.now() - 86400000)
  const start = new Date(end.getTime() - (PERIOD_DAYS - 1) * 86400000)
  const range = { startDate: dayKey(start), endDate: dayKey(end) }

  const [totals] = await report(token, {
    ...range,
    metrics:
      'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares'
  })
  const days = await report(token, { ...range, dimensions: 'day', sort: 'day', metrics: 'views' })
  const money = await tryReport(token, {
    ...range,
    dimensions: 'day',
    sort: 'day',
    metrics: 'estimatedRevenue'
  })
  const revenueByDay = new Map(
    (money ?? []).map((r) => [String(r.day), Number(r.estimatedRevenue)])
  )

  const daily: DailyPoint[] = days.map((r) => ({
    date: String(r.day),
    views: Number(r.views),
    revenue: money ? (revenueByDay.get(String(r.day)) ?? 0) : undefined
  }))
  const revenue = money ? daily.reduce((sum, d) => sum + (d.revenue ?? 0), 0) : null

  return {
    days: PERIOD_DAYS,
    ...range,
    views: num(totals?.views) ?? 0,
    watchMinutes: num(totals?.estimatedMinutesWatched),
    avgViewDurationSec: num(totals?.averageViewDuration),
    followersGained: num(totals?.subscribersGained),
    followersLost: num(totals?.subscribersLost),
    likes: num(totals?.likes),
    comments: num(totals?.comments),
    shares: num(totals?.shares),
    revenue,
    daily
  }
}

/**
 * What only the owner sees, per video, over the channel's whole life:
 * retention, shares and revenue. The API gives at most 200 videos per
 * report, so it is the top 200 by views — the ones that matter.
 */
async function enrichVideos(token: string, since: string, videos: PlatformVideo[]): Promise<void> {
  await enrichRange(token, since, videos)
  // New videos rarely make the all-time top 200; for anything published in the
  // last 60 days a 60-day window is its whole life, so a second report covers them.
  const recentStart = new Date(Date.now() - RECENT_DAYS * 86400000)
  if (recentStart.toISOString().slice(0, 10) > since) {
    const recent = videos.filter((v) => new Date(v.publishedAt) >= recentStart)
    if (recent.length) await enrichRange(token, dayKey(recentStart), recent)
  }
}

const RECENT_DAYS = 60

async function enrichRange(token: string, since: string, videos: PlatformVideo[]): Promise<void> {
  const range = { startDate: since, endDate: dayKey(new Date()) }
  const rows = await report(token, {
    ...range,
    dimensions: 'video',
    sort: '-views',
    maxResults: '200',
    metrics: 'views,averageViewDuration,averageViewPercentage,shares'
  })
  const money = await tryReport(token, {
    ...range,
    dimensions: 'video',
    sort: '-estimatedRevenue',
    maxResults: '200',
    metrics: 'estimatedRevenue'
  })
  const byId = new Map(videos.map((v) => [v.externalId, v]))
  for (const r of rows) {
    const v = byId.get(String(r.video))
    if (!v) continue
    v.avgViewDurationSec = num(r.averageViewDuration)
    v.avgViewPercentage = num(r.averageViewPercentage)
    v.shares = num(r.shares)
  }
  for (const r of money ?? []) {
    const v = byId.get(String(r.video))
    if (v) v.revenue = num(r.estimatedRevenue)
  }
}

export interface YouTubeSnapshot {
  account: ReturnType<typeof accountFromChannel> & { period: PeriodStats }
  videos: PlatformVideo[]
}

export async function fetchYouTube(token: string, accountId: string): Promise<YouTubeSnapshot> {
  const channel = await fetchMyChannel(token)
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads
  const videos = uploads ? await fetchVideos(token, uploads, accountId) : []
  const period = await fetchPeriod(token)
  await enrichVideos(token, channel.snippet.publishedAt.slice(0, 10), videos)
  return { account: { ...accountFromChannel(channel), period }, videos }
}

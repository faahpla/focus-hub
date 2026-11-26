/**
 * Channels: the user's accounts on each platform and the numbers they give.
 *
 * A "channel" in the user's sense (DOPA, KINTAY…) is a board: each account is
 * tied to the board it publishes for, so one channel gathers its YouTube,
 * TikTok, Instagram and Facebook side by side.
 *
 * Kept on this PC only — never synced. Tokens live apart, encrypted, in the
 * main process; nothing here is a secret.
 */

import type { ID } from './types'

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook'

export const PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'facebook']

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook'
}

/** One day of a channel's numbers in the period. */
export interface DailyPoint {
  date: string // YYYY-MM-DD
  views: number
  revenue?: number
}

/**
 * The account's numbers over the recent period (the last 28 days, as the
 * platforms themselves show it). Every field here is the platform's own
 * figure; a field left out means the platform does not give it.
 */
export interface PeriodStats {
  days: number
  startDate: string
  endDate: string
  views: number
  watchMinutes?: number
  avgViewDurationSec?: number
  followersGained?: number
  followersLost?: number
  likes?: number
  comments?: number
  shares?: number
  /** In BRL. Null when the account has no revenue to show (not monetized, or no access). */
  revenue?: number | null
  daily: DailyPoint[]
}

export interface ChannelAccount {
  /** `${platform}:${externalId}` — stable across reconnects. */
  id: string
  platform: Platform
  externalId: string
  name: string
  handle?: string
  avatarUrl?: string
  /** The board (channel) this account publishes for. */
  boardId?: ID
  connectedAt: string
  lastSyncAt?: string
  /** Why the last update failed, in words for the user. Cleared on success. */
  lastError?: string
  /** Lifetime totals, as the platform reports them. */
  followers?: number
  totalViews?: number
  videoCount?: number
  period?: PeriodStats
}

/** A published video and its numbers — all official, from the platform. */
export interface PlatformVideo {
  /** `${platform}:${externalId}` */
  id: string
  accountId: string
  platform: Platform
  externalId: string
  title: string
  publishedAt: string
  url: string
  thumbnailUrl?: string
  durationSec?: number
  /** Inferred from the length (≤ 3 min); the API has no Shorts flag. */
  probablyShort?: boolean
  views: number
  likes?: number
  comments?: number
  shares?: number
  avgViewDurationSec?: number
  /** 0–100: how much of the video the average view watched. */
  avgViewPercentage?: number
  /** Lifetime, in BRL. */
  revenue?: number
}

/** Which platforms this build can connect (their app keys are present). */
export type PlatformAvailability = Record<Platform, boolean>

export interface ChannelsState {
  available: PlatformAvailability
  accounts: ChannelAccount[]
  videos: PlatformVideo[]
  /**
   * Video → card links set by hand. A card id links it; null means "this
   * video belongs to no card", so the automatic match stays out of it.
   */
  links: Record<string, ID | null>
  /** Account ids being updated right now. */
  syncing: string[]
  /** A login waiting for the user to open it in the right browser profile. */
  signIn: PendingSignIn | null
}

export interface PendingSignIn {
  platform: Platform
  url: string
}

/** A profile of a browser on this PC — each channel tends to live in its own. */
export interface BrowserProfile {
  /** `${browser}|${profile directory}` */
  id: string
  browser: string
  name: string
  email?: string
}

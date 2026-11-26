import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage, shell } from 'electron'
import type {
  BrowserProfile,
  ChannelAccount,
  ChannelsState,
  Platform,
  PlatformAvailability,
  PlatformVideo
} from '../../../shared/channels'
import { listBrowserProfiles, openInProfile } from './browsers'
import { type GoogleTokens, googleSignIn, refreshGoogleToken, SignInAgain } from './google-oauth'
import { fetchMyChannel, fetchYouTube, YOUTUBE_SCOPES } from './youtube'

/**
 * The user's accounts on each platform and their numbers.
 *
 * What is shown lives in channels.json; the access tokens live apart, in
 * channels-tokens.bin, encrypted by Windows for this user. Neither leaves
 * this PC, and the screen never sees a token.
 */

/** How often the numbers update on their own while the app is open. */
const AUTO_EVERY_MS = 6 * 60 * 60 * 1000
/** Shortly after opening — not in the way of the app starting. */
const FIRST_UPDATE_MS = 20 * 1000

type Stored = Pick<ChannelsState, 'accounts' | 'videos' | 'links'>
type TokenFile = Record<string, GoogleTokens>

export class ChannelsService {
  private readonly file: string
  private readonly tokenFile: string
  private data: Stored
  private syncing = new Set<string>()
  private timer: NodeJS.Timeout | null = null
  private attempt: AbortController | null = null
  private pending: { platform: Platform; url: string; abort: AbortController } | null = null

  constructor(private readonly onChange: (state: ChannelsState) => void) {
    const dir = app.getPath('userData')
    this.file = join(dir, 'channels.json')
    this.tokenFile = join(dir, 'channels-tokens.bin')
    this.data = this.load()
  }

  private get google(): { id: string; secret: string } | null {
    const id = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID
    const secret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET
    return id && secret ? { id, secret } : null
  }

  private available(): PlatformAvailability {
    return { youtube: this.google !== null, tiktok: false, instagram: false, facebook: false }
  }

  getState(): ChannelsState {
    return {
      available: this.available(),
      ...this.data,
      syncing: [...this.syncing],
      signIn: this.pending && { platform: this.pending.platform, url: this.pending.url }
    }
  }

  start(): void {
    setTimeout(() => void this.refreshAll(), FIRST_UPDATE_MS)
    this.timer = setInterval(() => void this.refreshAll(), AUTO_EVERY_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  // ---- Accounts ----

  async connect(platform: Platform): Promise<{ ok: boolean; error?: string; accountId?: string }> {
    if (platform !== 'youtube') return { ok: false, error: 'Essa rede ainda não está disponível.' }
    const google = this.google
    if (!google) return { ok: false, error: 'O login do Google não está configurado nesta versão.' }
    // A new attempt replaces one left hanging (tab closed, wrong profile…).
    this.attempt?.abort()
    const abort = new AbortController()
    this.attempt = abort
    try {
      const tokens = await googleSignIn(
        google.id,
        google.secret,
        YOUTUBE_SCOPES,
        (url) => {
          this.pending = { platform, url, abort }
          this.emit()
        },
        abort.signal
      )
      this.clearPending(abort)
      const channel = await fetchMyChannel(tokens.accessToken)
      const id = `youtube:${channel.id}`
      this.saveTokens({ ...this.readTokens(), [id]: tokens })
      if (!this.data.accounts.some((a) => a.id === id)) {
        this.data.accounts.push({
          id,
          platform: 'youtube',
          externalId: channel.id,
          name: channel.snippet.title,
          connectedAt: new Date().toISOString()
        })
      }
      this.persist()
      await this.refresh(id)
      return { ok: true, accountId: id }
    } catch (err) {
      this.clearPending(abort)
      // Cancelled by the user, or replaced by a newer attempt: nothing to report.
      if (abort.signal.aborted) return { ok: false }
      return { ok: false, error: err instanceof Error ? err.message : 'Não deu para conectar.' }
    }
  }

  /** Opens the waiting login in a browser profile; no profile = the default browser. */
  openSignIn(profileId: string | null): boolean {
    const url = this.pending?.url
    if (!url) return false
    if (profileId) return openInProfile(profileId, url)
    void shell.openExternal(url)
    return true
  }

  cancelSignIn(): void {
    this.attempt?.abort()
  }

  browserProfiles(): BrowserProfile[] {
    return listBrowserProfiles()
  }

  private clearPending(abort: AbortController): void {
    if (this.pending?.abort !== abort) return
    this.pending = null
    this.emit()
  }

  disconnect(accountId: string): void {
    const tokens = this.readTokens()
    delete tokens[accountId]
    this.saveTokens(tokens)
    const gone = new Set(this.data.videos.filter((v) => v.accountId === accountId).map((v) => v.id))
    this.data.accounts = this.data.accounts.filter((a) => a.id !== accountId)
    this.data.videos = this.data.videos.filter((v) => v.accountId !== accountId)
    for (const id of gone) delete this.data.links[id]
    this.persist()
  }

  setBoard(accountId: string, boardId: string | null): void {
    this.data.accounts = this.data.accounts.map((a) =>
      a.id === accountId ? { ...a, boardId: boardId ?? undefined } : a
    )
    this.persist()
  }

  link(videoId: string, cardId: string | null | undefined): void {
    if (cardId === undefined) delete this.data.links[videoId]
    else this.data.links[videoId] = cardId
    this.persist()
  }

  // ---- Updating ----

  async refreshAll(): Promise<void> {
    for (const account of this.data.accounts) await this.refresh(account.id)
  }

  async refresh(accountId: string): Promise<{ ok: boolean; error?: string }> {
    const account = this.data.accounts.find((a) => a.id === accountId)
    if (!account || this.syncing.has(accountId)) return { ok: false }
    this.syncing.add(accountId)
    this.emit()
    try {
      if (account.platform !== 'youtube') throw new Error('Rede ainda não suportada.')
      const token = await this.googleAccess(accountId)
      const snap = await fetchYouTube(token, accountId)
      this.update(accountId, {
        ...snap.account,
        lastSyncAt: new Date().toISOString(),
        lastError: undefined
      })
      this.replaceVideos(accountId, snap.videos)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não deu para atualizar.'
      this.update(accountId, { lastError: message })
      return { ok: false, error: message }
    } finally {
      this.syncing.delete(accountId)
      this.persist()
    }
  }

  private async googleAccess(accountId: string): Promise<string> {
    const google = this.google
    const all = this.readTokens()
    const tokens = all[accountId]
    if (!google || !tokens) throw new SignInAgain('Conecte a conta de novo.')
    if (tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken
    const fresh = await refreshGoogleToken(google.id, google.secret, tokens)
    this.saveTokens({ ...this.readTokens(), [accountId]: fresh })
    return fresh.accessToken
  }

  private update(accountId: string, patch: Partial<ChannelAccount>): void {
    this.data.accounts = this.data.accounts.map((a) =>
      a.id === accountId ? { ...a, ...patch } : a
    )
  }

  private replaceVideos(accountId: string, videos: PlatformVideo[]): void {
    this.data.videos = [...this.data.videos.filter((v) => v.accountId !== accountId), ...videos]
  }

  // ---- Files ----

  private emit(): void {
    this.onChange(this.getState())
  }

  private persist(): void {
    try {
      writeFileSync(this.file, JSON.stringify(this.data))
    } catch {
      /* shown anyway; the next update writes it again */
    }
    this.emit()
  }

  private load(): Stored {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Stored>
      return { accounts: raw.accounts ?? [], videos: raw.videos ?? [], links: raw.links ?? {} }
    } catch {
      return { accounts: [], videos: [], links: {} }
    }
  }

  private readTokens(): TokenFile {
    try {
      const raw = readFileSync(this.tokenFile)
      if (!safeStorage.isEncryptionAvailable()) return {}
      return JSON.parse(safeStorage.decryptString(raw)) as TokenFile
    } catch {
      return {}
    }
  }

  private saveTokens(tokens: TokenFile): void {
    // Without Windows encryption the tokens are not kept at all — never on disk in clear.
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(this.tokenFile, safeStorage.encryptString(JSON.stringify(tokens)))
  }
}

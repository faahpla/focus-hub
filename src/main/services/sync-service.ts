import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import {
  createClient,
  type RealtimePostgresChangesPayload,
  type Session,
  type SupabaseClient,
  type SupabaseClientOptions
} from '@supabase/supabase-js'
import WebSocket from 'ws'
import type { AppData, Board, BoardCard, CardAttachment } from '../../shared/types'
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_TTL_MS,
  contentTypeOf,
  storageKeyOf
} from './attachment-files'
import {
  FULL_PERMISSIONS,
  type BoardInvite,
  type BoardMember,
  type BoardShare,
  type SharePermissions,
  type SharePerson,
  type ShareRole,
  type SyncResult,
  type SyncState,
  type SyncStatus
} from '../../shared/sync'
import type { Repository } from '../store/repository'
import {
  applyPatch,
  boardFields,
  cardToRow,
  diffCard,
  permissionsOf,
  rowToCard,
  sameValue,
  type BoardRow,
  type CardRow,
  type MemberRow
} from './sync-mapping'
import { Outbox, type SyncOp } from './sync-outbox'

/**
 * Shared boards: keeps the boards a user chose to share in step with the
 * cloud, in both directions, without the screen knowing the cloud exists.
 *
 * Writes from this PC go to the Outbox first and are sent in order; reads come
 * from a full pull on connect and from realtime events after that. Wherever the
 * two meet, an edit made here and not yet sent wins over what the cloud says —
 * field by field, so nobody's change to a different field is lost.
 */

type Transport = NonNullable<NonNullable<SupabaseClientOptions<'public'>['realtime']>['transport']>
type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

/** postgres and PostgREST errors carry a code; a request that got no answer does not. */
interface ApiError {
  message: string
  code?: string
}

interface PersonRow {
  board_id: string
  user_id: string
  email: string
  is_owner: boolean
}

interface Snapshot {
  boards: BoardRow[]
  members: MemberRow[]
  cards: CardRow[]
  people: PersonRow[]
}

const PAGE = 1000
const RETRY_MIN = 2_000
const RETRY_MAX = 30_000

const UNCONFIGURED: SyncResult = {
  ok: false,
  error: 'Esta cópia do Focus HUB foi gerada sem a conexão com o servidor.'
}
const SIGNED_OUT: SyncResult = { ok: false, error: 'Entre na sua conta primeiro.' }

const NO_PERMISSIONS: SharePermissions = {
  createCards: false,
  deleteCards: false,
  manageColumns: false
}

const isNetworkError = (error: ApiError): boolean => !error.code

/** What the database says, said properly. Its own messages are plain ASCII. */
function describe(error: ApiError): string {
  if (isNetworkError(error)) return 'Sem conexão com o servidor. Tente de novo em instantes.'
  const m = error.message.toLowerCase()
  if (m.includes('convite nao encontrado')) return 'Código não encontrado. Confira se copiou certinho.'
  if (m.includes('convite expirado')) return 'Esse código expirou. Peça um novo para o dono do quadro.'
  if (m.includes('ja e o dono')) return 'Você já é o dono desse quadro.'
  if (m.includes('mexer nas colunas')) return 'Seu acesso não permite mexer nas colunas.'
  if (m.includes('so o dono')) return 'Só o dono do quadro pode fazer isso.'
  if (m.includes('entre na sua conta')) return 'Entre na sua conta antes de usar um código.'
  if (error.code === '42501') return 'Seu acesso a esse quadro não permite essa mudança.'
  return error.message
}

/**
 * Storage errors carry an HTTP status instead of a database code; one with no
 * status never got an answer, which is what "offline" looks like from here.
 */
interface StorageFailure {
  message: string
  status?: number
}

function storageToApi(error: StorageFailure): ApiError {
  if (error.status === undefined) return { message: error.message }
  const m = error.message.toLowerCase()
  let message = error.message
  if (error.status === 413 || m.includes('maximum allowed size') || m.includes('too large')) {
    message = 'Arquivo grande demais: o limite é 10 MB por arquivo.'
  } else if (error.status === 401 || error.status === 403 || m.includes('row-level security')) {
    message = 'Seu acesso a esse quadro não permite anexar ou apagar arquivos.'
  } else if (error.status === 404 || m.includes('not found')) {
    message = 'Esse arquivo não está mais na nuvem — anexos somem 2 dias depois de enviados.'
  }
  return { message, code: String(error.status) }
}

/** Files read from this PC, ready to go up. */
export interface LocalFile {
  name: string
  bytes: Buffer
}

function describeAuth(error: { message: string; code?: string }): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com esse e-mail. Use "Entrar".'
    case 'weak_password':
      return 'Essa senha é fraca demais. Use pelo menos 6 caracteres.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Esse e-mail não parece válido.'
    case 'email_not_confirmed':
      return 'O Supabase está pedindo confirmação por e-mail. Desligue "Confirm email" no painel.'
    case 'over_request_rate_limit':
      return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  }
  const m = error.message.toLowerCase()
  if (m.includes('fetch failed') || m.includes('network')) {
    return 'Sem conexão com o servidor. Tente de novo em instantes.'
  }
  return error.message
}

function sharedBoard(data: AppData, boardId: string): Board | undefined {
  const board = data.boards.find((b) => b.id === boardId)
  return board?.shared ? board : undefined
}

function cardIdsOf(data: AppData, boardId: string): Set<string> {
  return new Set(data.cards.filter((c) => c.boardId === boardId).map((c) => c.id))
}

/** Take a board and its cards off this PC. Mirrors Repository.deleteBoard. */
function removeBoard(data: AppData, boardId: string): void {
  const dropped = cardIdsOf(data, boardId)
  data.boards = data.boards.filter((b) => b.id !== boardId)
  data.cards = data.cards.filter((c) => c.boardId !== boardId)
  data.tasks = data.tasks.map((t) =>
    t.cardId && dropped.has(t.cardId) ? { ...t, cardId: undefined } : t
  )
}

function cloudBoardFields(
  row: BoardRow
): Pick<
  Board,
  'name' | 'icon' | 'color' | 'description' | 'columns' | 'personColors' | 'updatedAt'
> {
  return {
    name: row.name,
    icon: row.icon,
    color: row.color,
    description: row.description ?? undefined,
    columns: row.columns,
    personColors: row.person_colors ?? {},
    updatedAt: row.updated_at
  }
}

/**
 * Keeps the login across restarts. Encrypted with the OS keychain (DPAPI on
 * Windows) whenever Electron can: a refresh token is a password in all but
 * name, and should not sit in plain text next to the app's data.
 */
class SessionStore {
  constructor(private readonly path: string) {}

  getItem = (key: string): string | null => this.read()[key] ?? null

  setItem = (key: string, value: string): void => {
    const all = this.read()
    all[key] = value
    this.write(all)
  }

  removeItem = (key: string): void => {
    const all = this.read()
    delete all[key]
    this.write(all)
  }

  private read(): Record<string, string> {
    try {
      const raw = readFileSync(this.path)
      const text = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf8')
      return JSON.parse(text) as Record<string, string>
    } catch {
      return {}
    }
  }

  private write(all: Record<string, string>): void {
    const text = JSON.stringify(all)
    try {
      writeFileSync(
        this.path,
        safeStorage.isEncryptionAvailable()
          ? safeStorage.encryptString(text)
          : Buffer.from(text, 'utf8')
      )
    } catch {
      /* the login just won't survive a restart */
    }
  }
}

export class SyncService {
  private readonly sb: SupabaseClient | null
  private readonly outbox: Outbox
  private channel: ReturnType<SupabaseClient['channel']> | null = null
  private userId: string | null = null
  private email: string | null = null
  private state: SyncState
  private lastError: string | undefined
  private errorId = 0
  private flushing = false
  private pulling = false
  private pullAgain = false
  private retryDelay = RETRY_MIN
  private retryTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  private peopleTimer: NodeJS.Timeout | null = null
  private channelDown = false
  /**
   * Bumped whenever shared data changes here by any route other than the
   * screen. A pull that sees it move while reading throws its snapshot away:
   * what it read is already older than what this PC shows.
   */
  private seq = 0

  constructor(
    private readonly repo: Repository,
    private readonly onData: (data: AppData) => void,
    private readonly onStatus: (status: SyncStatus) => void
  ) {
    const dir = app.getPath('userData')
    this.outbox = new Outbox(join(dir, 'sync-outbox.json'))

    const url = import.meta.env.MAIN_VITE_SUPABASE_URL
    const key = import.meta.env.MAIN_VITE_SUPABASE_KEY
    if (!url || !key) {
      this.sb = null
      this.state = 'unconfigured'
      return
    }
    this.sb = createClient(url, key, {
      auth: {
        storage: new SessionStore(join(dir, 'sync-session.bin')),
        storageKey: 'focus-hub-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      // Electron 33 runs Node 20, which has no WebSocket of its own.
      realtime: { transport: WebSocket as unknown as Transport }
    })
    this.state = 'signed-out'
  }

  /** Resume the saved login, if there is one. Call once the app is ready. */
  async start(): Promise<void> {
    if (!this.sb) return this.emit()
    this.sb.auth.onAuthStateChange((event) => {
      // Calling back into supabase from inside this listener deadlocks on its
      // lock, so anything more than flipping state waits a tick.
      if (event === 'SIGNED_OUT') setTimeout(() => this.disconnect(), 0)
    })
    const { data } = await this.sb.auth.getSession()
    if (data.session) await this.connect(data.session)
    else this.emit()
  }

  status(): SyncStatus {
    return {
      state: this.state,
      email: this.email ?? undefined,
      userId: this.userId ?? undefined,
      pending: this.outbox.size,
      error: this.lastError,
      errorId: this.errorId
    }
  }

  // ---- Account -------------------------------------------------------------

  async signUp(email: string, password: string): Promise<SyncResult> {
    if (!this.sb) return UNCONFIGURED
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password })
    if (error) return { ok: false, error: describeAuth(error) }
    if (!data.session) {
      return {
        ok: false,
        error:
          'A conta foi criada, mas o Supabase pediu confirmação por e-mail, que não vai chegar. ' +
          'Desligue "Confirm email" no painel e use "Entrar".'
      }
    }
    await this.connect(data.session)
    return { ok: true }
  }

  async signIn(email: string, password: string): Promise<SyncResult> {
    if (!this.sb) return UNCONFIGURED
    const { data, error } = await this.sb.auth.signInWithPassword({
      email: email.trim(),
      password
    })
    if (error) return { ok: false, error: describeAuth(error) }
    await this.connect(data.session)
    return { ok: true }
  }

  /**
   * Shared boards stay on this PC and keep taking edits; they wait in the
   * queue and go up on the next sign-in.
   */
  async signOut(): Promise<void> {
    if (!this.sb) return
    await this.sb.auth.signOut()
    this.disconnect()
  }

  // ---- Sharing ---------------------------------------------------------------

  /** Put a board on this PC into the cloud, owned by the signed-in user. */
  async shareBoard(boardId: string): Promise<SyncResult> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const data = this.repo.getAll()
    const board = data.boards.find((b) => b.id === boardId)
    if (!board) return { ok: false, error: 'Quadro não encontrado.' }
    if (board.shared) return { ok: true }

    const created = await sb.from('boards').insert({ id: board.id, ...boardFields(board) })
    if (created.error) return this.refuse(created.error)

    const uploaded = data.cards.filter((c) => c.boardId === boardId)
    const rows = uploaded.map(cardToRow)
    for (let i = 0; i < rows.length; i += 200) {
      const sent = await sb.from('cards').insert(rows.slice(i, i + 200))
      if (sent.error) {
        // Half a board in the cloud is worse than none: take it back down.
        await sb.from('boards').delete().eq('id', boardId)
        return this.refuse(sent.error)
      }
    }

    const byId = new Map(uploaded.map((c) => [c.id, c]))
    this.applyRemote((d) => {
      const local = d.boards.find((b) => b.id === boardId)
      if (!local) return false
      // Seed the owner in, so cards can be assigned before the next pull.
      local.shared = {
        role: 'owner',
        can: { ...FULL_PERMISSIONS },
        people: [{ userId: this.userId!, email: this.email ?? '', isOwner: true }]
      }
      // Anything edited on this board while the upload ran was not part of it.
      for (const card of d.cards.filter((c) => c.boardId === boardId)) {
        const sent = byId.get(card.id)
        if (!sent) {
          this.outbox.push({ kind: 'card-insert', row: cardToRow(card) })
          continue
        }
        const patch = diffCard(sent, card)
        if (patch) this.outbox.push({ kind: 'card-patch', id: card.id, patch })
      }
    })
    this.kick()
    return { ok: true }
  }

  /** Owner: take a board out of the cloud for everyone, keeping it on this PC. */
  async unshareBoard(boardId: string): Promise<SyncResult> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    // Files first: once the board row is gone, the bucket's rules no longer
    // let anyone reach them, and they would sit there for good.
    await this.removeBoardFiles(boardId)
    const gone = await sb.from('boards').delete().eq('id', boardId)
    if (gone.error) return this.refuse(gone.error)
    this.applyRemote((d) => {
      const local = d.boards.find((b) => b.id === boardId)
      if (!local?.shared) return false
      this.outbox.dropBoard(boardId, cardIdsOf(d, boardId))
      delete local.shared
    })
    return { ok: true }
  }

  /** Member: stop having access to a board. Its copy leaves this PC. */
  async leaveBoard(boardId: string): Promise<SyncResult> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const left = await sb
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', this.userId)
    if (left.error) return this.refuse(left.error)
    this.applyRemote((d) => {
      if (!d.boards.some((b) => b.id === boardId)) return false
      this.outbox.dropBoard(boardId, cardIdsOf(d, boardId))
      removeBoard(d, boardId)
    })
    return { ok: true }
  }

  async joinBoard(code: string): Promise<SyncResult & { boardId?: string; boardName?: string }> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { data, error } = await sb.rpc('join_board', { invite_code: code })
    if (error) return this.refuse(error)
    await this.pull()
    const board = this.repo.getAll().boards.find((b) => b.id === data)
    return { ok: true, boardId: data as string, boardName: board?.name }
  }

  async createInvite(
    boardId: string,
    role: ShareRole,
    can: SharePermissions
  ): Promise<SyncResult & { code?: string }> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { data, error } = await sb.rpc('create_invite', {
      b: boardId,
      member_role: role,
      can_create: can.createCards,
      can_delete: can.deleteCards,
      can_manage: can.manageColumns
    })
    if (error) return this.refuse(error)
    return { ok: true, code: data as string }
  }

  async listInvites(boardId: string): Promise<BoardInvite[]> {
    if (!this.sb || !this.userId) return []
    const { data, error } = await this.sb
      .from('board_invites')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map((row) => ({
      code: row.code as string,
      role: row.role as ShareRole,
      can: permissionsOf(row as MemberRow),
      expiresAt: row.expires_at as string
    }))
  }

  async revokeInvite(code: string): Promise<SyncResult> {
    if (!this.sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { error } = await this.sb.from('board_invites').delete().eq('code', code)
    return error ? this.refuse(error) : { ok: true }
  }

  async listMembers(boardId: string): Promise<BoardMember[]> {
    if (!this.sb || !this.userId) return []
    const { data, error } = await this.sb
      .from('board_members')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at')
    if (error || !data) return []
    return (data as MemberRow[]).map((row) => ({
      userId: row.user_id,
      email: row.email,
      role: row.role,
      can: permissionsOf(row)
    }))
  }

  async updateMember(
    boardId: string,
    userId: string,
    role: ShareRole,
    can: SharePermissions
  ): Promise<SyncResult> {
    if (!this.sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { error } = await this.sb.rpc('set_member_permissions', {
      b: boardId,
      member: userId,
      member_role: role,
      can_create: can.createCards,
      can_delete: can.deleteCards,
      can_manage: can.manageColumns
    })
    return error ? this.refuse(error) : { ok: true }
  }

  async removeMember(boardId: string, userId: string): Promise<SyncResult> {
    if (!this.sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { error } = await this.sb
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId)
    return error ? this.refuse(error) : { ok: true }
  }

  // ---- Attachments ---------------------------------------------------------------

  /**
   * Send files up for a card on a shared board. All or nothing: if one fails,
   * the ones already up are taken back down — half an upload is clutter.
   */
  async uploadAttachments(
    boardId: string,
    files: LocalFile[]
  ): Promise<SyncResult & { attachments?: CardAttachment[] }> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const done: CardAttachment[] = []
    for (const file of files) {
      const id = randomUUID()
      const key = storageKeyOf(boardId, id, file.name)
      const { error } = await sb.storage
        .from(ATTACHMENT_BUCKET)
        .upload(key, file.bytes, { contentType: contentTypeOf(file.name), upsert: false })
      if (error) {
        if (done.length) {
          await sb.storage.from(ATTACHMENT_BUCKET).remove(done.map((a) => a.storagePath!))
        }
        return this.refuse(storageToApi(error as StorageFailure))
      }
      const now = Date.now()
      done.push({
        id,
        name: file.name,
        size: file.bytes.length,
        storagePath: key,
        uploadedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + ATTACHMENT_TTL_MS).toISOString()
      })
    }
    return { ok: true, attachments: done }
  }

  async downloadAttachment(storagePath: string): Promise<SyncResult & { bytes?: Buffer }> {
    const sb = this.sb
    if (!sb) return UNCONFIGURED
    if (!this.userId) return SIGNED_OUT
    const { data, error } = await sb.storage.from(ATTACHMENT_BUCKET).download(storagePath)
    if (error || !data) return this.refuse(storageToApi((error ?? { message: 'vazio' }) as StorageFailure))
    return { ok: true, bytes: Buffer.from(await data.arrayBuffer()) }
  }

  /** Best effort: a file that fails to go now is caught by the two-day sweep. */
  async removeStoredFiles(paths: string[]): Promise<void> {
    if (!this.sb || !this.userId || paths.length === 0) return
    await this.sb.storage.from(ATTACHMENT_BUCKET).remove(paths)
  }

  /**
   * Delete what is past its two days, on every shared board this user can
   * edit. Two passes, because they catch different leftovers: the cards'
   * own lists lose their expired entries, and the board's folder is swept
   * by file age — which also clears files whose card was deleted or moved,
   * and that no list points at any more.
   */
  private async sweepExpired(): Promise<void> {
    if (!this.sb || !this.userId) return
    const now = Date.now()
    const data = this.repo.getAll()

    for (const card of data.cards) {
      if (!sharedBoard(data, card.boardId)) continue
      const expired = (card.attachments ?? []).filter(
        (a) => a.expiresAt && Date.parse(a.expiresAt) <= now
      )
      if (expired.length === 0) continue
      const gone = new Set(expired.map((a) => a.id))
      this.rewriteCard(card.id, (c) => ({
        ...c,
        attachments: (c.attachments ?? []).filter((a) => !gone.has(a.id))
      }))
    }

    for (const board of data.boards) {
      if (!board.shared) continue
      const { data: files, error } = await this.sb.storage
        .from(ATTACHMENT_BUCKET)
        .list(board.id, { limit: 1000 })
      if (error || !files) continue
      const stale = files
        .filter((f) => f.created_at && now - Date.parse(f.created_at) > ATTACHMENT_TTL_MS)
        .map((f) => `${board.id}/${f.name}`)
      if (stale.length) await this.sb.storage.from(ATTACHMENT_BUCKET).remove(stale)
    }
  }

  /** Everything a board keeps in the bucket, before the board itself goes. */
  private async removeBoardFiles(boardId: string): Promise<void> {
    if (!this.sb) return
    const { data: files } = await this.sb.storage
      .from(ATTACHMENT_BUCKET)
      .list(boardId, { limit: 1000 })
    if (files?.length) {
      await this.sb.storage.from(ATTACHMENT_BUCKET).remove(files.map((f) => `${boardId}/${f.name}`))
    }
  }

  /**
   * Change one card from here — not from the screen — and queue the change
   * like any other edit. The holder object is there because TypeScript does
   * not follow assignments made inside the callback.
   */
  private rewriteCard(cardId: string, change: (card: BoardCard) => BoardCard): void {
    const box: { before?: BoardCard; after?: BoardCard } = {}
    const data = this.repo.apply((d) => {
      const i = d.cards.findIndex((c) => c.id === cardId)
      if (i < 0) return false
      box.before = structuredClone(d.cards[i])
      box.after = { ...change(d.cards[i]), updatedAt: new Date().toISOString() }
      d.cards[i] = box.after
    })
    if (!data || !box.before || !box.after) return
    const patch = diffCard(box.before, box.after)
    if (patch && sharedBoard(data, box.after.boardId)) {
      this.outbox.push({ kind: 'card-patch', id: cardId, patch })
    }
    this.onData(data)
    this.kick()
  }

  // ---- Changes made on this PC -----------------------------------------------
  //
  // The check* methods run before a write is applied; a reason back means the
  // write is refused and the screen gets the unchanged document. The database
  // enforces the same rules — these exist so a refused change never shows up
  // here first and then vanishes.

  checkCardWrite(before: BoardCard | undefined, after: BoardCard, data: AppData): string | null {
    const leaving =
      before && before.boardId !== after.boardId ? sharedBoard(data, before.boardId) : undefined
    if (leaving?.shared?.role === 'member' && !leaving.shared.can.deleteCards) {
      return 'Seu acesso não permite tirar cards desse quadro.'
    }
    const board = sharedBoard(data, after.boardId)
    if (!board?.shared || board.shared.role === 'owner') return null
    const arriving = !before || before.boardId !== after.boardId
    if (arriving && !board.shared.can.createCards) {
      return 'Seu acesso a esse quadro não inclui criar cards.'
    }
    return null
  }

  checkCardDelete(card: BoardCard | undefined, data: AppData): string | null {
    if (!card) return null
    const board = sharedBoard(data, card.boardId)
    if (!board?.shared || board.shared.role === 'owner') return null
    return board.shared.can.deleteCards ? null : 'Seu acesso a esse quadro não inclui excluir cards.'
  }

  checkBoardWrite(before: Board | undefined, after: Board): string | null {
    const share = before?.shared
    if (!before || !share || share.role === 'owner') return null
    const look = (b: Board): unknown[] => [b.name, b.icon, b.color, b.description ?? null]
    if (!sameValue(look(before), look(after))) return 'Só o dono muda o nome e a aparência do quadro.'
    if (!sameValue(before.personColors ?? {}, after.personColors ?? {})) {
      return 'Só o dono do quadro escolhe as cores das pessoas.'
    }
    if (!sameValue(before.columns, after.columns) && !share.can.manageColumns) {
      return 'Seu acesso não permite mexer nas colunas.'
    }
    return null
  }

  /** A refused write: tell the user once, through the status. */
  refused(reason: string): void {
    this.notice(reason)
  }

  /** The screen saved cards. `before` holds them as they were. */
  cardsWritten(before: Map<string, BoardCard>, data: AppData, ids: string[]): void {
    for (const id of ids) {
      const prev = before.get(id)
      const next = data.cards.find((c) => c.id === id)
      if (!next) continue
      const was = prev !== undefined && sharedBoard(data, prev.boardId) !== undefined
      const is = sharedBoard(data, next.boardId) !== undefined
      if (was && is && prev) {
        const patch = diffCard(prev, next)
        if (patch) this.outbox.push({ kind: 'card-patch', id, patch })
      } else if (is) {
        this.outbox.push({ kind: 'card-insert', row: cardToRow(next) })
      } else if (was) {
        this.outbox.push({ kind: 'card-delete', id })
      }
    }
    this.kick()
  }

  cardDeleted(card: BoardCard | undefined, data: AppData): void {
    if (!card || !sharedBoard(data, card.boardId)) return
    this.outbox.push({ kind: 'card-delete', id: card.id })
    this.kick()
  }

  boardWritten(before: Board | undefined, after: Board): void {
    const share = after.shared
    if (!share || !before) return
    if (sameValue(boardFields(before), boardFields(after))) return
    if (share.role === 'owner') {
      this.outbox.push({ kind: 'board-update', id: after.id, fields: boardFields(after) })
    } else {
      this.outbox.push({ kind: 'board-columns', id: after.id, columns: after.columns })
    }
    this.kick()
  }

  /**
   * The screen deleted a board. A shared one goes for everyone when its owner
   * deletes it; a member deleting it is leaving it.
   */
  boardDeleted(board: Board | undefined, cardIds: Set<string>): void {
    if (!board?.shared) return
    this.outbox.dropBoard(board.id, cardIds)
    this.outbox.push({
      kind: board.shared.role === 'owner' ? 'board-delete' : 'board-leave',
      id: board.id
    })
    this.kick()
  }

  // ---- Connection --------------------------------------------------------------

  private async connect(session: Session): Promise<void> {
    this.userId = session.user.id
    this.email = session.user.email ?? null
    this.lastError = undefined
    this.state = 'connecting'
    this.emit()
    this.subscribe()
    // Send first: edits made offline must reach the cloud before its copy is
    // read back, or the read would briefly undo them.
    await this.flush()
    await this.pull()
    // Expired attachments go now and then every hour while signed in.
    void this.sweepExpired()
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.cleanupTimer = setInterval(() => void this.sweepExpired(), 60 * 60 * 1000)
  }

  private disconnect(): void {
    if (this.channel && this.sb) void this.sb.removeChannel(this.channel)
    this.channel = null
    this.userId = null
    this.email = null
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.cleanupTimer = null
    this.channelDown = false
    this.state = this.sb ? 'signed-out' : 'unconfigured'
    this.emit()
  }

  private subscribe(): void {
    if (!this.sb || this.channel) return
    this.channel = this.sb
      .channel('focus-hub-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, (p) =>
        this.onCardEvent(p)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, (p) =>
        this.onBoardEvent(p)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_members' }, (p) =>
        this.onMemberEvent(p)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Events sent while the socket was down are gone for good, so after
          // a gap the only way to catch up is reading everything again.
          if (this.channelDown) {
            this.channelDown = false
            void this.flush().then(() => this.pull())
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.channelDown = true
        }
      })
  }

  private kick(): void {
    this.emit()
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (!this.sb || !this.userId || this.flushing) return
    this.flushing = true
    let reached = false
    try {
      for (let op = this.outbox.peek(); op; op = this.outbox.peek()) {
        this.outbox.begin(op)
        const error = await this.send(op)
        if (error && isNetworkError(error)) {
          this.outbox.release(op)
          this.goOffline()
          return
        }
        reached = true
        this.outbox.done(op)
        this.seq++
        if (error) {
          // Refused for good — permissions, or a board that is gone. Drop it
          // and read the truth back, so this PC stops showing a change the
          // cloud never accepted.
          this.notice(describe(error))
          void this.pull()
        }
      }
      if (reached) this.setOnline()
    } finally {
      this.flushing = false
      this.emit()
    }
  }

  private async send(op: SyncOp): Promise<ApiError | null> {
    const sb = this.sb!
    switch (op.kind) {
      case 'card-insert':
        // Upsert, so a retry after a lost response does not fail as a duplicate.
        return (await sb.from('cards').upsert(op.row)).error
      case 'card-patch':
        return (
          await sb.rpc('patch_card', {
            card_id: op.id,
            fields: op.patch.set,
            removed: op.patch.unset,
            new_column: op.patch.column ?? null,
            new_order: op.patch.order ?? null,
            new_board: op.patch.board ?? null
          })
        ).error
      case 'card-delete':
        return (await sb.from('cards').delete().eq('id', op.id)).error
      case 'board-update':
        return (await sb.from('boards').update(op.fields).eq('id', op.id)).error
      case 'board-columns':
        return (await sb.rpc('set_board_columns', { b: op.id, cols: op.columns })).error
      case 'board-delete':
        // Same order as unshareBoard: files can only be reached while the board exists.
        await this.removeBoardFiles(op.id)
        return (await sb.from('boards').delete().eq('id', op.id)).error
      case 'board-leave':
        return (
          await sb.from('board_members').delete().eq('board_id', op.id).eq('user_id', this.userId!)
        ).error
    }
  }

  /** Read everything shared with this user and make this PC match it. */
  private async pull(): Promise<void> {
    if (!this.sb || !this.userId) return
    if (this.pulling) {
      this.pullAgain = true
      return
    }
    this.pulling = true
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const seqAtStart = this.seq
        const snapshot = await this.fetchAll()
        if (!snapshot) return
        if (this.seq !== seqAtStart) continue
        this.applySnapshot(snapshot)
        this.setOnline()
        return
      }
      // Never got a quiet moment to read in; try again shortly rather than
      // laying a stale copy over newer data.
      setTimeout(() => void this.pull(), 3_000)
    } finally {
      this.pulling = false
      if (this.pullAgain) {
        this.pullAgain = false
        void this.pull()
      }
    }
  }

  private async fetchAll(): Promise<Snapshot | null> {
    const sb = this.sb!
    const boards = await sb.from('boards').select('*')
    if (boards.error) return this.failRead(boards.error)
    const members = await sb.from('board_members').select('*').eq('user_id', this.userId!)
    if (members.error) return this.failRead(members.error)

    const ids = (boards.data as BoardRow[]).map((b) => b.id)
    const cards: CardRow[] = []
    for (let from = 0; ids.length > 0; from += PAGE) {
      const page = await sb
        .from('cards')
        .select('*')
        .in('board_id', ids)
        .order('id')
        .range(from, from + PAGE - 1)
      if (page.error) return this.failRead(page.error)
      cards.push(...(page.data as CardRow[]))
      if (page.data.length < PAGE) break
    }

    // Who is on each board. Names are a nicety: if this read fails the sync
    // carries on, and cards just show no one for now.
    const people = await sb.rpc('my_board_people')
    return {
      boards: boards.data as BoardRow[],
      members: members.data as MemberRow[],
      cards,
      people: people.error ? [] : (people.data as PersonRow[])
    }
  }

  private applySnapshot({ boards, members, cards, people }: Snapshot): void {
    const permissions = new Map(members.map((m) => [m.board_id, m]))
    const peopleOf = new Map<string, SharePerson[]>()
    for (const p of people) {
      const list = peopleOf.get(p.board_id) ?? []
      list.push({ userId: p.user_id, email: p.email, isOwner: p.is_owner })
      peopleOf.set(p.board_id, list)
    }
    const pending = this.outbox.pendingCards()
    // A board this PC is deleting or leaving stays gone, whatever the cloud says.
    const live = boards.filter((b) => !this.outbox.isBoardGoing(b.id))
    const inCloud = new Set(live.map((b) => b.id))

    this.applyRemote((data) => {
      for (const row of live) {
        const member = permissions.get(row.id)
        const shared: BoardShare = {
          ...(row.owner_id === this.userId
            ? { role: 'owner' as const, can: { ...FULL_PERMISSIONS } }
            : {
                role: 'member' as const,
                can: member ? permissionsOf(member) : { ...NO_PERMISSIONS }
              }),
          people: peopleOf.get(row.id) ?? []
        }
        const local = data.boards.find((b) => b.id === row.id)
        if (local) {
          if (!this.outbox.hasBoardEdit(row.id)) Object.assign(local, cloudBoardFields(row))
          local.shared = shared
        } else {
          data.boards.push({
            id: row.id,
            ...cloudBoardFields(row),
            createdAt: row.created_at,
            archived: false,
            order: data.boards.length,
            shared
          })
        }
      }

      // Shared here, gone from the cloud: access was removed or the owner took
      // it down. A member loses the board; an owner keeps it, now only local.
      for (const board of [...data.boards]) {
        if (!board.shared || inCloud.has(board.id) || this.outbox.isBoardGoing(board.id)) continue
        if (board.shared.role === 'member') {
          this.outbox.dropBoard(board.id, cardIdsOf(data, board.id))
          removeBoard(data, board.id)
        } else {
          delete board.shared
        }
      }

      // Cards of shared boards: the cloud's copy, with this PC's unsent edits on top.
      data.cards = data.cards.filter((c) => !inCloud.has(c.boardId) || pending.inserts.has(c.id))
      for (const row of cards) {
        if (!inCloud.has(row.board_id)) continue
        if (pending.inserts.has(row.id) || pending.deletes.has(row.id)) continue
        const patch = pending.patches.get(row.id)
        data.cards.push(patch ? applyPatch(rowToCard(row), patch) : rowToCard(row))
      }
    })
  }

  // ---- Realtime ----------------------------------------------------------------

  private onCardEvent(p: Payload): void {
    if (!this.userId) return
    if (p.eventType === 'DELETE') {
      const id = (p.old as Partial<CardRow>).id
      if (!id) return
      this.applyRemote((data) => {
        const card = data.cards.find((c) => c.id === id)
        if (!card || !sharedBoard(data, card.boardId)) return false
        data.cards = data.cards.filter((c) => c.id !== id)
      })
      return
    }
    const row = p.new as unknown as CardRow
    // Our own write coming back: this PC is already at least that far along.
    if (row.updated_by === this.userId) return
    this.applyRemote((data) => {
      if (!sharedBoard(data, row.board_id)) return false
      const pending = this.outbox.pendingCards()
      if (pending.deletes.has(row.id)) return false
      const patch = pending.patches.get(row.id)
      const card = patch ? applyPatch(rowToCard(row), patch) : rowToCard(row)
      const i = data.cards.findIndex((c) => c.id === row.id)
      if (i >= 0) data.cards[i] = card
      else data.cards.push(card)
    })
  }

  private onBoardEvent(p: Payload): void {
    if (!this.userId) return
    if (p.eventType === 'DELETE') {
      const id = (p.old as Partial<BoardRow>).id
      if (!id) return
      this.applyRemote((data) => {
        const board = data.boards.find((b) => b.id === id)
        if (!board?.shared) return false
        if (board.shared.role === 'member') {
          this.outbox.dropBoard(id, cardIdsOf(data, id))
          removeBoard(data, id)
        } else {
          delete board.shared
        }
      })
      return
    }
    const row = p.new as unknown as BoardRow
    // Boards carry no author, so an edit of ours coming back is spotted by
    // still having it queued — and must not undo a newer one made since.
    if (this.outbox.hasBoardEdit(row.id)) return
    this.applyRemote((data) => {
      const board = data.boards.find((b) => b.id === row.id)
      // A board just joined has no copy here yet; the pull after joining brings it.
      if (!board?.shared) return false
      Object.assign(board, cloudBoardFields(row))
    })
  }

  private onMemberEvent(p: Payload): void {
    if (!this.userId) return
    if (p.eventType === 'DELETE') {
      const old = p.old as Partial<MemberRow>
      if (!old.board_id) return
      // Someone else left or was removed: the list of people changed.
      if (old.user_id !== this.userId) return this.refreshPeopleSoon()
      const boardId = old.board_id
      this.applyRemote((data) => {
        const board = data.boards.find((b) => b.id === boardId)
        if (board?.shared?.role !== 'member') return false
        this.outbox.dropBoard(boardId, cardIdsOf(data, boardId))
        removeBoard(data, boardId)
      })
      return
    }
    const row = p.new as unknown as MemberRow
    // Someone else joined, or had their access changed.
    if (row.user_id !== this.userId) return this.refreshPeopleSoon()
    if (!this.repo.getAll().boards.some((b) => b.id === row.board_id)) {
      void this.pull()
      return
    }
    this.applyRemote((data) => {
      const board = data.boards.find((b) => b.id === row.board_id)
      if (!board) return false
      // Spread first: replacing `shared` outright would drop the board's people.
      board.shared = { ...board.shared, role: 'member', can: permissionsOf(row) }
    })
  }

  /**
   * Re-read who is on each board, shortly. Membership events come in bursts —
   * a join is an insert and an invite delete — so wait for them to settle.
   */
  private refreshPeopleSoon(): void {
    if (this.peopleTimer) clearTimeout(this.peopleTimer)
    this.peopleTimer = setTimeout(() => {
      this.peopleTimer = null
      void this.pull()
    }, 1500)
  }

  // ---- Plumbing ------------------------------------------------------------------

  private applyRemote(change: (data: AppData) => boolean | void): void {
    const data = this.repo.apply(change)
    if (!data) return
    this.seq++
    this.onData(data)
  }

  private refuse(error: ApiError): SyncResult {
    if (isNetworkError(error)) this.goOffline()
    return { ok: false, error: describe(error) }
  }

  private failRead(error: ApiError): null {
    if (isNetworkError(error)) this.goOffline()
    else this.notice(describe(error))
    return null
  }

  private goOffline(): void {
    if (!this.userId) return
    if (this.state !== 'offline') {
      this.state = 'offline'
      this.emit()
    }
    if (this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.flush().then(() => this.pull())
    }, this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX)
  }

  private setOnline(): void {
    this.retryDelay = RETRY_MIN
    if (this.state !== 'online') {
      this.state = 'online'
      this.emit()
    }
  }

  private notice(message: string): void {
    this.lastError = message
    this.errorId++
    this.emit()
  }

  private emit(): void {
    this.onStatus(this.status())
  }
}

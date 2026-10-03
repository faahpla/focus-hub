/**
 * Shared boards — what the screen needs to know about the cloud side.
 *
 * Only boards the user chooses to share ever leave the PC. Everything here
 * describes those boards and the account that reaches them; finance, sessions,
 * projects and unshared boards have no representation in the cloud at all.
 */

/** What a member may do on top of reading, editing and moving cards. */
export interface SharePermissions {
  createCards: boolean
  deleteCards: boolean
  manageColumns: boolean
}

/**
 * "editor" is the one-click preset with every permission on; "custom" is a
 * hand-picked set. The flags are the authority — the role is the label.
 */
export type ShareRole = 'editor' | 'custom'

export const FULL_PERMISSIONS: SharePermissions = {
  createCards: true,
  deleteCards: true,
  manageColumns: true
}

/** Someone on a shared board — whom a card can be assigned to. */
export interface SharePerson {
  userId: string
  email: string
  isOwner: boolean
}

/** How a board on this PC relates to the cloud. Absent on unshared boards. */
export interface BoardShare {
  /** The owner can do everything; a member only what `can` allows. */
  role: 'owner' | 'member'
  can: SharePermissions
  /**
   * Owner and members, refreshed on every pull. Kept here, on the board,
   * so drawing who a card belongs to never waits on the network.
   */
  people?: SharePerson[]
}

export type SyncState =
  /** Built without the Supabase keys — sharing does not exist in this copy. */
  | 'unconfigured'
  | 'signed-out'
  | 'connecting'
  | 'online'
  /** Signed in but unreachable. Edits keep working and wait in the queue. */
  | 'offline'

export interface SyncStatus {
  state: SyncState
  email?: string
  /** The signed-in account — what makes a card read "você" rather than an e-mail. */
  userId?: string
  /** Changes made here that have not reached the cloud yet. */
  pending: number
  /** The last thing worth telling the user, already in Portuguese. */
  error?: string
  /**
   * Goes up by one each time something new goes wrong, so the screen can
   * show a notice per occurrence — the same message twice is still two events.
   */
  errorId: number
}

export interface BoardMember {
  userId: string
  email: string
  role: ShareRole
  can: SharePermissions
}

export interface BoardInvite {
  code: string
  role: ShareRole
  can: SharePermissions
  expiresAt: string
}

export interface SyncResult {
  ok: boolean
  error?: string
}

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { PLATFORMS, type Platform } from '../../shared/channels'
import type { ChannelsService } from '../services/channels/channels-service'

/** The Channels page's calls. Ids are checked here: the screen is not trusted with shapes. */
export function registerChannelsIpc(channels: ChannelsService): void {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')

  ipcMain.handle(IPC.CHANNELS_GET, () => channels.getState())
  ipcMain.handle(IPC.CHANNELS_CONNECT, (_e, platform: unknown) =>
    PLATFORMS.includes(platform as Platform)
      ? channels.connect(platform as Platform)
      : { ok: false, error: 'Rede desconhecida.' }
  )
  ipcMain.handle(IPC.CHANNELS_DISCONNECT, (_e, accountId: unknown) =>
    channels.disconnect(str(accountId))
  )
  ipcMain.handle(IPC.CHANNELS_REFRESH, async (_e, accountId: unknown) => {
    if (typeof accountId === 'string') return channels.refresh(accountId)
    await channels.refreshAll()
    return { ok: true }
  })
  ipcMain.handle(IPC.CHANNELS_SET_BOARD, (_e, accountId: unknown, boardId: unknown) =>
    channels.setBoard(str(accountId), typeof boardId === 'string' ? boardId : null)
  )
  ipcMain.handle(IPC.CHANNELS_BROWSERS, () => channels.browserProfiles())
  ipcMain.handle(IPC.CHANNELS_SIGNIN_OPEN, (_e, profileId: unknown) =>
    channels.openSignIn(typeof profileId === 'string' ? profileId : null)
  )
  ipcMain.handle(IPC.CHANNELS_SIGNIN_CANCEL, () => channels.cancelSignIn())
  ipcMain.handle(IPC.CHANNELS_LINK, (_e, videoId: unknown, cardId: unknown) =>
    channels.link(
      str(videoId),
      typeof cardId === 'string' ? cardId : cardId === null ? null : undefined
    )
  )
}

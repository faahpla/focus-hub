import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../../shared/types'

/**
 * Wraps electron-updater so the renderer can show what's happening instead of
 * updates being an invisible background process. Updates come from GitHub
 * Releases (configured in electron-builder.yml).
 */
export class UpdateService {
  private status: UpdateStatus = { state: 'idle' }

  constructor(private readonly onChange: (status: UpdateStatus) => void) {
    // Download as soon as an update is found, but never install behind the
    // user's back — installing is always an explicit click (or app quit).
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (info) =>
      this.set({ state: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () => this.set({ state: 'not-available' }))
    autoUpdater.on('download-progress', (p) =>
      this.set({
        state: 'downloading',
        version: this.status.version,
        percent: Math.round(p.percent)
      })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.set({ state: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (err) =>
      this.set({ state: 'error', message: err?.message || 'Falha ao verificar atualizações.' })
    )
  }

  private set(status: UpdateStatus): void {
    this.status = status
    this.onChange(status)
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  async check(): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      this.set({ state: 'unsupported' })
      return this.status
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.set({
        state: 'error',
        message: err instanceof Error ? err.message : 'Falha ao verificar atualizações.'
      })
    }
    return this.status
  }

  /** Only meaningful once the state is 'downloaded'. */
  install(beforeQuit: () => void): void {
    if (this.status.state !== 'downloaded') return
    beforeQuit()
    autoUpdater.quitAndInstall()
  }
}

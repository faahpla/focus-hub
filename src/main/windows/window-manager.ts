import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { APP_ORIGIN } from '../register-protocol'
import appIcon from '../../../resources/icon.png?asset'

const preload = join(__dirname, '../preload/index.js')

/**
 * Renderer URL — the Vite dev server when running under electron-vite (which
 * sets ELECTRON_RENDERER_URL), otherwise the built files served over app://.
 * This covers both the packaged app and running the built output directly.
 */
function rendererUrl(hash = ''): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) return `${devUrl}${hash}`
  return `${APP_ORIGIN}/index.html${hash}`
}

export class WindowManager {
  private main: BrowserWindow | null = null
  private quickCapture: BrowserWindow | null = null

  getMain(): BrowserWindow | null {
    return this.main
  }

  createMain(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 880,
      minHeight: 620,
      show: false,
      frame: false,
      icon: appIcon,
      titleBarStyle: 'hidden',
      backgroundColor: '#0a0a0f',
      roundedCorners: true,
      webPreferences: {
        preload,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    win.on('ready-to-show', () => win.show())
    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // Forward renderer diagnostics to the main-process stdout so they show up
    // in the terminal / dev log (invaluable when the window renders black).
    win.webContents.on('console-message', (_e, level, message, line, source) => {
      console.log(`[renderer:${level}] ${message} (${source}:${line})`)
    })
    win.webContents.on('preload-error', (_e, preloadPath, error) => {
      console.error(`[preload-error] ${preloadPath}:`, error)
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[did-fail-load] ${code} ${desc} ${url}`)
    })

    win.loadURL(rendererUrl())

    win.on('closed', () => {
      this.main = null
    })

    this.main = win
    return win
  }

  showMain(): void {
    if (!this.main) {
      this.createMain()
      return
    }
    if (this.main.isMinimized()) this.main.restore()
    this.main.show()
    this.main.focus()
  }

  /** Small, centered-top, always-on-top window for capturing an idea fast. */
  openQuickCapture(): void {
    if (this.quickCapture) {
      this.quickCapture.show()
      this.quickCapture.focus()
      return
    }
    const { width } = screen.getPrimaryDisplay().workAreaSize
    const w = 560
    const h = 190
    const win = new BrowserWindow({
      width: w,
      height: h,
      x: Math.round(width / 2 - w / 2),
      y: 140,
      show: false,
      frame: false,
      resizable: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      webPreferences: { preload, sandbox: false, contextIsolation: true }
    })

    win.on('ready-to-show', () => {
      win.show()
      win.focus()
    })
    win.on('blur', () => this.closeQuickCapture())
    win.on('closed', () => {
      this.quickCapture = null
    })

    win.loadURL(rendererUrl('#/quick-capture'))

    this.quickCapture = win
  }

  closeQuickCapture(): void {
    if (this.quickCapture && !this.quickCapture.isDestroyed()) {
      this.quickCapture.close()
    }
    this.quickCapture = null
  }

  broadcast(channel: string, ...args: unknown[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, ...args)
    }
  }

  sendToMain(channel: string, ...args: unknown[]): void {
    this.main?.webContents.send(channel, ...args)
  }
}

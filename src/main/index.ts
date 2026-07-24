import { app, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { autoUpdater } from 'electron-updater'
import { IPC } from '../shared/ipc'
import { registerIpc } from './ipc/register-ipc'
import { registerAppScheme, serveRenderer } from './register-protocol'
import { FlowService } from './services/flow-service'
import { Repository } from './store/repository'
import { WindowManager } from './windows/window-manager'
import appIcon from '../../resources/icon.png?asset'

// Must run before the app "ready" event.
registerAppScheme()

const repo = new Repository()
const flow = new FlowService()
const windows = new WindowManager()
let tray: Tray | null = null
let isQuitting = false

function trayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromPath(appIcon)
  // Windows tray expects a small icon; downscale the 256px source.
  return img.isEmpty() ? img : img.resize({ width: 16, height: 16 })
}

function buildTray(): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('Focus HUB')
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Focus HUB', click: () => windows.showMain() },
    { type: 'separator' },
    {
      label: 'Nova sessão',
      click: () => {
        windows.showMain()
        windows.sendToMain(IPC.EVT_TRAY_NEW_SESSION)
      }
    },
    { label: 'Capturar ideia', click: () => windows.openQuickCapture() },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => windows.showMain())
}

/**
 * Relaunch the whole app elevated (triggers one UAC prompt). Used so the
 * hosts-file site blocking can work. In dev we forward the current argv so the
 * elevated Electron re-opens the same entry.
 */
function relaunchElevated(): void {
  const exe = process.execPath
  const argList = app.isPackaged
    ? ''
    : process.argv
        .slice(1)
        .map((a) => `'${a.replace(/'/g, "''")}'`)
        .join(',')
  const cmd = argList
    ? `Start-Process -FilePath '${exe}' -Verb RunAs -ArgumentList ${argList}`
    : `Start-Process -FilePath '${exe}' -Verb RunAs`
  try {
    spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', cmd], {
      detached: true,
      stdio: 'ignore'
    }).unref()
  } catch {
    /* the user may cancel the UAC prompt */
  }
  isQuitting = true
  app.quit()
}

function registerShortcuts(): void {
  const shortcut = repo.getAll().settings.quickCaptureShortcut || 'CommandOrControl+Shift+Space'
  globalShortcut.register(shortcut, () => windows.openQuickCapture())
  globalShortcut.register('CommandOrControl+Shift+P', () =>
    windows.sendToMain(IPC.EVT_GLOBAL_TOGGLE_PAUSE)
  )
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => windows.showMain())

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.faah.focushub')

    // Auto-elevate on launch when the user opted in (installed app only, so we
    // never disrupt the dev workflow). One UAC prompt, then site blocking works.
    if (app.isPackaged && repo.getAll().settings.alwaysElevate) {
      const elevated = await flow.isElevated()
      if (!elevated) {
        relaunchElevated()
        return
      }
    }

    // Serve the built renderer over app://local/* whenever we're not using the
    // Vite dev server (covers the packaged app and the built output directly).
    if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer(join(__dirname, '../renderer'))

    registerIpc({ repo, flow, windows })
    ipcMain.handle(IPC.APP_GET_INFO, async () => ({
      isPackaged: app.isPackaged,
      elevated: await flow.isElevated()
    }))
    ipcMain.on(IPC.APP_RELAUNCH_ELEVATED, () => relaunchElevated())

    const win = windows.createMain()
    win.on('close', (e) => {
      if (!isQuitting && repo.getAll().settings.minimizeToTray) {
        e.preventDefault()
        win.hide()
      }
    })

    buildTray()
    registerShortcuts()

    // Auto-update from GitHub Releases (installed app only).
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {
        /* offline or no release yet — ignore */
      })
    }

    app.on('activate', () => windows.showMain())
  })

  app.on('window-all-closed', () => {
    // Stay alive in the tray on Windows unless the user explicitly quits.
    if (process.platform !== 'darwin' && isQuitting) app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    flow.release()
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
}

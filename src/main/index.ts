import { app, dialog, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { spawn } from 'node:child_process'
import { statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/ipc'
import { registerIpc } from './ipc/register-ipc'
import { registerAppScheme, serveLocalMedia, serveRenderer } from './register-protocol'
import { BackupService } from './services/backup-service'
import { FlowService } from './services/flow-service'
import { UpdateService } from './services/update-service'
import { Repository } from './store/repository'
import { WindowManager } from './windows/window-manager'
import appIcon from '../../resources/icon.png?asset'

// Must run before the app "ready" event.
registerAppScheme()

/*
  Keep painting even when Windows thinks the window is hidden.

  Chromium's native occlusion detection stops rendering a window it believes is
  covered. The Snipping Tool draws a full-screen overlay before it captures, so
  Chromium marks the window occluded, stops painting, and the capture comes out
  empty — the app looks like it refuses to be screenshotted. Clicking the
  taskbar forced a repaint, which is why that worked around it.
*/
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

/**
 * Run against an isolated data folder when FOCUS_HUB_PROFILE is set.
 *
 * Development and automated checks must never write to the same
 * focus-hub-data.json the installed app uses — one bad test run should not be
 * able to touch real notes. Must happen before the Repository is constructed,
 * since electron-store resolves userData at construction time.
 */
const profile = process.env['FOCUS_HUB_PROFILE']
if (profile && !app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), `focus-hub-${profile}`))
}

const repo = new Repository()
const flow = new FlowService()
const windows = new WindowManager()
const updates = new UpdateService((status) =>
  windows.broadcast(IPC.EVT_UPDATE_STATUS, status)
)
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

/**
 * Proof that the running instance heard us.
 *
 * A second launch normally just tells the first one to show its window and
 * exits. But when the running copy was started as administrator and this one
 * wasn't, Windows refuses to deliver that message between them: nothing
 * surfaces, this process quits, and the app simply appears not to open —
 * unless you also start it as administrator. The running instance touches this
 * file when it gets the message, so a launch that goes unheard can say so
 * instead of vanishing.
 */
const HANDOFF = join(app.getPath('userData'), 'second-instance.ping')

function pingedAt(): number {
  try {
    return statSync(HANDOFF).mtimeMs
  } catch {
    return 0
  }
}

// Snapshot *before* asking for the lock: requesting it is what makes the other
// instance answer, and it can answer within milliseconds. Reading afterwards
// races against that reply and reports a healthy hand-off as a failed one.
const pingBefore = pingedAt()
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.whenReady().then(async () => {
    // Give the running instance a moment to answer.
    await new Promise((r) => setTimeout(r, 1500))
    if (pingedAt() === pingBefore) {
      const elevatedHere = await flow.isElevated()
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'Focus HUB já está aberto',
        message: 'O Focus HUB já está em execução, mas não respondeu.',
        detail: elevatedHere
          ? 'A cópia aberta parece estar sem privilégios de administrador, e o Windows não deixa as duas conversarem.\n\nAbra pelo ícone na bandeja, ao lado do relógio — ou feche por lá (botão direito › Sair) e abra de novo.'
          : 'A cópia aberta provavelmente foi iniciada como administrador, e o Windows não deixa uma janela comum falar com ela.\n\nClique no ícone do Focus HUB na bandeja, ao lado do relógio, para trazê-la de volta — ou feche por lá (botão direito › Sair) e abra normalmente.',
        buttons: ['Entendi']
      })
    }
    app.quit()
  })
} else {
  app.on('second-instance', () => {
    windows.showMain()
    try {
      writeFileSync(HANDOFF, String(Date.now()))
    } catch {
      /* the ping is a courtesy; never let it break showing the window */
    }
  })

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

    // A crash mid-session would leave the hosts block in place forever.
    void flow.cleanupStale()

    // Serve the built renderer over app://local/* whenever we're not using the
    // Vite dev server (covers the packaged app and the built output directly).
    if (!process.env['ELECTRON_RENDERER_URL']) serveRenderer(join(__dirname, '../renderer'))

    // Images the user picked (goal covers) — see register-protocol for why.
    serveLocalMedia()

    // Rolling snapshots: one at startup, then every 10 minutes while the app
    // is open (no-ops when nothing changed), plus one on the way out.
    const backups = new BackupService(app.getPath('userData'))
    backups.snapshot(repo.getAll(), 'ao abrir o app')
    setInterval(() => backups.snapshot(repo.getAll(), 'automático'), 10 * 60 * 1000)
    app.on('before-quit', () => backups.snapshot(repo.getAll(), 'ao fechar o app'))

    registerIpc({ repo, flow, windows, backups })
    ipcMain.handle(IPC.APP_GET_INFO, async () => ({
      isPackaged: app.isPackaged,
      elevated: await flow.isElevated(),
      version: app.getVersion()
    }))
    ipcMain.on(IPC.APP_RELAUNCH_ELEVATED, () => relaunchElevated())

    ipcMain.handle(IPC.UPDATE_GET_STATUS, () => updates.getStatus())
    ipcMain.handle(IPC.UPDATE_CHECK, () => updates.check())
    ipcMain.on(IPC.UPDATE_INSTALL, () =>
      updates.install(() => {
        isQuitting = true
      })
    )

    const win = windows.createMain()
    win.on('close', (e) => {
      if (!isQuitting && repo.getAll().settings.minimizeToTray) {
        e.preventDefault()
        win.hide()
      }
    })

    buildTray()
    registerShortcuts()

    // Auto-update from GitHub Releases (installed app only). Give the window a
    // moment so the renderer is listening when the first status arrives.
    if (app.isPackaged) {
      setTimeout(() => void updates.check(), 4000)
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

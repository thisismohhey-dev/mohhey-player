import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import type { TrayCommand, TrayLabels, WindowControl } from '@mohhey/contracts'
import { startApi, type ApiHandle } from './api-process'
import { findForbiddenSwitch, originOf } from './policy'
import { migrateLegacyUserData } from './userdata'
import { APP_ORIGIN, handleAppProtocol, handleMediaProtocol, registerSchemes } from './protocols'
import { applySecurity, isTrustedSender, lockNavigation } from './security'
import { destroyTray, resourcePath, sanitizeLabels, showTray } from './tray'

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL
const rendererUrl = isDev ? process.env.ELECTRON_RENDERER_URL! : `${APP_ORIGIN}/index.html`
const allowedOrigin = isDev ? originOf(process.env.ELECTRON_RENDERER_URL!)! : APP_ORIGIN

// A shipped build must not be drivable or inspectable from outside (remote debugging, injected code, weakened sandbox).
if (app.isPackaged) {
  const forbidden = findForbiddenSwitch(process.argv.slice(1))
  if (forbidden) { console.error(`Refusing to start with ${forbidden.split('=')[0]}`); app.exit(2) }
}

registerSchemes()

// Hardware media keys and the OS media overlay (driven by the page's MediaSession).
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService')

// One data folder for every build (dev and installed): <appData>/Mohhey Player. Dev runs may point somewhere else for isolated tests.
const isolatedProfile = !app.isPackaged && !!process.env.MOHHEY_USER_DATA
app.setPath('userData', isolatedProfile ? process.env.MOHHEY_USER_DATA! : join(app.getPath('appData'), 'Mohhey Player'))

// Development-only: lets automated UI checks attach over CDP. Never enabled in a packaged build.
if (!app.isPackaged && process.env.MOHHEY_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.MOHHEY_DEBUG_PORT)

if (!app.requestSingleInstanceLock()) app.quit()

let api: ApiHandle | null = null
let mainWindow: BrowserWindow | null = null

interface WindowState { width: number; height: number; x?: number; y?: number; maximized: boolean }
const stateFile = () => join(app.getPath('userData'), 'window-state.json')

function loadWindowState(): WindowState {
  const fallback: WindowState = { width: 1280, height: 820, maximized: false }
  try {
    const s = JSON.parse(readFileSync(stateFile(), 'utf8')) as WindowState
    const visible = s.x === undefined || s.y === undefined || screen.getAllDisplays().some((d) => {
      const b = d.workArea
      return s.x! >= b.x - 50 && s.x! < b.x + b.width - 100 && s.y! >= b.y - 50 && s.y! < b.y + b.height - 100
    })
    return visible ? { ...fallback, ...s } : fallback
  } catch { return fallback }
}

/** Mini-player mode: a small always-on-top window. The app leaves the taskbar and lives in the tray while it is active. */
const MINI_SIZE = { width: 400, height: 108 }
const DEFAULT_TRAY_LABELS: TrayLabels = { show: 'Show M. Player', playPause: 'Play / Pause', next: 'Next', previous: 'Previous', quit: 'Quit', tooltip: 'M. Player' }
let beforeMini: { bounds: Electron.Rectangle; maximized: boolean } | null = null

const WINDOW_CONTROLS: readonly WindowControl[] = ['minimize', 'maximize', 'close']

function leaveMiniFromTray(): void {
  if (!mainWindow) return
  setMiniMode(mainWindow, false)
  mainWindow.webContents.send('window:mini', false)
  mainWindow.show()
  mainWindow.focus()
}

function setMiniMode(win: BrowserWindow, on: boolean, labels?: TrayLabels | null): void {
  if (on === (beforeMini !== null)) return
  if (on) {
    showTray(labels ?? DEFAULT_TRAY_LABELS, {
      restore: leaveMiniFromTray,
      command: (cmd: TrayCommand) => win.webContents.send('tray:command', cmd),
      quit: () => app.quit(),
    })
    win.setSkipTaskbar(true)
    beforeMini = { bounds: win.getNormalBounds(), maximized: win.isMaximized() }
    if (beforeMini.maximized) win.unmaximize()
    const area = screen.getDisplayMatching(beforeMini.bounds).workArea
    win.setMinimumSize(MINI_SIZE.width, MINI_SIZE.height)
    win.setBounds({ ...MINI_SIZE, x: area.x + area.width - MINI_SIZE.width - 24, y: area.y + area.height - MINI_SIZE.height - 24 })
    win.setMaximizable(false)
    win.setResizable(false)
    // 'screen-saver' keeps it above other windows, including full-screen apps and the taskbar.
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    const prev = beforeMini!
    beforeMini = null
    destroyTray()
    win.setSkipTaskbar(false)
    win.setAlwaysOnTop(false)
    win.setVisibleOnAllWorkspaces(false)
    win.setResizable(true)
    win.setMaximizable(true)
    win.setMinimumSize(900, 600)
    win.setBounds(prev.bounds)
    if (prev.maximized) win.maximize()
  }
}

function saveWindowState(win: BrowserWindow): void {
  const b = beforeMini ? beforeMini.bounds : win.getNormalBounds()
  const maximized = beforeMini ? beforeMini.maximized : win.isMaximized()
  try { writeFileSync(stateFile(), JSON.stringify({ ...b, maximized })) } catch { /* non-fatal */ }
}

function createWindow(): void {
  const state = loadWindowState()
  const win = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f2ee',
    icon: resourcePath('icon.png'),
    // Frameless: macOS keeps its traffic lights; on Windows/Linux the renderer draws its own window buttons.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  })
  mainWindow = win
  lockNavigation(win, allowedOrigin)
  // The renderer's mini-mode flag lives in memory; if the page reloads or crashes, leave mini mode so they can't disagree.
  win.webContents.on('did-start-loading', () => { if (beforeMini) setMiniMode(win, false) })
  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))
  win.webContents.on('did-finish-load', () => win.webContents.send('window:maximized', win.isMaximized()))
  win.once('ready-to-show', () => { if (state.maximized) win.maximize(); win.show() })
  win.on('close', () => saveWindowState(win))
  win.on('closed', () => { mainWindow = null })
  void win.loadURL(rendererUrl)
}

function registerIpc(): void {
  ipcMain.on('window:set-mini', (e, on: unknown, labels: unknown) => {
    if (!isTrustedSender(e, allowedOrigin) || typeof on !== 'boolean' || !mainWindow) return
    setMiniMode(mainWindow, on, sanitizeLabels(labels))
  })
  ipcMain.on('window:control', (e, action: unknown) => {
    if (!isTrustedSender(e, allowedOrigin) || !mainWindow || !WINDOW_CONTROLS.includes(action as WindowControl)) return
    if (action === 'minimize') mainWindow.minimize()
    else if (action === 'maximize') { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize() }
    else mainWindow.close()
  })
  ipcMain.handle('api:get-config', (e) => {
    if (!isTrustedSender(e, allowedOrigin) || !api) throw new Error('Not available')
    return { baseUrl: api.baseUrl, token: api.token }
  })
  ipcMain.handle('library:add-folder', async (e) => {
    if (!isTrustedSender(e, allowedOrigin) || !api) throw new Error('Not available')
    const opts = { title: 'Choose a music folder', properties: ['openDirectory' as const] }
    const res = mainWindow ? await dialog.showOpenDialog(mainWindow, opts) : await dialog.showOpenDialog(opts)
    const path = res.canceled ? null : (res.filePaths[0] ?? null)
    if (!path) return { status: 'cancelled' as const }
    // Only the main process holds the internal secret, so page code cannot add arbitrary folders (e.g. network shares).
    try {
      const r = await fetch(`${api.baseUrl}/library/folders`, {
        method: 'POST',
        headers: { authorization: `Bearer ${api.token}`, 'x-mohhey-internal': api.internalToken, 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      if (r.ok) return { status: 'added' as const }
      const body = (await r.json().catch(() => null)) as { message?: string } | null
      return { status: 'error' as const, message: body?.message ?? 'The folder could not be added.' }
    } catch {
      return { status: 'error' as const, message: 'The library service is not responding.' }
    }
  })
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(async () => {
  applySecurity(isDev)
  if (!isolatedProfile) {
    try { migrateLegacyUserData(join(app.getPath('appData'), '@mohhey', 'desktop'), app.getPath('userData')) } catch (e) { console.error('Could not migrate the previous library:', e instanceof Error ? e.message : e) }
  }
  try {
    api = await startApi([allowedOrigin])
  } catch (err) {
    dialog.showErrorBox('M. Player could not start', err instanceof Error ? err.message : String(err))
    app.quit()
    return
  }
  handleMediaProtocol(api)
  if (!isDev) handleAppProtocol(join(__dirname, '../renderer'))
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { destroyTray(); api?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

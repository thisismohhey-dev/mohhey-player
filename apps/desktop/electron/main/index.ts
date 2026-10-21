import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { startApi, type ApiHandle } from './api-process'
import { originOf } from './policy'
import { APP_ORIGIN, handleAppProtocol, handleMediaProtocol, registerSchemes } from './protocols'
import { applySecurity, isTrustedSender, lockNavigation } from './security'

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL
const rendererUrl = isDev ? process.env.ELECTRON_RENDERER_URL! : `${APP_ORIGIN}/index.html`
const allowedOrigin = isDev ? originOf(process.env.ELECTRON_RENDERER_URL!)! : APP_ORIGIN

registerSchemes()

// Lets tests (and side-by-side dev runs) use an isolated profile instead of the real one.
if (!app.isPackaged && process.env.MOHHEY_USER_DATA) app.setPath('userData', process.env.MOHHEY_USER_DATA)

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

function saveWindowState(win: BrowserWindow): void {
  const b = win.getNormalBounds()
  try { writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() })) } catch { /* non-fatal */ }
}

function createWindow(): void {
  const state = loadWindowState()
  const win = new BrowserWindow({
    ...state,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f2ee',
    // Native caption buttons on Windows/Linux, traffic lights on macOS; our UI draws the rest of the title bar.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#1b1a18', height: 44 },
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
  win.once('ready-to-show', () => { if (state.maximized) win.maximize(); win.show() })
  win.on('close', () => saveWindowState(win))
  win.on('closed', () => { mainWindow = null })
  void win.loadURL(rendererUrl)
}

function registerIpc(): void {
  ipcMain.on('window:set-theme', (e, dark: unknown) => {
    if (!isTrustedSender(e, allowedOrigin) || typeof dark !== 'boolean') return
    // Only Windows/Linux draw native caption buttons through titleBarOverlay.
    if (process.platform !== 'darwin') mainWindow?.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#f3f1ec' : '#1b1a18', height: 44 })
  })
  ipcMain.handle('api:get-config', (e) => {
    if (!isTrustedSender(e, allowedOrigin) || !api) throw new Error('Not available')
    return { baseUrl: api.baseUrl, token: api.token }
  })
  ipcMain.handle('dialog:pick-folder', async (e) => {
    if (!isTrustedSender(e, allowedOrigin)) throw new Error('Not available')
    const opts = { title: 'Choose a music folder', properties: ['openDirectory' as const] }
    const res = mainWindow ? await dialog.showOpenDialog(mainWindow, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady().then(async () => {
  applySecurity(isDev)
  try {
    api = await startApi([allowedOrigin])
  } catch (err) {
    dialog.showErrorBox('Mohhey Player could not start', err instanceof Error ? err.message : String(err))
    app.quit()
    return
  }
  handleMediaProtocol(api)
  if (!isDev) handleAppProtocol(join(__dirname, '../renderer'))
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('before-quit', () => { api?.stop() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

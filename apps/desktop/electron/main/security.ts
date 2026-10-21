import { session, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { buildCsp, isTrustedUrl, originOf } from './policy'
import { MEDIA_SCHEME } from './protocols'

export function applySecurity(isDev: boolean): void {
  const csp = buildCsp(isDev, MEDIA_SCHEME)
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } })
  })
  // No web permissions are needed by a local music player.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
}

export function lockNavigation(win: BrowserWindow, allowedOrigin: string): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, url) => {
    if (originOf(url) !== allowedOrigin) e.preventDefault()
  })
}

/** IPC calls are only honoured from our own renderer origin. */
export function isTrustedSender(e: IpcMainEvent | IpcMainInvokeEvent, allowedOrigin: string): boolean {
  return isTrustedUrl(e.senderFrame?.url, allowedOrigin)
}

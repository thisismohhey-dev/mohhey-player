import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge } from '@mohhey/contracts'

/** Subscribes to a main-process event and returns an unsubscribe function; the raw IPC event never reaches the page. */
const listen = <T>(channel: string, cb: (value: T) => void): (() => void) => {
  const handler = (_e: unknown, value: T) => cb(value)
  ipcRenderer.on(channel, handler)
  return () => { ipcRenderer.removeListener(channel, handler) }
}

// Only these named members are reachable from the page; ipcRenderer itself is never exposed.
const bridge: DesktopBridge = {
  getApiConfig: () => ipcRenderer.invoke('api:get-config'),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  windowControl: (action) => ipcRenderer.send('window:control', action),
  onMaximizeChange: (cb) => listen('window:maximized', cb),
  setMiniMode: (on, labels) => ipcRenderer.send('window:set-mini', on === true, labels),
  onMiniChange: (cb) => listen('window:mini', cb),
  onTrayCommand: (cb) => listen('tray:command', cb),
  platform: process.platform as DesktopBridge['platform'],
}

contextBridge.exposeInMainWorld('mohhey', bridge)

import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge } from '@mohhey/contracts'

// Only these named channels are reachable from the page; ipcRenderer itself is never exposed.
const bridge: DesktopBridge = {
  getApiConfig: () => ipcRenderer.invoke('api:get-config'),
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  setTitleBarTheme: (dark) => ipcRenderer.send('window:set-theme', dark === true),
  platform: process.platform as DesktopBridge['platform'],
}

contextBridge.exposeInMainWorld('mohhey', bridge)

import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import type { TrayCommand, TrayLabels } from '@mohhey/contracts'

let tray: Tray | null = null

export const resourcePath = (file: string): string => join(app.getAppPath(), 'resources', file)

/** Accepts renderer-provided labels only if they are short strings. */
export function sanitizeLabels(raw: unknown): TrayLabels | null {
  if (!raw || typeof raw !== 'object') return null
  const keys: (keyof TrayLabels)[] = ['show', 'playPause', 'next', 'previous', 'quit', 'tooltip']
  const out = {} as TrayLabels
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v !== 'string' || v.length === 0 || v.length > 60) return null
    out[k] = v
  }
  return out
}

/** Shows the tray icon (system notification area, next to the clock). Clicking it restores the full player. */
export function showTray(labels: TrayLabels, handlers: { restore(): void; command(cmd: TrayCommand): void; quit(): void }): void {
  destroyTray()
  const image = nativeImage.createFromPath(resourcePath('tray.png'))
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip(labels.tooltip)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: labels.show, click: handlers.restore },
    { type: 'separator' },
    { label: labels.previous, click: () => handlers.command('previous') },
    { label: labels.playPause, click: () => handlers.command('play-pause') },
    { label: labels.next, click: () => handlers.command('next') },
    { type: 'separator' },
    { label: labels.quit, click: handlers.quit },
  ]))
  tray.on('click', handlers.restore)
  tray.on('double-click', handlers.restore)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

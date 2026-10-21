export type WindowControl = 'minimize' | 'maximize' | 'close'
export type TrayCommand = 'play-pause' | 'next' | 'previous'
/** Localised menu labels for the tray icon (the main process has no access to the UI language). */
export interface TrayLabels { show: string; playPause: string; next: string; previous: string; quit: string; tooltip: string }

/** Typed surface exposed by the Electron preload script on `window.mohhey`. Nothing else crosses the boundary. */
export interface DesktopBridge {
  /** Connection info for the local API. The token is generated per launch and never persisted. */
  getApiConfig(): Promise<{ baseUrl: string; token: string }>
  /**
   * Opens the native folder dialog and, if the user picks a folder, adds it to the library. The path never passes through
   * page code: the main process talks to the library service itself.
   */
  addLibraryFolder(): Promise<{ status: 'added' } | { status: 'cancelled' } | { status: 'error'; message: string }>
  /**
   * Tracks the operating system asked the app to open (double-click on an audio file, "Open with"). `takePendingOpen` returns the
   * ones received before the page was ready; `onOpenTracks` delivers later ones. The page plays them.
   */
  takePendingOpen(): Promise<number[]>
  onOpenTracks(cb: (trackIds: number[]) => void): () => void
  /** Opens the project's GitHub page in the default browser. Only fixed, known pages can be opened. */
  openLink(page: 'repo' | 'profile'): void
  /** Custom title-bar buttons (Windows/Linux; macOS keeps its native traffic lights). */
  windowControl(action: WindowControl): void
  onMaximizeChange(cb: (maximized: boolean) => void): () => void
  /**
   * Shrinks the window to an always-on-top mini player (true) or restores it (false).
   * While mini, the app leaves the taskbar and lives in the system tray (notification area).
   */
  setMiniMode(on: boolean, labels?: TrayLabels): void
  /** Fires when the main process changes mini mode on its own (e.g. a tray click). */
  onMiniChange(cb: (mini: boolean) => void): () => void
  /** Playback commands chosen from the tray menu. */
  onTrayCommand(cb: (cmd: TrayCommand) => void): () => void
  platform: 'win32' | 'darwin' | 'linux'
}

declare global {
  interface Window { mohhey: DesktopBridge }
}

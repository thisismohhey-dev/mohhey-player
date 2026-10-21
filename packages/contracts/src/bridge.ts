/** Typed surface exposed by the Electron preload script on `window.mohhey`. Nothing else crosses the boundary. */
export interface DesktopBridge {
  /** Connection info for the local API. The token is generated per launch and never persisted. */
  getApiConfig(): Promise<{ baseUrl: string; token: string }>
  /** Opens the native folder dialog. Resolves to null when cancelled. */
  pickFolder(): Promise<string | null>
  /** Keeps the native window-control glyphs readable when the app theme changes. */
  setTitleBarTheme(dark: boolean): void
  /** Shrinks the window to a small always-on-top mini player (true) or restores it (false). */
  setMiniMode(on: boolean): void
  platform: 'win32' | 'darwin' | 'linux'
}

declare global {
  interface Window { mohhey: DesktopBridge }
}

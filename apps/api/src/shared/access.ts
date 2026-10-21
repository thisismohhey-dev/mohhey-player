import { timingSafeEqual } from 'node:crypto'

/** Accept only loopback `Host` headers: blocks DNS-rebinding, where a web page tricks the browser into talking to 127.0.0.1. */
export function isLoopbackHost(host: string | null): boolean {
  if (host === null) return true // in-process calls (tests) carry no Host header
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i.test(host)
}

/**
 * Routes that only the Electron main process may call (with a second secret the renderer never receives):
 *  - everything under /internal/ (local file paths)
 *  - adding a library folder: the folder must come from the native dialog, never from page code
 *  - opening a single file the OS handed to the app (double-click in Explorer): likewise comes from the main process only
 */
export function requiresInternal(method: string, pathname: string): boolean {
  return pathname.startsWith('/internal/') || (method === 'POST' && (pathname === '/library/folders' || pathname === '/library/open-file'))
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const INTERNAL_HEADER = 'x-mohhey-internal'

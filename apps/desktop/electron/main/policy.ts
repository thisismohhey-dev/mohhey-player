/** Pure security policy helpers (no Electron imports so they can be unit-tested). */

export function buildCsp(isDev: boolean, mediaScheme: string): string {
  return [
    "default-src 'self'",
    `script-src 'self'${isDev ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' ${mediaScheme}: data: blob:`,
    `media-src ${mediaScheme}: blob:`,
    "font-src 'self' data:",
    `connect-src 'self' http://127.0.0.1:*${isDev ? ' ws://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** WHATWG `URL.origin` is the string "null" for custom schemes, so build the origin explicitly. */
export function originOf(url: string): string | null {
  try { const u = new URL(url); return `${u.protocol}//${u.host}` } catch { return null }
}

export function isTrustedUrl(url: string | undefined, allowedOrigin: string): boolean {
  return !!url && originOf(url) === allowedOrigin
}

/** `mohhey-media://track/<id>` or `mohhey-media://art/<sha1>.<ext>`; anything else is rejected. */
export function parseMediaUrl(raw: string): { kind: 'track' | 'art'; key: string } | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  const key = decodeURIComponent(url.pathname.slice(1))
  if (url.hostname === 'track' && /^\d+$/.test(key)) return { kind: 'track', key }
  if (url.hostname === 'art' && /^[a-f0-9]{40}\.(jpg|png)$/.test(key)) return { kind: 'art', key }
  return null
}

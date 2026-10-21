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

export type ByteRange = { start: number; end: number }

/**
 * Parses a single-range HTTP `Range` header against a file size.
 * Returns null when there is no (usable) header, `'unsatisfiable'` when the range lies outside the file.
 */
export function parseRange(header: string | null, size: number): ByteRange | 'unsatisfiable' | null {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start: number
  let end: number
  if (m[1] === '') {
    const suffix = Number(m[2])
    if (suffix === 0) return 'unsatisfiable'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.weba': 'audio/webm',
}
export const audioMime = (ext: string): string => AUDIO_MIME[ext.toLowerCase()] ?? 'application/octet-stream'

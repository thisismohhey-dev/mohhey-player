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
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
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

/** Thumbnail widths the renderer may ask for (`?s=`); anything else gets the original image. */
export const ART_SIZES: readonly number[] = [96, 256, 512]

/**
 * `mohhey-media://track/<id>` or `mohhey-media://art/<sha1>.<ext>[?s=<width>]`; anything else is rejected.
 * `size` is only set for an allowed thumbnail width.
 */
export function parseMediaUrl(raw: string): { kind: 'track' | 'art'; key: string; size?: number } | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  const key = decodeURIComponent(url.pathname.slice(1))
  if (url.hostname === 'track' && /^\d+$/.test(key)) return { kind: 'track', key }
  if (url.hostname === 'art' && /^[a-f0-9]{40}\.(jpg|png)$/.test(key)) {
    const s = Number(url.searchParams.get('s'))
    return ART_SIZES.includes(s) ? { kind: 'art', key, size: s } : { kind: 'art', key }
  }
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

/**
 * Command-line switches that would let another local program drive or inspect a *packaged* app (remote debugging,
 * Node inspector, loading extra code). A shipped build refuses to start when any of them is present.
 */
const FORBIDDEN_SWITCH = /^--?(remote-debugging-(port|pipe|address)|remote-allow-origins|inspect(-brk|-port|-publish-uid)?|debug-brk|js-flags|load-extension|disable-web-security|no-sandbox|disable-gpu-sandbox|host-rules|host-resolver-rules|proxy-server|ignore-certificate-errors|unsafely-treat-insecure-origin-as-secure|renderer-cmd-prefix|utility-cmd-prefix|gpu-launcher|ppapi-plugin-launcher|browser-subprocess-path)(=|$)/i

export function findForbiddenSwitch(argv: readonly string[]): string | null {
  return argv.find((a) => FORBIDDEN_SWITCH.test(a)) ?? null
}

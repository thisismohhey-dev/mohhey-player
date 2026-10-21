import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import type { ApiHandle } from './api-process'
import { audioMime, parseMediaUrl, parseRange } from './policy'

export const APP_SCHEME = 'mohhey-app'
export const MEDIA_SCHEME = 'mohhey-media'
export const APP_ORIGIN = `${APP_SCHEME}://renderer`

/** Must run before `app.whenReady()`. */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ])
}

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
}

/** Serves the built renderer from disk with a traversal guard. */
export function handleAppProtocol(rendererDir: string): void {
  const root = normalize(rendererDir) + sep
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = normalize(join(rendererDir, rel))
    if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 })
    try {
      const body = await readFile(file)
      return new Response(body, { headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

/**
 * Serves a local audio file with explicit HTTP Range support. Chromium only treats a media resource as seekable
 * when it receives `Accept-Ranges`/`Content-Length` and 206 responses; relying on `net.fetch(file://)` left some
 * files unseekable (seeking snapped back to 0:00).
 */
async function serveAudioFile(path: string, rangeHeader: string | null): Promise<Response> {
  let size: number
  try { size = (await stat(path)).size } catch { return new Response('File not found', { status: 404 }) }
  // CORS header: the Web Audio graph (EQ, loudness, crossfade) may only read samples from CORS-approved media.
  const base = { 'content-type': audioMime(extname(path)), 'accept-ranges': 'bytes', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
  if (size === 0) return new Response(null, { status: 200, headers: { ...base, 'content-length': '0' } })
  const range = parseRange(rangeHeader, size)
  if (range === 'unsatisfiable') return new Response(null, { status: 416, headers: { ...base, 'content-range': `bytes */${size}` } })
  const { start, end } = range ?? { start: 0, end: size - 1 }
  const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      ...base,
      'content-length': String(end - start + 1),
      ...(range ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
    },
  })
}

/**
 * `mohhey-media://track/<id>` streams a local audio file (Range requests honoured, see serveAudioFile);
 * `mohhey-media://art/<hash.ext>` serves cached artwork. The renderer never sees file paths.
 */
export function handleMediaProtocol(api: ApiHandle): void {
  const auth = { authorization: `Bearer ${api.token}` }
  const internal = { ...auth, 'x-mohhey-internal': api.internalToken }
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const target = parseMediaUrl(request.url)
    if (!target) return new Response('Bad request', { status: 400 })
    try {
      if (target.kind === 'track') {
        const res = await fetch(`${api.baseUrl}/internal/tracks/${target.key}/path`, { headers: internal })
        if (!res.ok) return new Response('Track not found', { status: 404 })
        const { path } = (await res.json()) as { path: string }
        return await serveAudioFile(path, request.headers.get('range'))
      }
      return await fetch(`${api.baseUrl}/artwork/${target.key}`, { headers: auth })
    } catch {
      return new Response('Unavailable', { status: 502 })
    }
  })
}

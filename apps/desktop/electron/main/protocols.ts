import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import type { ApiHandle } from './api-process'
import { parseMediaUrl } from './policy'

export const APP_SCHEME = 'mohhey-app'
export const MEDIA_SCHEME = 'mohhey-media'
export const APP_ORIGIN = `${APP_SCHEME}://renderer`

/** Must run before `app.whenReady()`. */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } },
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
 * `mohhey-media://track/<id>` streams a local audio file (Range supported by Chromium's file handler);
 * `mohhey-media://art/<hash.ext>` serves cached artwork. The renderer never sees file paths.
 */
export function handleMediaProtocol(api: ApiHandle): void {
  const auth = { authorization: `Bearer ${api.token}` }
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const target = parseMediaUrl(request.url)
    if (!target) return new Response('Bad request', { status: 400 })
    try {
      if (target.kind === 'track') {
        const res = await fetch(`${api.baseUrl}/internal/tracks/${target.key}/path`, { headers: auth })
        if (!res.ok) return new Response('Track not found', { status: 404 })
        const { path } = (await res.json()) as { path: string }
        const headers = new Headers()
        const range = request.headers.get('range')
        if (range) headers.set('range', range)
        return await net.fetch(pathToFileURL(path).toString(), { headers })
      }
      return await fetch(`${api.baseUrl}/artwork/${target.key}`, { headers: auth })
    } catch {
      return new Response('Unavailable', { status: 502 })
    }
  })
}

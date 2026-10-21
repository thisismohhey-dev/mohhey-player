import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { loadConfig } from '../src/shared/config'
import { openDatabase, type Db } from '../src/shared/db'
import { isLoopbackHost, requiresInternal } from '../src/shared/access'
import type { MetadataReader } from '../src/modules/library/scanner'

const TOKEN = 'renderer-token-0123456789'
const INTERNAL = 'internal-token-9876543210'
let dir: string
let db: Db
let app: ReturnType<typeof createApp>

const reader: MetadataReader = async (p) => ({
  title: p.split(/[\\/]/).pop()!, artist: '', album: '', albumArtist: '', trackNo: null, discNo: null, year: null, durationMs: 1000,
  format: 'mp3', bitrate: null, picture: null, replayGainDb: null,
})

const send = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
  app.handle(new Request(`http://127.0.0.1${path}`, init))
const asRenderer = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
const asMain = { ...asRenderer, 'x-mohhey-internal': INTERNAL }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mohhey-sec-'))
  mkdirSync(join(dir, 'music'))
  writeFileSync(join(dir, 'music', 'a.mp3'), 'x')
  db = openDatabase(':memory:')
  app = createApp({ config: { token: TOKEN, internalToken: INTERNAL, allowedOrigins: ['http://localhost:5173'], artworkDir: join(dir, 'art') }, db, metadataReader: reader })
})
afterEach(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })

describe('two-level API access', () => {
  test('the renderer token alone cannot add library folders (only the native dialog in the main process can)', async () => {
    const body = JSON.stringify({ path: join(dir, 'music') })
    expect((await send('/library/folders', { method: 'POST', headers: asRenderer, body })).status).toBe(403)
    expect((await send('/library/folders', { method: 'POST', headers: { ...asRenderer, 'x-mohhey-internal': TOKEN }, body })).status).toBe(403)
    expect((await send('/library/folders', { method: 'POST', headers: asMain, body })).status).toBe(201)
  })

  test('local file paths are only available to the main process', async () => {
    await send('/library/folders', { method: 'POST', headers: asMain, body: JSON.stringify({ path: join(dir, 'music') }) })
    for (let i = 0; i < 100; i++) { const s = await (await send('/library/scan', { headers: asRenderer })).json() as any; if (s.state !== 'scanning') break; await Bun.sleep(10) }
    const id = ((await (await send('/tracks', { headers: asRenderer })).json()) as any).items[0].id
    expect((await send(`/internal/tracks/${id}/path`, { headers: asRenderer })).status).toBe(403)
    const ok = await send(`/internal/tracks/${id}/path`, { headers: asMain })
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as any).path).toContain('a.mp3')
  })

  test('the internal secret without the renderer token is still rejected', async () => {
    expect((await send('/internal/tracks/1/path', { headers: { 'x-mohhey-internal': INTERNAL } })).status).toBe(401)
  })

  test('other routes keep working with the renderer token', async () => {
    expect((await send('/tracks', { headers: asRenderer })).status).toBe(200)
    expect((await send('/library/folders', { headers: asRenderer })).status).toBe(200)
  })
})

describe('DNS-rebinding and origin protection', () => {
  test('rejects requests whose Host is not loopback, even with valid tokens', async () => {
    const res = await send('/tracks', { headers: { ...asRenderer, host: 'evil.example' } })
    expect(res.status).toBe(403)
    expect((await send('/tracks', { headers: { ...asRenderer, host: '127.0.0.1:5555' } })).status).toBe(200)
  })

  test('host matcher', () => {
    for (const ok of ['127.0.0.1', '127.0.0.1:8080', 'localhost:3000', '[::1]:9', null]) expect(isLoopbackHost(ok)).toBe(true)
    for (const bad of ['evil.example', '127.0.0.1.evil.example', 'localhost.evil.com', '10.0.0.5:80', '127.0.0.1:99999999', '']) expect(isLoopbackHost(bad)).toBe(false)
  })

  test('internal-route matcher', () => {
    expect(requiresInternal('POST', '/library/open-file')).toBe(true)
    expect(requiresInternal('GET', '/internal/tracks/1/path')).toBe(true)
    expect(requiresInternal('POST', '/library/folders')).toBe(true)
    expect(requiresInternal('GET', '/library/folders')).toBe(false)
    expect(requiresInternal('DELETE', '/library/folders/3')).toBe(false)
  })

  test('responses never reflect an unknown origin', async () => {
    const r = await send('/tracks', { headers: { ...asRenderer, origin: 'https://evil.example' } })
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('configuration', () => {
  test('refuses to start without strong, distinct secrets', () => {
    const base = { MOHHEY_DATA_DIR: dir }
    expect(() => loadConfig({ ...base, MOHHEY_API_TOKEN: 'short', MOHHEY_INTERNAL_TOKEN: INTERNAL })).toThrow()
    expect(() => loadConfig({ ...base, MOHHEY_API_TOKEN: TOKEN })).toThrow()
    expect(() => loadConfig({ ...base, MOHHEY_API_TOKEN: TOKEN, MOHHEY_INTERNAL_TOKEN: TOKEN })).toThrow()
    expect(loadConfig({ ...base, MOHHEY_API_TOKEN: TOKEN, MOHHEY_INTERNAL_TOKEN: INTERNAL }).internalToken).toBe(INTERNAL)
  })
})

describe('input hardening', () => {
  test('oversized and malformed bodies are rejected without a server error', async () => {
    await send('/library/folders', { method: 'POST', headers: asMain, body: JSON.stringify({ path: join(dir, 'music') }) })
    expect((await send('/playlists', { method: 'POST', headers: asRenderer, body: JSON.stringify({ name: 'x'.repeat(5000) }) })).status).toBe(400)
    expect((await send('/playlists', { method: 'POST', headers: asRenderer, body: '{not json' })).status).toBe(400)
    expect((await send('/tracks?limit=999999', { headers: asRenderer })).status).toBe(400)
    expect((await send('/tracks?sort=title;DROP TABLE tracks', { headers: asRenderer })).status).toBe(400)
    expect((await send('/tracks?q=' + encodeURIComponent("'; DROP TABLE tracks; --"), { headers: asRenderer })).status).toBe(200)
    expect((await send('/tracks', { headers: asRenderer })).status).toBe(200) // table still there
  })

  test('browse refuses paths outside the library and traversal tricks', async () => {
    await send('/library/folders', { method: 'POST', headers: asMain, body: JSON.stringify({ path: join(dir, 'music') }) })
    for (const bad of [dir, join(dir, 'music', '..'), 'C:\\Windows', '/etc', '\\\\evil\\share', join(dir, 'music') + '\\..\\..']) {
      const r = await send('/library/browse?path=' + encodeURIComponent(bad), { headers: asRenderer })
      expect([400, 404]).toContain(r.status)
    }
  })
})

describe('opening a single file', () => {
  test('only the main process may open files; they stay out of the library lists', async () => {
    const outside = join(dir, 'outside.mp3'); writeFileSync(outside, 'unique-bytes')
    const body = JSON.stringify({ path: outside })
    expect((await send('/library/open-file', { method: 'POST', headers: asRenderer, body })).status).toBe(403)
    const ok = await send('/library/open-file', { method: 'POST', headers: asMain, body })
    expect(ok.status).toBe(200)
    const { id } = (await ok.json()) as { id: number }
    expect(((await (await send('/tracks', { headers: asRenderer })).json()) as any).total).toBe(0) // not part of the library
    expect((await send(`/tracks/${id}`, { headers: asRenderer })).status).toBe(200) // but playable by id
    // not audio / not a file / relative
    writeFileSync(join(dir, 'x.txt'), 'x')
    for (const bad of [join(dir, 'x.txt'), dir, 'relative.mp3']) {
      expect((await send('/library/open-file', { method: 'POST', headers: asMain, body: JSON.stringify({ path: bad }) })).status).toBe(400)
    }
  })
})

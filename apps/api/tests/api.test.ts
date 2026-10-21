import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { openDatabase, type Db } from '../src/shared/db'
import { normalizeText } from '../src/shared/normalize'
import type { MetadataReader } from '../src/modules/library/scanner'

const TOKEN = 'test-token-0123456789'
let dir: string
let music: string
let db: Db
let app: ReturnType<typeof createApp>

/** Fake reader derives metadata from the file name: "Artist - Title.mp3"; files containing "broken" fail. */
const reader: MetadataReader = async (path) => {
  const base = path.split(/[\\/]/).pop()!.replace(/\.\w+$/, '')
  if (base.includes('broken')) throw new Error('Cannot decode file')
  const [artist = '', title = base] = base.includes(' - ') ? base.split(' - ') : ['', base]
  return { title, artist, album: artist ? `${artist} Album` : '', albumArtist: artist, trackNo: 1, discNo: null, year: 2020, durationMs: 180000, format: 'mp3', bitrate: 320, picture: null }
}

const call = (path: string, init: RequestInit = {}, token: string | null = TOKEN) =>
  app.handle(new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  }))
const json = async <T = any>(r: Response | Promise<Response>): Promise<T> => (await r).json() as Promise<T>

const scan = async () => {
  await call('/library/scan', { method: 'POST' })
  for (let i = 0; i < 200; i++) {
    const s = await json(call('/library/scan'))
    if (s.state !== 'scanning') return s
    await Bun.sleep(10)
  }
  throw new Error('scan did not finish')
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mohhey-'))
  music = join(dir, 'music')
  mkdirSync(music)
  db = openDatabase(':memory:')
  app = createApp({ config: { token: TOKEN, allowedOrigins: ['http://localhost:5173'], artworkDir: join(dir, 'art') }, db, metadataReader: reader })
})
afterEach(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })

const addFolder = () => call('/library/folders', { method: 'POST', body: JSON.stringify({ path: music }) })

describe('metadata reader', () => {
  test('rejects files that are not audio even with an audio extension', async () => {
    const { readMetadata } = await import('../src/modules/library/scanner')
    const f = join(dir, 'fake.mp3')
    writeFileSync(f, 'definitely not audio')
    await expect(readMetadata(f)).rejects.toThrow()
  })
})

describe('security', () => {
  test('rejects missing and wrong tokens, allows /health', async () => {
    expect((await call('/tracks', {}, null)).status).toBe(401)
    expect((await call('/tracks', {}, 'wrong-token-0123456789')).status).toBe(401)
    expect((await call('/health', {}, null)).status).toBe(200)
  })
  test('CORS only for allowed origins', async () => {
    const ok = await call('/health', { headers: { origin: 'http://localhost:5173' } }, null)
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    const bad = await call('/health', { headers: { origin: 'http://evil.example' } }, null)
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
  })
  test('artwork rejects path traversal', async () => {
    expect((await call('/artwork/..%2F..%2Fsecret.jpg')).status).toBe(404)
  })
  test('folder must be absolute, existing', async () => {
    expect((await call('/library/folders', { method: 'POST', body: JSON.stringify({ path: 'relative/dir' }) })).status).toBe(400)
    expect((await call('/library/folders', { method: 'POST', body: JSON.stringify({ path: join(dir, 'nope') }) })).status).toBe(400)
  })
})

describe('library scan', () => {
  test('scans, is idempotent, reports broken files without aborting', async () => {
    writeFileSync(join(music, 'Adele - Hello.mp3'), 'x')
    writeFileSync(join(music, 'Adele - Skyfall.flac'), 'x')
    writeFileSync(join(music, 'broken.mp3'), 'x')
    writeFileSync(join(music, 'notes.txt'), 'x')
    expect((await addFolder()).status).toBe(201)
    let s = await scan()
    expect(s.state).toBe('done')
    expect(s.added).toBe(2)
    expect(s.failed).toBe(1)
    expect(s.errors[0].message).toContain('decode')
    s = await scan()
    expect(s.added).toBe(0)
    expect((await json(call('/tracks'))).total).toBe(2)
    expect((await json(call('/albums'))).total).toBe(1)
  })

  test('duplicate folder is rejected', async () => {
    await addFolder()
    expect((await addFolder()).status).toBe(409)
  })

  test('deleted files become missing; moved files are re-linked keeping id and favorite', async () => {
    const a = join(music, 'Adele - Hello.mp3')
    writeFileSync(a, 'x')
    writeFileSync(join(music, 'Queen - Bohemian.mp3'), 'x')
    await addFolder(); await scan()
    const { items } = await json(call('/tracks?q=hello'))
    const id = items[0].id
    await call(`/tracks/${id}/favorite`, { method: 'PUT', body: JSON.stringify({ value: true }) })

    mkdirSync(join(music, 'sub'))
    renameSync(a, join(music, 'sub', 'Adele - Hello.mp3'))
    rmSync(join(music, 'Queen - Bohemian.mp3'))
    const s = await scan()
    expect(s.removed).toBe(1)
    const after = await json(call('/tracks'))
    expect(after.total).toBe(1)
    expect(after.items[0].id).toBe(id)
    expect(after.items[0].favorite).toBe(true)
  })

  test('removing a folder removes its tracks and orphan albums', async () => {
    writeFileSync(join(music, 'Adele - Hello.mp3'), 'x')
    const { items } = await json(addFolder())
    await scan()
    await call(`/library/folders/${items[0].id}`, { method: 'DELETE' })
    expect((await json(call('/tracks'))).total).toBe(0)
    expect((await json(call('/albums'))).total).toBe(0)
  })
})

describe('folder browsing', () => {
  test('lists subfolders and direct tracks, blocks paths outside the library', async () => {
    mkdirSync(join(music, 'Rock', 'Live'), { recursive: true })
    writeFileSync(join(music, 'Intro.mp3'), 'x')
    writeFileSync(join(music, 'Rock', 'A - One.mp3'), 'x')
    writeFileSync(join(music, 'Rock', 'Live', 'A - Two.mp3'), 'x')
    writeFileSync(join(music, 'Rock', 'Live', 'A - Three.mp3'), 'x')
    await addFolder(); await scan()

    const roots = await json(call('/library/browse'))
    expect(roots.parent).toBeNull()
    expect(roots.folders[0].trackCount).toBe(4)

    const top = await json(call('/library/browse?path=' + encodeURIComponent(music)))
    expect(top.parent).toBe('')
    expect(top.tracks.map((t: any) => t.title)).toEqual(['Intro'])
    expect(top.folders).toEqual([{ name: 'Rock', path: join(music, 'Rock'), trackCount: 3 }])

    const rock = await json(call('/library/browse?path=' + encodeURIComponent(join(music, 'Rock'))))
    expect(rock.parent).toBe(music)
    expect(rock.tracks.length).toBe(1)
    expect(rock.folders[0].name).toBe('Live')
    expect(rock.folders[0].trackCount).toBe(2)

    expect((await call('/library/browse?path=' + encodeURIComponent(dir))).status).toBe(400)
    expect((await call('/library/browse?path=' + encodeURIComponent(join(music, '..')))).status).toBe(400)
  })
})

describe('search', () => {
  test('normalises Persian/Arabic letters and digits', () => {
    expect(normalizeText('كتاب يك ۱۲۳')).toBe(normalizeText('کتاب یک 123'))
    expect(normalizeText('Beyoncé')).toBe('beyonce')
  })
  test('finds Persian and English, escapes LIKE wildcards', async () => {
    writeFileSync(join(music, 'محسن - دلتنگی.mp3'), 'x')
    writeFileSync(join(music, 'Adele - 100% Pure.mp3'), 'x')
    await addFolder(); await scan()
    expect((await json(call('/tracks?q=' + encodeURIComponent('دلتنگي')))).total).toBe(1)
    expect((await json(call('/tracks?q=adele%20hello'))).total).toBe(0)
    expect((await json(call('/search?q=adele'))).tracks.length).toBe(1)
    // Wildcards are neutralised: they normalise to an empty query rather than acting as LIKE patterns.
    expect((await json(call('/tracks?q=' + encodeURIComponent('%')))).total).toBe(2)
    expect((await json(call('/tracks?q=' + encodeURIComponent('pure%')))).total).toBe(1)
  })
})

describe('playlists, favorites, history, settings', () => {
  const seed = async () => {
    for (const n of ['A - One', 'A - Two', 'A - Three']) writeFileSync(join(music, `${n}.mp3`), 'x')
    await addFolder(); await scan()
    return (await json(call('/tracks?sort=title'))).items as { id: number; title: string }[]
  }

  test('playlist keeps order, supports move/remove/duplicates', async () => {
    const t = await seed()
    const p = await json(call('/playlists', { method: 'POST', body: JSON.stringify({ name: 'Mix' }) }))
    await call(`/playlists/${p.id}/tracks`, { method: 'POST', body: JSON.stringify({ trackIds: [t[0]!.id, t[1]!.id, t[2]!.id, t[0]!.id] }) })
    await call(`/playlists/${p.id}/move`, { method: 'POST', body: JSON.stringify({ from: 3, to: 0 }) })
    let items = (await json(call(`/playlists/${p.id}/tracks`))).items
    expect(items.map((x: any) => x.id)).toEqual([t[0]!.id, t[0]!.id, t[1]!.id, t[2]!.id])
    await call(`/playlists/${p.id}/tracks/1`, { method: 'DELETE' })
    items = (await json(call(`/playlists/${p.id}/tracks`))).items
    expect(items.length).toBe(3)
    expect((await json(call(`/playlists/${p.id}`))).trackCount).toBe(3)
    expect((await call('/playlists', { method: 'POST', body: JSON.stringify({ name: '  ' }) })).status).toBe(400)
    expect((await call(`/playlists/${p.id}`, { method: 'DELETE' })).status).toBe(200)
    expect((await call(`/playlists/${p.id}`)).status).toBe(404)
  })

  test('favorites and history', async () => {
    const t = await seed()
    await call(`/tracks/${t[0]!.id}/favorite`, { method: 'PUT', body: JSON.stringify({ value: true }) })
    expect((await json(call('/tracks?favorite=true'))).total).toBe(1)
    await call(`/tracks/${t[1]!.id}/played`, { method: 'POST', body: JSON.stringify({ record: true }) })
    const recent = await json(call('/tracks?recent=true'))
    expect(recent.items.map((x: any) => x.id)).toEqual([t[1]!.id])
    expect(recent.items[0].playCount).toBe(1)
    expect((await call('/tracks/99999/played', { method: 'POST', body: JSON.stringify({ record: true }) })).status).toBe(404)
  })

  test('a partial settings patch leaves every other setting untouched', async () => {
    await call('/settings', { method: 'PATCH', body: JSON.stringify({ locale: 'fa', theme: 'dark', queue: { trackIds: [1, 2], index: 1, positionMs: 500 } }) })
    await call('/settings', { method: 'PATCH', body: JSON.stringify({ volume: 0.5 }) })
    const s = await json(call('/settings'))
    expect(s.volume).toBe(0.5)
    expect(s.locale).toBe('fa')
    expect(s.theme).toBe('dark')
    expect(s.queue).toEqual({ trackIds: [1, 2], index: 1, positionMs: 500 })
  })

  test('settings persist and validate', async () => {
    expect((await json(call('/settings'))).volume).toBe(0.8)
    const r = await json(call('/settings', { method: 'PATCH', body: JSON.stringify({ volume: 0.3, repeat: 'all' }) }))
    expect(r.volume).toBe(0.3)
    expect((await json(call('/settings'))).repeat).toBe('all')
    expect((await call('/settings', { method: 'PATCH', body: JSON.stringify({ volume: 9 }) })).status).toBe(400)
  })
})

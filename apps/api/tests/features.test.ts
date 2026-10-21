import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { openDatabase, type Db } from '../src/shared/db'
import { repairMojibake } from '../src/shared/repair-text'
import type { MetadataReader, ParsedTrack } from '../src/modules/library/scanner'
import { parseLrc } from '../src/modules/lyrics/lrc'

const TOKEN = 'test-token-0123456789'
const INTERNAL = 'internal-token-0123456789'
let dir: string
let music: string
let db: Db
let app: ReturnType<typeof createApp>
let overrides: Record<string, Partial<ParsedTrack>> = {}

const reader: MetadataReader = async (path) => {
  const base = path.split(/[\\/]/).pop()!.replace(/\.\w+$/, '')
  const [artist = '', title = base] = base.includes(' - ') ? base.split(' - ') : ['', base]
  return {
    title, artist, album: artist ? `${artist} Album` : '', albumArtist: artist, trackNo: 1, discNo: null, year: 2020, durationMs: 180000,
    format: 'mp3', bitrate: 320, picture: null, replayGainDb: null, ...overrides[base],
  }
}

const call = (path: string, init: RequestInit = {}) =>
  app.handle(new Request(`http://localhost${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'x-mohhey-internal': INTERNAL, ...(init.headers ?? {}) } }))
const json = async <T = any>(r: Response | Promise<Response>): Promise<T> => (await r).json() as Promise<T>
const body = (b: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(b) })
const scan = async () => {
  await call('/library/scan', { method: 'POST' })
  for (let i = 0; i < 200; i++) { const s = await json(call('/library/scan')); if (s.state !== 'scanning') return s; await Bun.sleep(10) }
  throw new Error('scan did not finish')
}
const track = async (q: string) => (await json(call('/tracks?q=' + encodeURIComponent(q)))).items[0]

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mohhey-f-'))
  music = join(dir, 'music'); mkdirSync(music)
  db = openDatabase(':memory:')
  overrides = {}
  app = createApp({ config: { token: TOKEN, internalToken: INTERNAL, allowedOrigins: [], artworkDir: join(dir, 'art') }, db, metadataReader: reader })
})
afterEach(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })

const addFolder = () => call('/library/folders', body({ path: music }))

describe('mojibake repair', () => {
  const garble = (s: string) => new TextDecoder('windows-1252').decode(new TextEncoder().encode(s))
  test('repairs Persian, Arabic and mixed text that was read as Windows-1252', () => {
    for (const original of ['پادکست فارسی', 'نسل‌کشی در رواندا', 'Café Müller – ÖÜ', 'Привет мир']) {
      const bad = garble(original)
      expect(repairMojibake(bad)).toBe(original)
    }
  })
  test('leaves genuine text alone', () => {
    for (const ok of ['Beyoncé', 'Mötley Crüe', 'Normal title', 'پادکست', 'ÅÄÖ', '']) expect(repairMojibake(ok)).toBe(ok)
  })
})

describe('resume position', () => {
  test('stores a position per track and returns it with the track', async () => {
    writeFileSync(join(music, 'A - Long Talk.mp3'), 'x' + join(music, 'A - Long Talk.mp3'))
    await addFolder(); await scan()
    const t = await track('long talk')
    expect(t.resumeMs).toBe(0)
    expect((await call(`/tracks/${t.id}/position`, { method: 'PUT', body: JSON.stringify({ positionMs: 754000 }) })).status).toBe(200)
    expect((await track('long talk')).resumeMs).toBe(754000)
    await call(`/tracks/${t.id}/position`, { method: 'PUT', body: JSON.stringify({ positionMs: 0 }) })
    expect((await track('long talk')).resumeMs).toBe(0)
    expect((await call(`/tracks/999/position`, { method: 'PUT', body: JSON.stringify({ positionMs: 5 }) })).status).toBe(404)
    expect((await call(`/tracks/${t.id}/position`, { method: 'PUT', body: JSON.stringify({ positionMs: -5 }) })).status).toBe(400)
  })
})

describe('non-destructive metadata editing', () => {
  test('edits survive a rescan until reset; the file is never touched', async () => {
    const f = join(music, 'Aurora - Hello.mp3')
    writeFileSync(f, 'x' + f)
    await addFolder(); await scan()
    const t = await track('hello')
    const res = await json(call(`/tracks/${t.id}/metadata`, { method: 'PATCH', body: JSON.stringify({ title: 'Hello (Fixed)', artist: 'Aurora Vale', album: 'Glass Hours' }) }))
    expect(res).toMatchObject({ title: 'Hello (Fixed)', artist: 'Aurora Vale', album: 'Glass Hours', edited: true })

    // file changes on disk -> rescan: edited fields are kept
    writeFileSync(f, 'xx')
    await scan()
    expect(await track('hello fixed')).toMatchObject({ title: 'Hello (Fixed)', artist: 'Aurora Vale', edited: true })
    expect((await json(call('/albums'))).items.map((a: any) => a.title)).toContain('Glass Hours')

    // reset returns to the file's own tags
    const back = await json(call(`/tracks/${t.id}/metadata/reset`, { method: 'POST' }))
    expect(back.edited).toBe(false)
    await scan()
    expect(await track('hello')).toMatchObject({ title: 'Hello', artist: 'Aurora', edited: false })
    expect((await call(`/tracks/${t.id}/metadata`, { method: 'PATCH', body: JSON.stringify({ title: '  ' }) })).status).toBe(400)
  })
})

describe('duplicates', () => {
  test('groups identical files and same-song copies, with explanations', async () => {
    mkdirSync(join(music, 'copy'))
    writeFileSync(join(music, 'Aurora - Hello.mp3'), 'same-bytes')
    writeFileSync(join(music, 'copy', 'Aurora - Hello.mp3'), 'same-bytes')       // identical content
    writeFileSync(join(music, 'Aurora - Hello (320).mp3'), 'different-bytes!!')  // same song, other file (same tags via override)
    overrides['Aurora - Hello (320)'] = { title: 'Hello', artist: 'Aurora', album: 'Aurora Album' }
    writeFileSync(join(music, 'Solo - Unique.mp3'), 'u')
    await addFolder(); await scan()
    const groups = (await json(call('/library/duplicates'))).groups as any[]
    const identical = groups.find((g) => g.reason === 'identical')
    const same = groups.find((g) => g.reason === 'same-song')
    expect(identical.tracks.length).toBe(2)
    expect(identical.tracks.map((x: any) => x.folder).sort()[0]).toContain('music')
    expect(same.tracks.length).toBe(3)
    expect(groups.some((g) => g.tracks.some((x: any) => x.title === 'Unique'))).toBe(false)
  })
})

describe('lyrics', () => {
  test('parses synced and plain LRC text', () => {
    const synced = parseLrc('[ti:Song]\n[00:12.50]First line\n[00:20.00][01:05.25]Chorus\n\n[01:30]Last')
    expect(synced.synced).toBe(true)
    expect(synced.lines.map((l) => [l.timeMs, l.text])).toEqual([[12500, 'First line'], [20000, 'Chorus'], [65250, 'Chorus'], [90000, 'Last']])
    const plain = parseLrc('Just words\nNo times')
    expect(plain.synced).toBe(false)
    expect(plain.lines.map((l) => l.text)).toEqual(['Just words', 'No times'])
  })

  test('serves a sidecar .lrc next to the audio file, 404 when there is none', async () => {
    writeFileSync(join(music, 'A - Song.mp3'), 'x' + join(music, 'A - Song.mp3'))
    writeFileSync(join(music, 'A - Song.lrc'), '[00:01.00]Hello\n[00:03.00]World')
    writeFileSync(join(music, 'B - Silent.mp3'), 'x' + join(music, 'B - Silent.mp3'))
    await addFolder(); await scan()
    const t = await track('song')
    const l = await json(call(`/tracks/${t.id}/lyrics`))
    expect(l.synced).toBe(true)
    expect(l.lines).toEqual([{ timeMs: 1000, text: 'Hello' }, { timeMs: 3000, text: 'World' }])
    expect((await call(`/tracks/${(await track('silent')).id}/lyrics`)).status).toBe(404)
  })
})

describe('loudness and audio settings', () => {
  test('stores a measured gain and exposes it; settings accept EQ / crossfade / rate', async () => {
    writeFileSync(join(music, 'A - Quiet.mp3'), 'x' + join(music, 'A - Quiet.mp3'))
    await addFolder(); await scan()
    const t = await track('quiet')
    expect(t.gainDb).toBeNull()
    expect((await call(`/tracks/${t.id}/gain`, { method: 'PUT', body: JSON.stringify({ gainDb: 4.5 }) })).status).toBe(200)
    expect((await track('quiet')).gainDb).toBe(4.5)
    expect((await call(`/tracks/${t.id}/gain`, { method: 'PUT', body: JSON.stringify({ gainDb: 80 }) })).status).toBe(400)

    const s = await json(call('/settings', { method: 'PATCH', body: JSON.stringify({ playbackRate: 1.5, normalize: true, crossfadeSec: 6, gapless: true, eq: { enabled: true, preset: 'rock', gains: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4] } }) }))
    expect(s).toMatchObject({ playbackRate: 1.5, normalize: true, crossfadeSec: 6, gapless: true })
    expect(s.eq.gains.length).toBe(10)
    expect((await call('/settings', { method: 'PATCH', body: JSON.stringify({ playbackRate: 9 }) })).status).toBe(400)
    expect((await call('/settings', { method: 'PATCH', body: JSON.stringify({ eq: { enabled: true, preset: 'x', gains: [1, 2] } }) })).status).toBe(400)
  })
})

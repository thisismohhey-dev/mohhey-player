import { afterEach, beforeEach, expect, test } from 'bun:test'
import { markDuplicates } from '../src/modules/library/dedupe'
import { openDatabase, type Db } from '../src/shared/db'
import { TracksRepo } from '../src/modules/tracks/repo'

let db: Db
beforeEach(() => { db = openDatabase(':memory:'); db.query("INSERT INTO folders (id, path, added_at) VALUES (1, 'C:/m', 0)").run() })
afterEach(() => db.close())

let n = 0
const add = (o: { hash?: string; fp?: string; bitrate?: number; size?: number; fav?: number; plays?: number; missing?: number }) => {
  n++
  return Number(db.query(
    `INSERT INTO tracks (folder_id, path, file_name, title, duration_ms, size, mtime_ms, content_hash, fingerprint, bitrate, favorite, play_count, missing, search_text, added_at)
     VALUES (1, ?, ?, ?, 1000, ?, 0, ?, ?, ?, ?, ?, ?, '', 0)`,
  ).run(`C:/m/${n}.mp3`, `${n}.mp3`, `t${n}`, o.size ?? 100, o.hash ?? null, o.fp ?? `u${n}`, o.bitrate ?? 128, o.fav ?? 0, o.plays ?? 0, o.missing ?? 0).lastInsertRowid)
}
const hidden = () => db.query<{ id: number }, []>('SELECT id FROM tracks WHERE dup_hidden = 1 ORDER BY id').all().map((r) => r.id)

test('byte-identical copies keep exactly one visible', () => {
  const a = add({ hash: 'h1' }), b = add({ hash: 'h1' }), c = add({ hash: 'h1' }), d = add({ hash: 'other' })
  expect(markDuplicates(db)).toBe(2)
  expect(hidden()).toEqual([b, c]) // oldest wins when everything else ties
  expect(a).toBeLessThan(d)
})

test('the same song in another rip: the higher bitrate stays', () => {
  const low = add({ hash: 'x', fp: 'song', bitrate: 128 }), high = add({ hash: 'y', fp: 'song', bitrate: 320 })
  markDuplicates(db)
  expect(hidden()).toEqual([low])
  expect(high).toBeGreaterThan(low)
})

test('a favourite or well-played copy is preferred over a better-quality one', () => {
  const fav = add({ hash: 'x', fp: 'song', bitrate: 128, fav: 1 }), better = add({ hash: 'y', fp: 'song', bitrate: 320 })
  markDuplicates(db)
  expect(hidden()).toEqual([better])
  expect(fav).toBeLessThan(better)
})

test('groups that overlap through different keys merge into one', () => {
  const a = add({ hash: 'h', fp: 'f1', bitrate: 320 }), b = add({ hash: 'h', fp: 'f2', bitrate: 128 }), c = add({ hash: 'z', fp: 'f2', bitrate: 64 })
  markDuplicates(db)
  expect(hidden()).toEqual([b, c])
  expect(a).toBeLessThan(b)
})

test('missing files never hide anything, and the rule is recomputed (un-hides) on every run', () => {
  const a = add({ hash: 'h' }), gone = add({ hash: 'h', missing: 1 }), b = add({ hash: 'h2' })
  expect(markDuplicates(db)).toBe(0)
  db.query('UPDATE tracks SET content_hash = ? WHERE id = ?').run('h', b)
  expect(markDuplicates(db)).toBe(1)
  db.query('UPDATE tracks SET content_hash = ? WHERE id = ?').run('unique', b)
  expect(markDuplicates(db)).toBe(0)
  expect([a, gone].length).toBe(2)
})

test('hidden copies disappear from lists but the song stays once', () => {
  add({ hash: 'h', fp: 'f', bitrate: 320 }); add({ hash: 'h2', fp: 'f', bitrate: 128 }); add({ hash: 'u' })
  markDuplicates(db)
  expect(new TracksRepo(db).list({}).total).toBe(2)
})

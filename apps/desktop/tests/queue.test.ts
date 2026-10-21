import { describe, expect, test } from 'vitest'
import type { Track } from '@mohhey/contracts'
import { PlayQueue } from '@/lib/player/queue'

const t = (id: number): Track => ({
  id, title: `T${id}`, artistId: null, artist: '', albumId: null, album: '', trackNo: null, discNo: null, year: null,
  durationMs: 1000, format: 'mp3', bitrate: null, fileName: `${id}.mp3`, artworkHash: null, favorite: false,
  playCount: 0, lastPlayedAt: null, missing: false,
})
const tracks = (n: number) => Array.from({ length: n }, (_, i) => t(i + 1))
const ids = (q: PlayQueue) => q.entries.map((e) => e.track.id)
const seeded = (seed = 1) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

describe('PlayQueue', () => {
  test('plays sequentially and ends with repeat off', () => {
    const q = new PlayQueue()
    q.set(tracks(3), 0)
    expect(q.next(true)).toMatchObject({ kind: 'play' })
    q.next(true)
    expect(q.next(true)).toEqual({ kind: 'end' })
    expect(q.current?.track.id).toBe(3)
  })

  test('repeat one replays on auto-advance but moves on manual next', () => {
    const q = new PlayQueue(); q.repeat = 'one'
    q.set(tracks(3), 1)
    expect(q.next(true)).toMatchObject({ kind: 'play', entry: { track: { id: 2 } } })
    expect(q.next(false)).toMatchObject({ kind: 'play', entry: { track: { id: 3 } } })
  })

  test('repeat all wraps around, both directions', () => {
    const q = new PlayQueue(); q.repeat = 'all'
    q.set(tracks(3), 2)
    expect(q.next(true)).toMatchObject({ kind: 'play', entry: { track: { id: 1 } } })
    expect(q.previous()?.track.id).toBe(3)
  })

  test('previous at start stays on the current track', () => {
    const q = new PlayQueue()
    q.set(tracks(3), 0)
    expect(q.previous()?.track.id).toBe(1)
  })

  test('shuffle keeps current first, contains every track once, and restores original order', () => {
    const q = new PlayQueue(seeded())
    q.set(tracks(8), 3)
    q.setShuffle(true)
    expect(q.current?.track.id).toBe(4)
    expect(q.position).toBe(0)
    expect([...ids(q)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(ids(q)).not.toEqual([4, 1, 2, 3, 5, 6, 7, 8])
    q.next(false); q.next(false)
    const cur = q.current!.track.id
    q.setShuffle(false)
    expect(ids(q)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(q.current?.track.id).toBe(cur)
  })

  test('shuffle visits every track before repeat-all restarts', () => {
    const q = new PlayQueue(seeded(7)); q.shuffle = true; q.repeat = 'all'
    q.set(tracks(5), 0)
    const seen = [q.current!.track.id]
    for (let i = 0; i < 4; i++) { const a = q.next(true); if (a.kind === 'play') seen.push(a.entry.track.id) }
    expect(new Set(seen).size).toBe(5)
    const wrapped = q.next(true)
    expect(wrapped.kind).toBe('play')
    if (wrapped.kind === 'play') expect(wrapped.entry.track.id).not.toBe(seen[4])
  })

  test('add next / add end / duplicates', () => {
    const q = new PlayQueue()
    q.set(tracks(3), 0)
    q.add([t(9)], 'next')
    q.add([t(1)], 'end')
    expect(ids(q)).toEqual([1, 9, 2, 3, 1])
    q.setShuffle(true); q.setShuffle(false)
    expect(ids(q)).toEqual([1, 9, 2, 3, 1])
  })

  test('remove adjusts position, reports removing current', () => {
    const q = new PlayQueue()
    q.set(tracks(4), 2)
    expect(q.remove(0)).toEqual({ removedCurrent: false })
    expect(q.current?.track.id).toBe(3)
    expect(q.remove(1)).toEqual({ removedCurrent: true })
    expect(q.current?.track.id).toBe(4)
    expect(q.remove(1)).toEqual({ removedCurrent: true })
    expect(q.position).toBe(0)
    expect(q.current?.track.id).toBe(2)
  })

  test('move reorders and keeps current pointing at the same entry', () => {
    const q = new PlayQueue()
    q.set(tracks(4), 1)
    q.move(3, 0)
    expect(ids(q)).toEqual([4, 1, 2, 3])
    expect(q.current?.track.id).toBe(2)
    q.move(2, 3)
    expect(ids(q)).toEqual([4, 1, 3, 2])
    expect(q.current?.track.id).toBe(2)
    expect(q.position).toBe(3)
  })

  test('clearUpcoming keeps only the current track', () => {
    const q = new PlayQueue()
    q.set(tracks(4), 2)
    q.clearUpcoming()
    expect(ids(q)).toEqual([3])
  })

  test('empty queue is safe', () => {
    const q = new PlayQueue()
    expect(q.next(true)).toEqual({ kind: 'end' })
    expect(q.previous()).toBeNull()
    expect(q.set([], 0)).toBeNull()
  })
})

import { Elysia } from 'elysia'
import { dirname } from 'node:path'
import type { DuplicateGroup } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import type { TracksRepo } from '../tracks/repo'

/**
 * Finds duplicate tracks and explains why:
 *  - identical: same content hash (size + head/tail bytes), i.e. the same file copied to another place;
 *  - same-song: same normalised title/artist/album and length, but different bytes (another rip, bitrate or format).
 * A track can appear in both kinds of group (e.g. two identical copies plus a different rip of the same song).
 */
export function findDuplicates(db: Db, tracks: TracksRepo): DuplicateGroup[] {
  const sizeAndPath = new Map<number, { path: string; size: number }>()
  for (const r of db.query<{ id: number; path: string; size: number }, []>('SELECT id, path, size FROM tracks WHERE missing = 0').all()) {
    sizeAndPath.set(r.id, { path: r.path, size: r.size })
  }

  const groups: { reason: DuplicateGroup['reason']; ids: number[] }[] = []
  const keys = (column: 'content_hash' | 'fingerprint') =>
    db.query<{ k: string }, []>(`SELECT ${column} AS k FROM tracks WHERE missing = 0 AND ${column} IS NOT NULL GROUP BY ${column} HAVING COUNT(*) > 1`).all()
  const idsOf = (column: 'content_hash' | 'fingerprint', k: string) =>
    db.query<{ id: number }, [string]>(`SELECT id FROM tracks WHERE missing = 0 AND ${column} = ? ORDER BY id`).all(k).map((r) => r.id)

  for (const { k } of keys('content_hash')) groups.push({ reason: 'identical', ids: idsOf('content_hash', k) })
  for (const { k } of keys('fingerprint')) {
    const ids = idsOf('fingerprint', k)
    const hashes = new Set(db.query<{ h: string | null }, []>(`SELECT content_hash AS h FROM tracks WHERE id IN (${ids.join(',')})`).all().map((r) => r.h))
    // A set of byte-identical copies is already reported as "identical"; only list the song when other versions exist too.
    if (hashes.size > 1) groups.push({ reason: 'same-song', ids })
  }

  return groups.map((g) => ({
    reason: g.reason,
    tracks: tracks.byIds(g.ids).map((t) => ({ ...t, folder: dirname(sizeAndPath.get(t.id)?.path ?? ''), sizeBytes: sizeAndPath.get(t.id)?.size ?? 0 })),
  }))
}

export const duplicatesRoutes = (db: Db, tracks: TracksRepo) =>
  new Elysia({ name: 'duplicates', prefix: '/library' }).get('/duplicates', () => ({ groups: findDuplicates(db, tracks) }))

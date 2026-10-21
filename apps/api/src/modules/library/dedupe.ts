import type { Db } from '../../shared/db'

interface Row { id: number; content_hash: string | null; fingerprint: string | null; favorite: number; play_count: number; bitrate: number | null; size: number }

/**
 * Keeps one copy of every song visible. Two tracks are the same song when they share a content hash (the same file copied
 * elsewhere) or a fingerprint (same normalised title / artist / album / length, e.g. another rip). Overlapping matches are
 * merged into one group; the copy worth keeping is the favourite / most played, then the higher bitrate, then the larger
 * file, then the oldest. The others get `dup_hidden = 1` (2 marks a single file opened from outside the library), so lists, albums, artists, search and folders skip them.
 * Nothing is deleted: the Duplicates page still lists every copy, and the files on disk are never touched.
 * Returns how many tracks are hidden afterwards.
 */
export function markDuplicates(db: Db): number {
  const rows = db.query<Row, []>(
    'SELECT id, content_hash, fingerprint, favorite, play_count, bitrate, size FROM tracks WHERE missing = 0 AND dup_hidden <> 2', // 2 = a file opened from outside the library; never part of it
  ).all()

  const parent = new Map<number, number>()
  const find = (x: number): number => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n }
    return r
  }
  for (const r of rows) parent.set(r.id, r.id)
  const firstByKey = new Map<string, number>()
  for (const r of rows) {
    for (const key of [r.content_hash && `h:${r.content_hash}`, r.fingerprint && `f:${r.fingerprint}`]) {
      if (!key) continue
      const seen = firstByKey.get(key)
      if (seen === undefined) firstByKey.set(key, r.id)
      else parent.set(find(r.id), find(seen))
    }
  }

  const groups = new Map<number, Row[]>()
  for (const r of rows) {
    const root = find(r.id)
    const g = groups.get(root)
    if (g) g.push(r); else groups.set(root, [r])
  }
  const better = (a: Row, b: Row): number =>
    b.favorite - a.favorite || b.play_count - a.play_count || (b.bitrate ?? 0) - (a.bitrate ?? 0) || b.size - a.size || a.id - b.id

  const hidden: number[] = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    g.sort(better)
    for (const r of g.slice(1)) hidden.push(r.id)
  }

  db.transaction(() => {
    db.exec('UPDATE tracks SET dup_hidden = 0 WHERE dup_hidden = 1')
    const set = db.query('UPDATE tracks SET dup_hidden = 1 WHERE id = ?')
    for (const id of hidden) set.run(id)
  })()
  return hidden.length
}

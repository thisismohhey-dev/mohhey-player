import { Elysia } from 'elysia'
import { dirname, normalize, sep } from 'node:path'
import { z } from 'zod'
import type { BrowseResult } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { badRequest } from '../../shared/errors'
import { escapeLike } from '../../shared/normalize'
import type { TracksRepo } from '../tracks/repo'

const trimSep = (p: string) => (p.length > 1 && p.endsWith(sep) && !/^[A-Za-z]:\\$/.test(p) ? p.slice(0, -1) : p)

/**
 * Browses the library by directory. Only directories inside a registered library folder are reachable;
 * everything is derived from already-scanned tracks, so the filesystem itself is never listed.
 */
export function browse(db: Db, tracks: TracksRepo, rawPath: string): BrowseResult {
  const roots = db.query<{ path: string }, []>('SELECT path FROM folders ORDER BY added_at').all().map((r) => r.path)

  if (!rawPath) {
    const counts = roots.map((root) => {
      const prefix = trimSep(root) + sep
      const n = db.query<{ n: number }, [string]>(
        `SELECT COUNT(*) AS n FROM tracks WHERE missing = 0 AND path LIKE ? ESCAPE '\\'`,
      ).get(`${escapeLike(prefix)}%`)?.n ?? 0
      return { name: root.split(sep).filter(Boolean).pop() ?? root, path: root, trackCount: n }
    })
    return { path: '', parent: null, folders: counts, tracks: [] }
  }

  const path = trimSep(normalize(rawPath))
  const root = roots.find((r) => {
    const rr = trimSep(normalize(r))
    return path === rr || path.startsWith(rr + sep)
  })
  if (!root || path.split(sep).includes('..')) throw badRequest('That folder is not part of your library.')

  const prefix = path + sep
  const like = `${escapeLike(prefix)}%`
  const sepLiteral = sep === '\\' ? '\\' : sep
  const rel = `substr(path, ${prefix.length + 1})`
  const rows = db.query<{ name: string; n: number }, [string]>(
    `SELECT substr(${rel}, 1, instr(${rel}, '${sepLiteral}') - 1) AS name, COUNT(*) AS n
     FROM tracks WHERE missing = 0 AND path LIKE ? ESCAPE '\\' AND instr(${rel}, '${sepLiteral}') > 0
     GROUP BY name ORDER BY name COLLATE NOCASE`,
  ).all(like)
  const ids = db.query<{ id: number }, [string]>(
    `SELECT id FROM tracks WHERE missing = 0 AND path LIKE ? ESCAPE '\\' AND instr(${rel}, '${sepLiteral}') = 0
     ORDER BY file_name COLLATE NOCASE`,
  ).all(like).map((r) => r.id)

  const isRoot = path === trimSep(normalize(root))
  return {
    path,
    parent: isRoot ? '' : trimSep(dirname(path)),
    folders: rows.map((r) => ({ name: r.name, path: prefix + r.name, trackCount: r.n })),
    tracks: tracks.byIds(ids),
  }
}

export const browseRoutes = (db: Db, tracks: TracksRepo) =>
  new Elysia({ name: 'browse', prefix: '/library' })
    .get('/browse', ({ query }) => browse(db, tracks, query.path ?? ''), { query: z.object({ path: z.string().max(2048).optional() }) })

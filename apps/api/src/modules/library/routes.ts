import { Elysia } from 'elysia'
import { z } from 'zod'
import { stat } from 'node:fs/promises'
import { isAbsolute, normalize } from 'node:path'
import { AddFolderBodySchema, type LibraryFolder } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { badRequest, conflict, notFound } from '../../shared/errors'
import type { LibraryScanner } from './scanner'

export const libraryRoutes = (db: Db, scanner: LibraryScanner) => {
  const folders = (): LibraryFolder[] =>
    db.query<{ id: number; path: string; added_at: number; n: number }, []>(
      `SELECT f.id, f.path, f.added_at, COUNT(t.id) AS n FROM folders f
       LEFT JOIN tracks t ON t.folder_id = f.id AND t.missing = 0 GROUP BY f.id ORDER BY f.added_at`,
    ).all().map((r) => ({ id: r.id, path: r.path, addedAt: r.added_at, trackCount: r.n }))

  return new Elysia({ name: 'library', prefix: '/library' })
    .get('/folders', () => ({ items: folders() }))
    .post('/folders', async ({ body, set }) => {
      if (!isAbsolute(body.path)) throw badRequest('Folder path must be absolute.')
      const path = normalize(body.path)
      const isDir = await stat(path).then((s) => s.isDirectory(), () => false)
      if (!isDir) throw badRequest('That folder does not exist or is not readable.')
      const res = db.query('INSERT OR IGNORE INTO folders (path, added_at) VALUES (?, ?)').run(path, Date.now())
      if (res.changes === 0) throw conflict('This folder is already in your library.')
      void scanner.start()
      set.status = 201
      return { items: folders() }
    }, { body: AddFolderBodySchema })
    .delete('/folders/:id', ({ params }) => {
      const res = db.query('DELETE FROM folders WHERE id = ?').run(params.id)
      if (res.changes === 0) throw notFound('Folder')
      scanner.cleanup()
      return { items: folders() }
    }, { params: z.object({ id: z.coerce.number().int() }) })
    .post('/scan', () => { void scanner.start(); return scanner.getStatus() })
    .get('/scan', () => scanner.getStatus())
}

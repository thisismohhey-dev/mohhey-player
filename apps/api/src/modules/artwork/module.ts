import { Elysia } from 'elysia'
import { existsSync } from 'node:fs'
import { readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '../../shared/db'
import { notFound } from '../../shared/errors'

const NAME = /^[a-f0-9]{40}\.(jpg|png)$/

export const artworkRoutes = (db: Db, dir: string) =>
  new Elysia({ name: 'artwork', prefix: '/artwork' })
    // Strict filename allowlist prevents path traversal.
    .get('/:name', ({ params, set }) => {
      if (!NAME.test(params.name)) throw notFound('Artwork')
      const file = join(dir, params.name)
      if (!existsSync(file)) throw notFound('Artwork')
      set.headers['cache-control'] = 'private, max-age=31536000, immutable'
      return Bun.file(file)
    })
    .get('/', async () => {
      if (!existsSync(dir)) return { files: 0, bytes: 0 }
      const names = await readdir(dir)
      let bytes = 0
      for (const n of names) bytes += (await stat(join(dir, n))).size
      return { files: names.length, bytes }
    })
    /** Clears the cache and forces the next scan to re-extract artwork. */
    .delete('/', async () => {
      await rm(dir, { recursive: true, force: true })
      db.exec('UPDATE tracks SET artwork_hash = NULL, mtime_ms = 0')
      return { ok: true }
    })

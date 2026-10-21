import { Elysia } from 'elysia'
import { z } from 'zod'
import type { SearchResult } from '@mohhey/contracts'
import type { TracksRepo } from '../tracks/repo'

export const searchRoutes = (repo: TracksRepo) =>
  new Elysia({ name: 'search', prefix: '/search' })
    .get('/', ({ query }): SearchResult => ({
      tracks: repo.list({ q: query.q, limit: 8 }).items,
      albums: repo.albums(query.q, 6, 0).items,
      artists: repo.artists(query.q, 6, 0).items,
    }), { query: z.object({ q: z.string().trim().min(1).max(200) }) })

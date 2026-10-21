import { Elysia } from 'elysia'
import { z } from 'zod'
import { GainBodySchema, MetadataEditSchema, PositionBodySchema, TrackQuerySchema } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { markDuplicates } from '../library/dedupe'
import { editMetadata, resetMetadata } from './edit'
import { notFound } from '../../shared/errors'
import type { TracksRepo } from './repo'

const IdParams = z.object({ id: z.coerce.number().int() })
const Paging = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

const orNotFound = <T>(value: T | null, what: string): T => {
  if (value === null) throw notFound(what)
  return value
}

export const tracksRoutes = (repo: TracksRepo, db: Db) =>
  new Elysia({ name: 'tracks' })
    .get('/tracks', ({ query }) => repo.list(query), { query: TrackQuerySchema })
    .post('/tracks/by-ids', ({ body }) => ({ items: repo.byIds(body.ids) }), {
      body: z.object({ ids: z.array(z.number().int()).max(2000) }),
    })
    .get('/tracks/:id', ({ params }) => orNotFound(repo.get(params.id), 'Track'), { params: IdParams })
    .put('/tracks/:id/favorite', ({ params, body }) => {
      if (!repo.setFavorite(params.id, body.value)) throw notFound('Track')
      return { id: params.id, favorite: body.value }
    }, { params: IdParams, body: z.object({ value: z.boolean() }) })
    .post('/tracks/:id/played', ({ params, body }) => {
      if (!repo.markPlayed(params.id, body.record)) throw notFound('Track')
      return { ok: true }
    }, { params: IdParams, body: z.object({ record: z.boolean() }) })
    .put('/tracks/:id/position', ({ params, body }) => {
      if (!repo.setResume(params.id, body.positionMs)) throw notFound('Track')
      return { ok: true }
    }, { params: IdParams, body: PositionBodySchema })
    .put('/tracks/:id/gain', ({ params, body }) => {
      if (!repo.setGain(params.id, body.gainDb)) throw notFound('Track')
      return { ok: true }
    }, { params: IdParams, body: GainBodySchema })
    .patch('/tracks/:id/metadata', ({ params, body }) => {
      if (!editMetadata(db, params.id, body)) throw notFound('Track')
      markDuplicates(db) // an edited title/artist can make a song match (or stop matching) another copy
      return orNotFound(repo.get(params.id), 'Track')
    }, { params: IdParams, body: MetadataEditSchema })
    .post('/tracks/:id/metadata/reset', ({ params }) => {
      if (!resetMetadata(db, params.id)) throw notFound('Track')
      markDuplicates(db)
      return orNotFound(repo.get(params.id), 'Track')
    }, { params: IdParams })
    .post('/tracks/:id/missing', ({ params }) => { repo.markMissing(params.id); return { ok: true } }, { params: IdParams })
    // Local path is for the Electron protocol handler only; the renderer never needs it.
    .get('/internal/tracks/:id/path', ({ params }) => ({ path: orNotFound(repo.filePath(params.id), 'Track') }), { params: IdParams })
    .get('/albums', ({ query }) => repo.albums(query.q, query.limit, query.offset), { query: Paging })
    .get('/albums/:id', ({ params }) => orNotFound(repo.album(params.id), 'Album'), { params: IdParams })
    .get('/artists', ({ query }) => repo.artists(query.q, query.limit, query.offset), { query: Paging })
    .get('/artists/:id', ({ params }) => orNotFound(repo.artist(params.id), 'Artist'), { params: IdParams })

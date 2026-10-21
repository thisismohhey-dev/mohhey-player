import { Elysia } from 'elysia'
import { z } from 'zod'
import { PlaylistAddTracksBodySchema, PlaylistMoveBodySchema, PlaylistNameBodySchema } from '@mohhey/contracts'
import { badRequest, notFound } from '../../shared/errors'
import type { PlaylistsRepo } from './repo'

const IdParams = z.object({ id: z.coerce.number().int() })
const EntryParams = z.object({ id: z.coerce.number().int(), position: z.coerce.number().int().min(0) })

export const playlistsRoutes = (repo: PlaylistsRepo) => {
  const must = (id: number) => {
    const p = repo.get(id)
    if (!p) throw notFound('Playlist')
    return p
  }
  return new Elysia({ name: 'playlists', prefix: '/playlists' })
    .get('/', () => ({ items: repo.list() }))
    .post('/', ({ body, set }) => { set.status = 201; return repo.create(body.name) }, { body: PlaylistNameBodySchema })
    .get('/:id', ({ params }) => must(params.id), { params: IdParams })
    .patch('/:id', ({ params, body }) => {
      if (!repo.rename(params.id, body.name)) throw notFound('Playlist')
      return must(params.id)
    }, { params: IdParams, body: PlaylistNameBodySchema })
    .delete('/:id', ({ params }) => {
      if (!repo.remove(params.id)) throw notFound('Playlist')
      return { ok: true }
    }, { params: IdParams })
    .get('/:id/tracks', ({ params }) => { must(params.id); const items = repo.tracksOf(params.id); return { items, total: items.length } }, { params: IdParams })
    .post('/:id/tracks', ({ params, body }) => {
      must(params.id)
      repo.addTracks(params.id, body.trackIds)
      return must(params.id)
    }, { params: IdParams, body: PlaylistAddTracksBodySchema })
    .delete('/:id/tracks/:position', ({ params }) => {
      must(params.id)
      if (!repo.removeAt(params.id, params.position)) throw badRequest('No track at that position.')
      return must(params.id)
    }, { params: EntryParams })
    .post('/:id/move', ({ params, body }) => {
      must(params.id)
      if (!repo.move(params.id, body.from, body.to)) throw badRequest('Position is out of range.')
      return { ok: true }
    }, { params: IdParams, body: PlaylistMoveBodySchema })
}

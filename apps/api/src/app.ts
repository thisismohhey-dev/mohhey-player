import { Elysia } from 'elysia'
import type { ApiError } from '@mohhey/contracts'
import { browseRoutes } from './modules/library/browse'
import { markDuplicates } from './modules/library/dedupe'
import { duplicatesRoutes } from './modules/library/duplicates'
import { lyricsRoutes } from './modules/lyrics/routes'
import { libraryRoutes } from './modules/library/routes'
import { LibraryScanner, type MetadataReader } from './modules/library/scanner'
import { artworkRoutes } from './modules/artwork/module'
import { PlaylistsRepo } from './modules/playlists/repo'
import { playlistsRoutes } from './modules/playlists/routes'
import { searchRoutes } from './modules/search/module'
import { SettingsRepo, settingsRoutes } from './modules/settings/module'
import { TracksRepo } from './modules/tracks/repo'
import { tracksRoutes } from './modules/tracks/routes'
import type { Config } from './shared/config'
import type { Db } from './shared/db'
import { INTERNAL_HEADER, isLoopbackHost, requiresInternal, safeEqual } from './shared/access'
import { HttpError } from './shared/errors'

export interface AppDeps {
  config: Pick<Config, 'token' | 'internalToken' | 'allowedOrigins' | 'artworkDir'>
  db: Db
  metadataReader?: MetadataReader
}

const errorBody = (code: ApiError['code'], message: string): ApiError => ({ code, message })

export function createApp({ config, db, metadataReader }: AppDeps) {
  const tracks = new TracksRepo(db)
  const scanner = new LibraryScanner(db, config.artworkDir, metadataReader)
  markDuplicates(db) // apply the rule to libraries scanned before it existed

  return new Elysia()
    // The API binds to loopback, but loopback alone is not a security boundary: every request needs the per-launch token.
    .onRequest(({ request, set }) => {
      if (!isLoopbackHost(request.headers.get('host'))) {
        set.status = 403
        return errorBody('unauthorized', 'Requests must be addressed to the local service.')
      }
      const origin = request.headers.get('origin')
      if (origin && config.allowedOrigins.includes(origin)) {
        set.headers['access-control-allow-origin'] = origin
        set.headers['access-control-allow-headers'] = 'authorization, content-type'
        set.headers['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        set.headers['vary'] = 'Origin'
      }
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: set.headers as Record<string, string> })
      if (new URL(request.url).pathname === '/health') return
      const header = request.headers.get('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''
      if (!safeEqual(token, config.token)) {
        set.status = 401
        return errorBody('unauthorized', 'Missing or invalid API token.')
      }
      const { pathname } = new URL(request.url)
      if (requiresInternal(request.method, pathname) && !safeEqual(request.headers.get(INTERNAL_HEADER) ?? '', config.internalToken)) {
        set.status = 403
        return errorBody('unauthorized', 'This action is only available from the app itself.')
      }
    })
    .onError(({ error, code, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status
        return errorBody(error.code, error.message)
      }
      if (code === 'VALIDATION' || code === 'PARSE') {
        set.status = 400
        return errorBody('validation', 'The request was not valid.')
      }
      if (code === 'NOT_FOUND') {
        set.status = 404
        return errorBody('not_found', 'Route not found.')
      }
      console.error('[api] unhandled error:', error instanceof Error ? error.message : error)
      set.status = 500
      return errorBody('internal', 'Something went wrong on our side.')
    })
    .get('/health', () => ({ ok: true }))
    .use(libraryRoutes(db, scanner))
    .use(tracksRoutes(tracks, db))
    .use(lyricsRoutes(tracks))
    .use(duplicatesRoutes(db, tracks))
    .use(browseRoutes(db, tracks))
    .use(playlistsRoutes(new PlaylistsRepo(db, tracks)))
    .use(searchRoutes(tracks))
    .use(settingsRoutes(new SettingsRepo(db)))
    .use(artworkRoutes(db, config.artworkDir))
}

export type App = ReturnType<typeof createApp>

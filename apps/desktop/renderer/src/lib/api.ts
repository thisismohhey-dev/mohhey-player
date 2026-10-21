import { z } from 'zod'
import {
  AlbumSchema, AppSettingsSchema, BrowseResultSchema, ArtistSchema, FolderSchema, Page, PlaylistSchema, ScanStatusSchema, SearchResultSchema, TrackSchema,
  type Album, type AppSettings, type BrowseResult, type AppSettingsPatch, type Artist, type LibraryFolder, type Paged, type Playlist, type ScanStatus,
  type SearchResult, type Track, type TrackQuery,
} from '@mohhey/contracts'

export class ApiClientError extends Error {
  constructor(public kind: 'network' | 'api', message: string, public status = 0) { super(message) }
}

interface ApiConfig { baseUrl: string; token: string }
let configPromise: Promise<ApiConfig> | null = null
const getConfig = () => (configPromise ??= window.mohhey.getApiConfig())

async function request<S extends z.ZodType>(
  path: string, schema: S, init: { method?: string; body?: unknown } = {},
): Promise<z.infer<S>> {
  const { baseUrl, token } = await getConfig()
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: { authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiClientError('network', 'The library service is not responding. Please restart the app.')
  }
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message ?? 'The request failed.'
    throw new ApiClientError('api', message, res.status)
  }
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new ApiClientError('api', 'The library service returned an unexpected response.', res.status)
  return parsed.data
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

const Ok = z.object({ ok: z.boolean() })
const Items = <T extends z.ZodType>(s: T) => z.object({ items: z.array(s) })

export const api = {
  tracks: {
    list: (q: TrackQuery = {}): Promise<Paged<Track>> => request(`/tracks${qs({ ...q })}`, Page(TrackSchema)),
    byIds: async (ids: number[]): Promise<Track[]> => (await request('/tracks/by-ids', Items(TrackSchema), { method: 'POST', body: { ids } })).items,
    setFavorite: (id: number, value: boolean) => request(`/tracks/${id}/favorite`, z.object({ favorite: z.boolean() }), { method: 'PUT', body: { value } }),
    played: (id: number, record: boolean) => request(`/tracks/${id}/played`, Ok, { method: 'POST', body: { record } }),
    markMissing: (id: number) => request(`/tracks/${id}/missing`, Ok, { method: 'POST' }),
  },
  albums: {
    list: (q?: string, limit = 200, offset = 0): Promise<Paged<Album>> => request(`/albums${qs({ q, limit, offset })}`, Page(AlbumSchema)),
    get: (id: number): Promise<Album> => request(`/albums/${id}`, AlbumSchema),
  },
  artists: {
    list: (q?: string, limit = 200, offset = 0): Promise<Paged<Artist>> => request(`/artists${qs({ q, limit, offset })}`, Page(ArtistSchema)),
    get: (id: number): Promise<Artist> => request(`/artists/${id}`, ArtistSchema),
  },
  playlists: {
    list: async (): Promise<Playlist[]> => (await request('/playlists', Items(PlaylistSchema))).items,
    get: (id: number): Promise<Playlist> => request(`/playlists/${id}`, PlaylistSchema),
    create: (name: string): Promise<Playlist> => request('/playlists', PlaylistSchema, { method: 'POST', body: { name } }),
    rename: (id: number, name: string): Promise<Playlist> => request(`/playlists/${id}`, PlaylistSchema, { method: 'PATCH', body: { name } }),
    remove: (id: number) => request(`/playlists/${id}`, Ok, { method: 'DELETE' }),
    tracks: async (id: number): Promise<Track[]> => (await request(`/playlists/${id}/tracks`, Page(TrackSchema))).items,
    addTracks: (id: number, trackIds: number[]): Promise<Playlist> => request(`/playlists/${id}/tracks`, PlaylistSchema, { method: 'POST', body: { trackIds } }),
    removeAt: (id: number, position: number): Promise<Playlist> => request(`/playlists/${id}/tracks/${position}`, PlaylistSchema, { method: 'DELETE' }),
    move: (id: number, from: number, to: number) => request(`/playlists/${id}/move`, Ok, { method: 'POST', body: { from, to } }),
  },
  library: {
    folders: async (): Promise<LibraryFolder[]> => (await request('/library/folders', Items(FolderSchema))).items,
    addFolder: async (path: string): Promise<LibraryFolder[]> => (await request('/library/folders', Items(FolderSchema), { method: 'POST', body: { path } })).items,
    removeFolder: async (id: number): Promise<LibraryFolder[]> => (await request(`/library/folders/${id}`, Items(FolderSchema), { method: 'DELETE' })).items,
    scan: (): Promise<ScanStatus> => request('/library/scan', ScanStatusSchema, { method: 'POST' }),
    browse: (path = ''): Promise<BrowseResult> => request(`/library/browse${qs({ path })}`, BrowseResultSchema),
    scanStatus: (): Promise<ScanStatus> => request('/library/scan', ScanStatusSchema),
  },
  search: (q: string): Promise<SearchResult> => request(`/search${qs({ q })}`, SearchResultSchema),
  settings: {
    get: (): Promise<AppSettings> => request('/settings', AppSettingsSchema),
    patch: (patch: AppSettingsPatch): Promise<AppSettings> => request('/settings', AppSettingsSchema, { method: 'PATCH', body: patch }),
  },
  artworkCache: {
    info: () => request('/artwork', z.object({ files: z.number(), bytes: z.number() })),
    clear: () => request('/artwork', Ok, { method: 'DELETE' }),
  },
}

export const trackUrl = (id: number) => `mohhey-media://track/${id}`
export const artUrl = (hash: string | null | undefined) => (hash ? `mohhey-media://art/${hash}` : null)

import { z } from 'zod'

export const TrackSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  artistId: z.number().int().nullable(),
  artist: z.string(),
  albumId: z.number().int().nullable(),
  album: z.string(),
  trackNo: z.number().int().nullable(),
  discNo: z.number().int().nullable(),
  year: z.number().int().nullable(),
  durationMs: z.number().int(),
  format: z.string(),
  bitrate: z.number().int().nullable(),
  fileName: z.string(),
  artworkHash: z.string().nullable(),
  favorite: z.boolean(),
  playCount: z.number().int(),
  lastPlayedAt: z.number().int().nullable(),
  missing: z.boolean(),
})
export type Track = z.infer<typeof TrackSchema>

export const AlbumSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  artist: z.string(),
  year: z.number().int().nullable(),
  trackCount: z.number().int(),
  durationMs: z.number().int(),
  artworkHash: z.string().nullable(),
})
export type Album = z.infer<typeof AlbumSchema>

export const ArtistSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  trackCount: z.number().int(),
  albumCount: z.number().int(),
  artworkHash: z.string().nullable(),
})
export type Artist = z.infer<typeof ArtistSchema>

export const FolderSchema = z.object({
  id: z.number().int(),
  path: z.string(),
  addedAt: z.number().int(),
  trackCount: z.number().int(),
})
export type LibraryFolder = z.infer<typeof FolderSchema>

export const TrackSortSchema = z.enum(['title', 'artist', 'album', 'duration', 'added', 'played', 'plays'])
export type TrackSort = z.infer<typeof TrackSortSchema>

export const TrackQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  sort: TrackSortSchema.default('title'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  favorite: z.enum(['true']).optional(),
  albumId: z.coerce.number().int().optional(),
  artistId: z.coerce.number().int().optional(),
  recent: z.enum(['true']).optional(),
})
export type TrackQuery = Partial<z.output<typeof TrackQuerySchema>>

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int() })
export type Paged<T> = { items: T[]; total: number }

export const ScanStatusSchema = z.object({
  state: z.enum(['idle', 'scanning', 'done', 'error']),
  discovered: z.number().int(),
  processed: z.number().int(),
  added: z.number().int(),
  updated: z.number().int(),
  removed: z.number().int(),
  failed: z.number().int(),
  currentFile: z.string().nullable(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
  startedAt: z.number().int().nullable(),
  finishedAt: z.number().int().nullable(),
})
export type ScanStatus = z.infer<typeof ScanStatusSchema>

export const SearchResultSchema = z.object({
  tracks: z.array(TrackSchema),
  albums: z.array(AlbumSchema),
  artists: z.array(ArtistSchema),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

export const AddFolderBodySchema = z.object({ path: z.string().min(1).max(1024) })

export const BrowseFolderSchema = z.object({
  name: z.string(),
  path: z.string(),
  trackCount: z.number().int(),
})
export const BrowseResultSchema = z.object({
  /** Current directory; empty string means the list of library roots. */
  path: z.string(),
  /** Directory to go "up" to; null at the roots list. */
  parent: z.string().nullable(),
  folders: z.array(BrowseFolderSchema),
  tracks: z.array(TrackSchema),
})
export type BrowseResult = z.infer<typeof BrowseResultSchema>

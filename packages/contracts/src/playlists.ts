import { z } from 'zod'

/** Icons a playlist can use (names map to lucide icons in the renderer). */
export const PLAYLIST_ICONS = [
  'list-music', 'music', 'heart', 'star', 'flame', 'moon', 'sun', 'coffee', 'car', 'dumbbell', 'party-popper', 'headphones',
  'guitar', 'mic', 'radio', 'book-open', 'briefcase', 'gamepad', 'plane', 'sparkles',
] as const
export const PlaylistIconSchema = z.enum(PLAYLIST_ICONS)
export type PlaylistIcon = z.infer<typeof PlaylistIconSchema>

export const PlaylistSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: PlaylistIconSchema,
  trackCount: z.number().int(),
  durationMs: z.number().int(),
  updatedAt: z.number().int(),
  coverHashes: z.array(z.string()),
})
export type Playlist = z.infer<typeof PlaylistSchema>

export const PlaylistNameBodySchema = z.object({ name: z.string().trim().min(1).max(80), icon: PlaylistIconSchema.optional() })
export const PlaylistUpdateBodySchema = z.object({ name: z.string().trim().min(1).max(80).optional(), icon: PlaylistIconSchema.optional() })
export const PlaylistAddTracksBodySchema = z.object({ trackIds: z.array(z.number().int()).min(1).max(1000) })
export const PlaylistMoveBodySchema = z.object({ from: z.number().int().min(0), to: z.number().int().min(0) })

import { z } from 'zod'

export const PlaylistSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  trackCount: z.number().int(),
  durationMs: z.number().int(),
  updatedAt: z.number().int(),
  coverHashes: z.array(z.string()),
})
export type Playlist = z.infer<typeof PlaylistSchema>

export const PlaylistNameBodySchema = z.object({ name: z.string().trim().min(1).max(80) })
export const PlaylistAddTracksBodySchema = z.object({ trackIds: z.array(z.number().int()).min(1).max(1000) })
export const PlaylistMoveBodySchema = z.object({ from: z.number().int().min(0), to: z.number().int().min(0) })

import { Elysia } from 'elysia'
import { readFile } from 'node:fs/promises'
import { parse, join } from 'node:path'
import { parseFile } from 'music-metadata'
import { z } from 'zod'
import type { Lyrics } from '@mohhey/contracts'
import { notFound } from '../../shared/errors'
import type { TracksRepo } from '../tracks/repo'
import { parseLrc } from './lrc'

/** Lyrics come only from the user's own files: a `.lrc` next to the audio file, or lyrics embedded in its tags. */
async function loadLyrics(path: string): Promise<Lyrics | null> {
  const { dir, name } = parse(path)
  try {
    const text = await readFile(join(dir, `${name}.lrc`), 'utf8')
    const parsed = parseLrc(text)
    if (parsed.lines.length) return { ...parsed, source: 'lrc-file' }
  } catch { /* no sidecar file */ }
  try {
    const meta = await parseFile(path, { skipCovers: true, duration: false })
    const embedded = meta.common.lyrics?.[0]
    if (embedded?.syncText?.length) {
      return { synced: true, source: 'embedded', lines: embedded.syncText.map((l) => ({ timeMs: Math.round(l.timestamp ?? 0), text: l.text })) }
    }
    if (embedded?.text) {
      const parsed = parseLrc(embedded.text)
      if (parsed.lines.length) return { ...parsed, source: 'embedded' }
    }
  } catch { /* unreadable tags */ }
  return null
}

export const lyricsRoutes = (repo: TracksRepo) =>
  new Elysia({ name: 'lyrics' })
    .get('/tracks/:id/lyrics', async ({ params }) => {
      const path = repo.filePath(params.id)
      if (!path) throw notFound('Track')
      const lyrics = await loadLyrics(path)
      if (!lyrics) throw notFound('Lyrics')
      return lyrics
    }, { params: z.object({ id: z.coerce.number().int() }) })

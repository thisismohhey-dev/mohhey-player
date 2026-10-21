import type { Track } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { cleanupOrphans, upsertAlbum, upsertArtist } from '../../shared/entities'
import { normalizeText } from '../../shared/normalize'

interface Row { file_name: string; year: number | null }

/**
 * Edits title/artist/album *inside Mohhey only*: the audio file is never written to. Edited tracks are "locked" so a rescan
 * does not overwrite the edit; `resetMetadata` unlocks them and the next scan restores the file's own tags.
 */
export function editMetadata(db: Db, id: number, input: { title: string; artist: string; album: string }): boolean {
  return db.transaction(() => {
    const row = db.query<Row, [number]>('SELECT file_name, year FROM tracks WHERE id = ?').get(id)
    if (!row) return false
    const artistId = input.artist ? upsertArtist(db, input.artist) : null
    const albumId = input.album ? upsertAlbum(db, input.album, artistId, input.artist, row.year) : null
    const search = normalizeText(`${input.title} ${input.artist} ${input.album} ${row.file_name}`)
    db.query('UPDATE tracks SET title = ?, artist_id = ?, album_id = ?, search_text = ?, meta_locked = 1 WHERE id = ?')
      .run(input.title, artistId, albumId, search, id)
    cleanupOrphans(db)
    return true
  })()
}

/** Unlocks the track and forces the next scan to re-read its file tags. */
export function resetMetadata(db: Db, id: number): boolean {
  return db.query('UPDATE tracks SET meta_locked = 0, mtime_ms = 0 WHERE id = ?').run(id).changes > 0
}

export type EditedTrack = Pick<Track, 'id'>

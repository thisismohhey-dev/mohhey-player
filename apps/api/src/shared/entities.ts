import type { Db } from './db'
import { normalizeText } from './normalize'

export function upsertArtist(db: Db, name: string): number {
  const norm = normalizeText(name) || name.toLowerCase()
  db.query('INSERT OR IGNORE INTO artists (name, name_norm) VALUES (?, ?)').run(name, norm)
  return db.query<{ id: number }, [string]>('SELECT id FROM artists WHERE name_norm = ?').get(norm)!.id
}

export function upsertAlbum(db: Db, title: string, artistId: number | null, artistName: string, year: number | null): number {
  const norm = normalizeText(title) || title.toLowerCase()
  const key = normalizeText(artistName)
  db.query('INSERT OR IGNORE INTO albums (title, title_norm, artist_id, artist_key, year) VALUES (?, ?, ?, ?, ?)').run(title, norm, artistId, key, year)
  return db.query<{ id: number }, [string, string]>('SELECT id FROM albums WHERE title_norm = ? AND artist_key = ?').get(norm, key)!.id
}

/** Removes albums/artists that no longer have any track. */
export function cleanupOrphans(db: Db): void {
  db.exec(`
    DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL);
    DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT artist_id FROM albums WHERE artist_id IS NOT NULL);
  `)
}

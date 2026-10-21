import type { Album, Artist, Paged, Track, TrackQuery } from '@mohhey/contracts'
import { TrackQuerySchema } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { escapeLike, normalizeText } from '../../shared/normalize'

interface TrackRow {
  id: number; title: string; artist_id: number | null; artist: string | null; album_id: number | null; album: string | null
  track_no: number | null; disc_no: number | null; year: number | null; duration_ms: number; format: string
  bitrate: number | null; file_name: string; artwork_hash: string | null; favorite: number; play_count: number
  last_played_at: number | null; missing: number
}

interface AggRow { id: number; title: string; artist: string | null; year: number | null; n: number; dur: number; art: string | null }
interface ArtistRow { id: number; name: string; n: number; albums: number; art: string | null }

const TRACK_SELECT = `
  SELECT t.id, t.title, t.artist_id, ar.name AS artist, t.album_id, al.title AS album, t.track_no, t.disc_no, t.year,
         t.duration_ms, t.format, t.bitrate, t.file_name, t.artwork_hash, t.favorite, t.play_count, t.last_played_at, t.missing
  FROM tracks t
  LEFT JOIN artists ar ON ar.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id`

export const mapTrack = (r: TrackRow): Track => ({
  id: r.id, title: r.title, artistId: r.artist_id, artist: r.artist ?? '', albumId: r.album_id, album: r.album ?? '',
  trackNo: r.track_no, discNo: r.disc_no, year: r.year, durationMs: r.duration_ms, format: r.format, bitrate: r.bitrate,
  fileName: r.file_name, artworkHash: r.artwork_hash, favorite: r.favorite === 1, playCount: r.play_count,
  lastPlayedAt: r.last_played_at, missing: r.missing === 1,
})

const mapAlbum = (r: AggRow): Album => ({
  id: r.id, title: r.title, artist: r.artist ?? '', year: r.year, trackCount: r.n, durationMs: r.dur ?? 0, artworkHash: r.art,
})
const mapArtist = (r: ArtistRow): Artist => ({
  id: r.id, name: r.name, trackCount: r.n, albumCount: r.albums, artworkHash: r.art,
})

const SORT_SQL: Record<string, string> = {
  title: 't.title COLLATE NOCASE',
  artist: 'ar.name COLLATE NOCASE, al.title COLLATE NOCASE, t.disc_no, t.track_no',
  album: 'al.title COLLATE NOCASE, t.disc_no, t.track_no',
  duration: 't.duration_ms',
  added: 't.added_at',
  played: 't.last_played_at',
  plays: 't.play_count',
}

/** Builds a WHERE clause where every whitespace-separated token must match the normalised text. */
export function searchClause(q: string | undefined, column = 't.search_text'): { sql: string; params: string[] } {
  const tokens = normalizeText(q ?? '').split(' ').filter(Boolean)
  if (!tokens.length) return { sql: '', params: [] }
  return {
    sql: tokens.map(() => `${column} LIKE ? ESCAPE '\\'`).join(' AND '),
    params: tokens.map((t) => `%${escapeLike(t)}%`),
  }
}

export class TracksRepo {
  constructor(private db: Db) {}

  list(input: TrackQuery): Paged<Track> {
    const q = TrackQuerySchema.parse(input)
    const where: string[] = ['t.missing = 0']
    const params: (string | number)[] = []
    const s = searchClause(q.q)
    if (s.sql) { where.push(s.sql); params.push(...s.params) }
    if (q.favorite) where.push('t.favorite = 1')
    if (q.albumId !== undefined) { where.push('t.album_id = ?'); params.push(q.albumId) }
    if (q.artistId !== undefined) { where.push('t.artist_id = ?'); params.push(q.artistId) }
    if (q.recent) where.push('t.last_played_at IS NOT NULL')
    const whereSql = `WHERE ${where.join(' AND ')}`
    const sort = q.recent ? 't.last_played_at' : SORT_SQL[q.sort]
    const dir = q.recent ? 'DESC' : q.dir === 'desc' ? 'DESC' : 'ASC'
    const total = this.db.query<{ n: number }, (string | number)[]>(
      `SELECT COUNT(*) AS n FROM tracks t LEFT JOIN artists ar ON ar.id = t.artist_id LEFT JOIN albums al ON al.id = t.album_id ${whereSql}`,
    ).get(...params)?.n ?? 0
    const rows = this.db.query<TrackRow, (string | number)[]>(
      `${TRACK_SELECT} ${whereSql} ORDER BY ${sort} ${dir}, t.id LIMIT ? OFFSET ?`,
    ).all(...params, q.limit, q.offset)
    return { items: rows.map(mapTrack), total }
  }

  byIds(ids: number[]): Track[] {
    if (!ids.length) return []
    const rows = this.db.query<TrackRow, number[]>(
      `${TRACK_SELECT} WHERE t.id IN (${ids.map(() => '?').join(',')})`,
    ).all(...ids)
    const byId = new Map(rows.map((r) => [r.id, mapTrack(r)]))
    return ids.flatMap((id) => byId.get(id) ?? [])
  }

  get(id: number): Track | null {
    return this.byIds([id])[0] ?? null
  }

  filePath(id: number): string | null {
    return this.db.query<{ path: string }, [number]>('SELECT path FROM tracks WHERE id = ?').get(id)?.path ?? null
  }

  setFavorite(id: number, value: boolean): boolean {
    return this.db.query('UPDATE tracks SET favorite = ? WHERE id = ?').run(value ? 1 : 0, id).changes > 0
  }

  markPlayed(id: number, record: boolean): boolean {
    const now = Date.now()
    return this.db.transaction(() => {
      const ok = this.db.query('UPDATE tracks SET play_count = play_count + 1, last_played_at = ? WHERE id = ?').run(now, id).changes > 0
      if (ok && record) this.db.query('INSERT INTO play_history (track_id, played_at) VALUES (?, ?)').run(id, now)
      return ok
    })()
  }

  markMissing(id: number): void {
    this.db.query('UPDATE tracks SET missing = 1 WHERE id = ?').run(id)
  }

  albums(q: string | undefined, limit: number, offset: number): Paged<Album> {
    const s = searchClause(q, "(al.title_norm || ' ' || COALESCE(ar.name_norm, ''))")
    const where = s.sql ? `AND ${s.sql}` : ''
    const base = `FROM albums al LEFT JOIN artists ar ON ar.id = al.artist_id
      JOIN tracks t ON t.album_id = al.id AND t.missing = 0 WHERE 1=1 ${where}`
    const total = this.db.query<{ n: number }, string[]>(`SELECT COUNT(DISTINCT al.id) AS n ${base}`).get(...s.params)?.n ?? 0
    const rows = this.db.query<AggRow, (string | number)[]>(
      `SELECT al.id, al.title, ar.name AS artist, al.year, COUNT(t.id) AS n, SUM(t.duration_ms) AS dur, MAX(t.artwork_hash) AS art
       ${base} GROUP BY al.id ORDER BY al.title COLLATE NOCASE LIMIT ? OFFSET ?`,
    ).all(...s.params, limit, offset)
    return { total, items: rows.map(mapAlbum) }
  }

  album(id: number): Album | null {
    const r = this.db.query<AggRow, [number]>(
      `SELECT al.id, al.title, ar.name AS artist, al.year, COUNT(t.id) AS n, COALESCE(SUM(t.duration_ms),0) AS dur, MAX(t.artwork_hash) AS art
       FROM albums al LEFT JOIN artists ar ON ar.id = al.artist_id LEFT JOIN tracks t ON t.album_id = al.id AND t.missing = 0
       WHERE al.id = ? GROUP BY al.id`,
    ).get(id)
    return r ? mapAlbum(r) : null
  }

  artists(q: string | undefined, limit: number, offset: number): Paged<Artist> {
    const s = searchClause(q, 'ar.name_norm')
    const where = s.sql ? `AND ${s.sql}` : ''
    const base = `FROM artists ar JOIN tracks t ON t.artist_id = ar.id AND t.missing = 0 WHERE 1=1 ${where}`
    const total = this.db.query<{ n: number }, string[]>(`SELECT COUNT(DISTINCT ar.id) AS n ${base}`).get(...s.params)?.n ?? 0
    const rows = this.db.query<ArtistRow, (string | number)[]>(
      `SELECT ar.id, ar.name, COUNT(t.id) AS n, COUNT(DISTINCT t.album_id) AS albums, MAX(t.artwork_hash) AS art
       ${base} GROUP BY ar.id ORDER BY ar.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    ).all(...s.params, limit, offset)
    return { total, items: rows.map(mapArtist) }
  }

  artist(id: number): Artist | null {
    const r = this.db.query<ArtistRow, [number]>(
      `SELECT ar.id, ar.name, COUNT(t.id) AS n, COUNT(DISTINCT t.album_id) AS albums, MAX(t.artwork_hash) AS art
       FROM artists ar LEFT JOIN tracks t ON t.artist_id = ar.id AND t.missing = 0 WHERE ar.id = ? GROUP BY ar.id`,
    ).get(id)
    return r ? mapArtist(r) : null
  }
}

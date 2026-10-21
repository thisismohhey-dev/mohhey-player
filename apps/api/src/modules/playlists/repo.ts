import type { Playlist, Track } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import type { TracksRepo } from '../tracks/repo'

interface PlaylistRow { id: number; name: string; icon: string; updated_at: number; n: number; dur: number }

export class PlaylistsRepo {
  constructor(private db: Db, private tracks: TracksRepo) {}

  list(): Playlist[] {
    const rows = this.db.query<PlaylistRow, []>(
      `SELECT p.id, p.name, p.icon, p.updated_at, COUNT(t.id) AS n, COALESCE(SUM(t.duration_ms), 0) AS dur
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       LEFT JOIN tracks t ON t.id = pt.track_id AND t.missing = 0
       GROUP BY p.id ORDER BY p.updated_at DESC`,
    ).all()
    return rows.map((r) => this.toPlaylist(r))
  }

  get(id: number): Playlist | null {
    const r = this.db.query<PlaylistRow, [number]>(
      `SELECT p.id, p.name, p.icon, p.updated_at, COUNT(t.id) AS n, COALESCE(SUM(t.duration_ms), 0) AS dur
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
       LEFT JOIN tracks t ON t.id = pt.track_id AND t.missing = 0
       WHERE p.id = ? GROUP BY p.id`,
    ).get(id)
    return r ? this.toPlaylist(r) : null
  }

  private toPlaylist(r: PlaylistRow): Playlist {
    const covers = this.db.query<{ h: string }, [number]>(
      `SELECT DISTINCT t.artwork_hash AS h FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = ? AND t.artwork_hash IS NOT NULL ORDER BY pt.position LIMIT 4`,
    ).all(r.id).map((c) => c.h)
    return { id: r.id, name: r.name, icon: r.icon as Playlist['icon'], trackCount: r.n, durationMs: r.dur, updatedAt: r.updated_at, coverHashes: covers }
  }

  create(name: string, icon: Playlist['icon'] = 'list-music'): Playlist {
    const now = Date.now()
    const res = this.db.query('INSERT INTO playlists (name, icon, created_at, updated_at) VALUES (?, ?, ?, ?)').run(name, icon, now, now)
    return this.get(Number(res.lastInsertRowid))!
  }

  update(id: number, patch: { name?: string; icon?: Playlist['icon'] }): boolean {
    const cur = this.get(id)
    if (!cur) return false
    this.db.query('UPDATE playlists SET name = ?, icon = ?, updated_at = ? WHERE id = ?').run(patch.name ?? cur.name, patch.icon ?? cur.icon, Date.now(), id)
    return true
  }

  remove(id: number): boolean {
    return this.db.query('DELETE FROM playlists WHERE id = ?').run(id).changes > 0
  }

  tracksOf(id: number): Track[] {
    const ids = this.db.query<{ track_id: number }, [number]>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position',
    ).all(id).map((r) => r.track_id)
    return this.tracks.byIds(ids)
  }

  /** Entries (not unique tracks) so the same track can appear twice; position is 0-based and gapless. */
  private entryIds(id: number): number[] {
    return this.db.query<{ id: number }, [number]>('SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position').all(id).map((r) => r.id)
  }

  private renumber(playlistId: number, ordered: number[]): void {
    const upd = this.db.query('UPDATE playlist_tracks SET position = ? WHERE id = ?')
    ordered.forEach((entry, i) => upd.run(i, entry))
    this.db.query('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId)
  }

  addTracks(id: number, trackIds: number[]): void {
    this.db.transaction(() => {
      const existing = this.tracks.byIds([...new Set(trackIds)]).map((t) => t.id)
      const valid = new Set(existing)
      let pos = this.entryIds(id).length
      const ins = this.db.query('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)')
      for (const t of trackIds) if (valid.has(t)) ins.run(id, t, pos++)
      this.db.query('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), id)
    })()
  }

  /** Removes the entry at `position`. */
  removeAt(id: number, position: number): boolean {
    return this.db.transaction(() => {
      const entries = this.entryIds(id)
      const entry = entries[position]
      if (entry === undefined) return false
      this.db.query('DELETE FROM playlist_tracks WHERE id = ?').run(entry)
      entries.splice(position, 1)
      this.renumber(id, entries)
      return true
    })()
  }

  move(id: number, from: number, to: number): boolean {
    return this.db.transaction(() => {
      const entries = this.entryIds(id)
      if (from >= entries.length || to >= entries.length) return false
      const [moved] = entries.splice(from, 1)
      entries.splice(to, 0, moved!)
      this.renumber(id, entries)
      return true
    })()
  }
}

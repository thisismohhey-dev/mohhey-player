import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

interface Migration { version: number; name: string; sql: string }

/** Versioned, append-only migrations. Never edit an applied migration. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial',
    sql: `
      CREATE TABLE folders (
        id INTEGER PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE artists (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        name_norm TEXT NOT NULL UNIQUE
      );
      CREATE TABLE albums (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        title_norm TEXT NOT NULL,
        artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
        artist_key TEXT NOT NULL,
        year INTEGER,
        UNIQUE (title_norm, artist_key)
      );
      CREATE TABLE tracks (
        id INTEGER PRIMARY KEY,
        folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        title TEXT NOT NULL,
        artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
        album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
        track_no INTEGER,
        disc_no INTEGER,
        year INTEGER,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        format TEXT NOT NULL DEFAULT '',
        bitrate INTEGER,
        size INTEGER NOT NULL DEFAULT 0,
        mtime_ms INTEGER NOT NULL DEFAULT 0,
        artwork_hash TEXT,
        fingerprint TEXT NOT NULL,
        search_text TEXT NOT NULL,
        missing INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER,
        added_at INTEGER NOT NULL
      );
      CREATE INDEX idx_tracks_title ON tracks(title COLLATE NOCASE);
      CREATE INDEX idx_tracks_album ON tracks(album_id, disc_no, track_no);
      CREATE INDEX idx_tracks_artist ON tracks(artist_id);
      CREATE INDEX idx_tracks_fingerprint ON tracks(fingerprint);
      CREATE INDEX idx_tracks_favorite ON tracks(favorite) WHERE favorite = 1;
      CREATE INDEX idx_tracks_last_played ON tracks(last_played_at) WHERE last_played_at IS NOT NULL;
      CREATE TABLE playlists (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE playlist_tracks (
        id INTEGER PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        position INTEGER NOT NULL
      );
      CREATE INDEX idx_playlist_tracks_order ON playlist_tracks(playlist_id, position);
      CREATE TABLE play_history (
        id INTEGER PRIMARY KEY,
        track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        played_at INTEGER NOT NULL
      );
      CREATE INDEX idx_history_played ON play_history(played_at DESC);
      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    name: 'playlist_icons',
    sql: `ALTER TABLE playlists ADD COLUMN icon TEXT NOT NULL DEFAULT 'list-music';`,
  },
  {
    version: 3,
    name: 'resume_hash_gain_edits',
    sql: `
      ALTER TABLE tracks ADD COLUMN resume_ms INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tracks ADD COLUMN content_hash TEXT;
      ALTER TABLE tracks ADD COLUMN gain_db REAL;
      ALTER TABLE tracks ADD COLUMN meta_locked INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX idx_tracks_content_hash ON tracks(content_hash) WHERE content_hash IS NOT NULL;
      -- Re-read every file once on the next scan: repairs garbled tags, reads ReplayGain, computes content hashes.
      UPDATE tracks SET mtime_ms = 0;
    `,
  },
]

export function openDatabase(path: string, migrations: Migration[] = MIGRATIONS): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path, { create: true, strict: true })
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;')
  migrate(db, migrations)
  return db
}

export function migrate(db: Database, migrations: Migration[]): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)')
  const applied = new Set(
    db.query<{ version: number }, []>('SELECT version FROM schema_migrations').all().map((r) => r.version),
  )
  for (const m of migrations) {
    if (applied.has(m.version)) continue
    db.transaction(() => {
      db.exec(m.sql)
      db.query('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now())
    })()
  }
}

export type Db = Database

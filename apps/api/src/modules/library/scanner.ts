import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { readdir, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { parseFile } from 'music-metadata'
import type { ScanStatus } from '@mohhey/contracts'
import type { Db } from '../../shared/db'
import { normalizeText } from '../../shared/normalize'

/** Extensions Chromium (Electron) can decode. Verified list; extend only after testing playback. */
export const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.weba'])
const MAX_ERRORS = 50
const CONCURRENCY = 4

const emptyStatus = (): ScanStatus => ({
  state: 'idle', discovered: 0, processed: 0, added: 0, updated: 0, removed: 0, failed: 0,
  currentFile: null, errors: [], startedAt: null, finishedAt: null,
})

interface ExistingRow { id: number; size: number; mtime_ms: number; missing: number }
interface FolderRow { id: number; path: string }

export interface ParsedTrack {
  title: string; artist: string; album: string; albumArtist: string; trackNo: number | null; discNo: number | null
  year: number | null; durationMs: number; format: string; bitrate: number | null
  picture: { data: Uint8Array; format: string } | null
}

export type MetadataReader = (path: string) => Promise<ParsedTrack>

export const readMetadata: MetadataReader = async (path) => {
  const meta = await parseFile(path, { duration: true, skipCovers: false })
  const { common, format } = meta
  // parseFile is lenient: junk bytes with an audio extension parse as an empty file. Treat that as unreadable.
  if (!format.codec && !format.container) throw new Error('Not a recognised audio file.')
  const picture = common.picture?.[0]
  return {
    title: common.title?.trim() || '',
    artist: common.artist?.trim() || common.albumartist?.trim() || '',
    album: common.album?.trim() || '',
    albumArtist: common.albumartist?.trim() || common.artist?.trim() || '',
    trackNo: common.track.no ?? null,
    discNo: common.disk.no ?? null,
    year: common.year ?? null,
    durationMs: Math.round((format.duration ?? 0) * 1000),
    format: (format.codec ?? format.container ?? extname(path).slice(1)).toString().toLowerCase(),
    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
    picture: picture ? { data: picture.data, format: picture.format } : null,
  }
}

async function* walk(dir: string, onError: (path: string, err: unknown) => void): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    onError(dir, err)
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full, onError)
    else if (e.isFile() && AUDIO_EXTENSIONS.has(extname(e.name).toLowerCase())) yield full
  }
}

export class LibraryScanner {
  private status: ScanStatus = emptyStatus()
  private running: Promise<void> | null = null

  constructor(private db: Db, private artworkDir: string, private read: MetadataReader = readMetadata) {}

  getStatus(): ScanStatus {
    return { ...this.status, errors: [...this.status.errors] }
  }

  /** Starts a scan unless one is already running. Resolves when the scan finishes. */
  start(): Promise<void> {
    if (this.running) return this.running
    this.status = { ...emptyStatus(), state: 'scanning', startedAt: Date.now() }
    this.running = this.run()
      .catch((err) => {
        this.status.state = 'error'
        this.pushError('', err)
      })
      .finally(() => {
        this.status.finishedAt = Date.now()
        this.status.currentFile = null
        this.running = null
      })
    return this.running
  }

  private pushError(path: string, err: unknown): void {
    this.status.failed++
    if (this.status.errors.length < MAX_ERRORS) {
      this.status.errors.push({ path, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async run(): Promise<void> {
    mkdirSync(this.artworkDir, { recursive: true })
    const folders = this.db.query<FolderRow, []>('SELECT id, path FROM folders').all()
    for (const folder of folders) {
      const accessible = await stat(folder.path).then((s) => s.isDirectory(), () => false)
      if (!accessible) {
        this.pushError(folder.path, new Error('Folder is not accessible. It may be on a disconnected drive.'))
        continue
      }
      await this.scanFolder(folder)
    }
    this.cleanupOrphans()
    if (this.status.state === 'scanning') this.status.state = 'done'
  }

  private async scanFolder(folder: FolderRow): Promise<void> {
    const seen = new Set<number>()
    const files: string[] = []
    let walkFailed = false
    for await (const file of walk(folder.path, (p, e) => { walkFailed = true; this.pushError(p, e) })) {
      files.push(file)
      this.status.discovered = this.status.discovered + 1
      if (files.length % 200 === 0) await Promise.resolve()
    }

    // Tracks of this folder whose path no longer exists: candidates for re-linking when the same file shows up elsewhere.
    const found = new Set(files)
    const stale = new Set(
      this.db.query<{ id: number; path: string }, [number]>('SELECT id, path FROM tracks WHERE folder_id = ? AND missing = 0')
        .all(folder.id).filter((r) => !found.has(r.path)).map((r) => r.id),
    )

    let cursor = 0
    const worker = async () => {
      while (cursor < files.length) {
        const file = files[cursor++]!
        this.status.currentFile = basename(file)
        try {
          const id = await this.processFile(folder.id, file, stale)
          if (id) seen.add(id)
        } catch (err) {
          this.pushError(file, err)
        }
        this.status.processed++
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // Only mark tracks missing when we could fully walk the folder.
    if (!walkFailed) {
      const rows = this.db.query<{ id: number }, [number]>('SELECT id FROM tracks WHERE folder_id = ? AND missing = 0').all(folder.id)
      const mark = this.db.query('UPDATE tracks SET missing = 1 WHERE id = ?')
      this.db.transaction(() => {
        for (const r of rows) if (!seen.has(r.id)) { mark.run(r.id); this.status.removed++ }
      })()
    }
  }

  /** Idempotent: unchanged files (same path, size, mtime) are skipped; moved files are re-linked by fingerprint. */
  private async processFile(folderId: number, path: string, stale: Set<number>): Promise<number | null> {
    const st = await stat(path)
    const existing = this.db.query<ExistingRow, [string]>('SELECT id, size, mtime_ms, missing FROM tracks WHERE path = ?').get(path)
    const mtime = Math.floor(st.mtimeMs)
    if (existing && existing.size === st.size && existing.mtime_ms === mtime && existing.missing === 0) return existing.id

    const meta = await this.read(path)
    const fileName = basename(path)
    const title = meta.title || basename(path, extname(path))
    const artworkHash = meta.picture ? await this.saveArtwork(meta.picture) : null
    const fingerprint = createHash('sha1')
      .update(`${normalizeText(title)}|${normalizeText(meta.artist)}|${normalizeText(meta.album)}|${Math.round(meta.durationMs / 1000)}`)
      .digest('hex')

    return this.db.transaction(() => {
      const artistId = meta.artist ? this.upsertArtist(meta.artist) : null
      const albumArtistId = meta.albumArtist ? this.upsertArtist(meta.albumArtist) : null
      const albumId = meta.album ? this.upsertAlbum(meta.album, albumArtistId, meta.albumArtist, meta.year) : null
      const searchText = normalizeText(`${title} ${meta.artist} ${meta.album} ${fileName}`)
      const values = [
        folderId, fileName, title, artistId, albumId, meta.trackNo, meta.discNo, meta.year, meta.durationMs, meta.format,
        meta.bitrate, st.size, mtime, artworkHash, fingerprint, searchText,
      ] as const

      if (existing) {
        this.db.query(
          `UPDATE tracks SET folder_id=?, file_name=?, title=?, artist_id=?, album_id=?, track_no=?, disc_no=?, year=?, duration_ms=?,
           format=?, bitrate=?, size=?, mtime_ms=?, artwork_hash=?, fingerprint=?, search_text=?, missing=0 WHERE id=?`,
        ).run(...values, existing.id)
        this.status.updated++
        return existing.id
      }

      const moved = this.db.query<{ id: number; missing: number }, [string]>(
        'SELECT id, missing FROM tracks WHERE fingerprint = ? ORDER BY id',
      ).all(fingerprint).find((r) => r.missing === 1 || stale.has(r.id))
      if (moved) {
        stale.delete(moved.id)
        this.db.query(
          `UPDATE tracks SET path=?, folder_id=?, file_name=?, title=?, artist_id=?, album_id=?, track_no=?, disc_no=?, year=?, duration_ms=?,
           format=?, bitrate=?, size=?, mtime_ms=?, artwork_hash=?, fingerprint=?, search_text=?, missing=0 WHERE id=?`,
        ).run(path, ...values, moved.id)
        this.status.updated++
        return moved.id
      }

      const res = this.db.query(
        `INSERT INTO tracks (path, folder_id, file_name, title, artist_id, album_id, track_no, disc_no, year, duration_ms, format, bitrate,
          size, mtime_ms, artwork_hash, fingerprint, search_text, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(path, ...values, Date.now())
      this.status.added++
      return Number(res.lastInsertRowid)
    })()
  }

  private upsertArtist(name: string): number {
    const norm = normalizeText(name) || name.toLowerCase()
    this.db.query('INSERT OR IGNORE INTO artists (name, name_norm) VALUES (?, ?)').run(name, norm)
    return this.db.query<{ id: number }, [string]>('SELECT id FROM artists WHERE name_norm = ?').get(norm)!.id
  }

  private upsertAlbum(title: string, artistId: number | null, artistName: string, year: number | null): number {
    const norm = normalizeText(title) || title.toLowerCase()
    const key = normalizeText(artistName)
    this.db.query('INSERT OR IGNORE INTO albums (title, title_norm, artist_id, artist_key, year) VALUES (?, ?, ?, ?, ?)')
      .run(title, norm, artistId, key, year)
    return this.db.query<{ id: number }, [string, string]>('SELECT id FROM albums WHERE title_norm = ? AND artist_key = ?').get(norm, key)!.id
  }

  private async saveArtwork(pic: { data: Uint8Array; format: string }): Promise<string> {
    const hash = createHash('sha1').update(pic.data).digest('hex')
    const ext = pic.format.includes('png') ? 'png' : 'jpg'
    const file = join(this.artworkDir, `${hash}.${ext}`)
    if (!existsSync(file)) await writeFile(file, pic.data)
    return `${hash}.${ext}`
  }

  private cleanupOrphans(): void {
    this.db.exec(`
      DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL);
      DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT artist_id FROM albums WHERE artist_id IS NOT NULL);
    `)
  }

  /** Removes orphaned albums/artists after a folder is removed. */
  cleanup(): void { this.cleanupOrphans() }
}

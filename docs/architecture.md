# Architecture

Modular monolith in a Bun workspace.

```
apps/api/src/modules/   library (folders + scanner) · tracks (tracks/albums/artists) · playlists · search · settings · artwork
apps/api/src/shared/    db + migrations · config · errors · text normalisation
apps/desktop/electron/  main (api-process, protocols, security, policy, window) · preload
apps/desktop/renderer/  lib/player (engine, queue) · stores (player, library, ui) · composables · components · pages
packages/contracts/     Zod schemas + TS types shared by API and renderer, and the preload bridge interface
```

## Rules
- Pages and components hold no domain logic. Playback rules live in `lib/player/queue.ts` (pure, unit-tested); the
  `HTMLAudioElement` wrapper is `lib/player/engine.ts`; orchestration is `stores/player.ts`.
- API routes are thin; data access is in repositories (`*/repo.ts`) with parameterised SQL only.
- Modules do not reach into each other's internals (playlists uses `TracksRepo`'s public methods).
- Renderer-side API responses are re-validated with the shared Zod schemas (`lib/api.ts`).

## Data flow
- **Scan:** `POST /library/scan` starts a background `LibraryScanner` (4 workers); the UI polls `GET /library/scan` every
  600 ms for progress. It is idempotent: unchanged files (path + size + mtime) are skipped; a moved file is re-linked to
  its old row by fingerprint (title|artist|album|duration), keeping favorites and playlist membership; vanished files
  become `missing` (never deleted from disk or hard-deleted from the DB).
- **Lists:** `usePagedTracks` fetches 100-row pages on demand; `TrackList` virtualises rows (TanStack Virtual).
- **Queue/settings persistence:** debounced `PATCH /settings` (queue ids, index, position, volume, shuffle, repeat).
- **History:** a play is counted after 30 s or 50 % of the track, and only when "Keep play history" is on.

## Audio engine (renderer)
`lib/player/engine.ts` drives **two** `<audio>` decks. One is active; the other preloads the next track (gapless) or overlaps it with the
ending one (crossfade, equal-power curves). Both feed one Web Audio graph (`graph.ts`):
deck gain (crossfade × loudness correction) → 10-band EQ → soft limiter → master (volume, skip/pause fades). An analyser taps the raw signal,
which the player store uses to learn a loudness correction for tracks without ReplayGain tags. The media scheme answers with CORS headers
and is registered `corsEnabled`, because Web Audio outputs silence for media it is not allowed to read.

Per-track state kept in SQLite: resume position (tracks ≥ 10 min), gain (dB), content hash (size + first/last 64 KB) for duplicate detection,
and a `meta_locked` flag for user edits. Migration 3 forces one full re-read of tags on the next scan.

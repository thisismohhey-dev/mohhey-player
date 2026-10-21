# Mohhey Player

Offline desktop music player. **Electron · Vue 3 · shadcn-vue + Tailwind · Elysia (Bun) · SQLite.**

## Requirements
Bun ≥ 1.2 on Windows, macOS or Linux.

## Run
```bash
bun install
bun run dev        # Electron + Vite HMR + the API as a child process
```
If Electron's binary was not downloaded by `bun install`, run
`node node_modules/.bun/electron@*/node_modules/electron/install.js` once.

Choose your music folder in the onboarding screen; scanning starts immediately.

## Scripts
| Command | What it does |
|---|---|
| `bun run typecheck` | contracts, API, renderer and Electron |
| `bun run test` | API (bun:test) and desktop (vitest) |
| `bun run build` | production bundles into `apps/desktop/out` |
| `bunx electron-vite preview` (in `apps/desktop`) | run the production build (custom `mohhey-app://` origin) |

Dev helpers: `MOHHEY_USER_DATA=<dir>` isolates the profile; `MOHHEY_DEBUG_PORT=<port>` opens CDP (never in packaged builds).

## Data and backup
Everything lives in `<userData>/data/`: `library.db` (+ `-wal`, `-shm`) and `artwork/`. Copy the folder to back up.
Settings → "Clear & rebuild" regenerates the artwork cache.

## Docs
`docs/architecture.md`, `docs/design-system.md`, `docs/decisions/`.

## Known limitations
- No installer yet: packaging needs `bun build --compile` for the API plus electron-builder (see ADR 0002).
- Media keys and OS "now playing" use Chromium's MediaSession. Implemented, but not verified on real hardware.
- Equalizer, crossfade, gapless, lyrics and tag editing are deliberately deferred until the core is stable.
- Persian UI strings and a Persian font (e.g. Vazirmatn) are not included yet; the layout is already RTL-ready.

# Mohhey Player

Offline desktop music player. **Electron · Vue 3 · shadcn-vue + Tailwind · Elysia (Bun) · SQLite.**

![Home](docs/screenshots/home.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/now-playing.png" alt="Now Playing"><br><sub>Now Playing, with a blurred-artwork backdrop</sub></td>
    <td width="50%"><img src="docs/screenshots/folders.png" alt="Folder browser"><br><sub>Browse by folder, breadcrumbs, play a whole folder</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/album.png" alt="Album"><br><sub>Album page</sub></td>
    <td><img src="docs/screenshots/queue.png" alt="Queue"><br><sub>Queue panel (drag to reorder)</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/home-dark.png" alt="Dark theme"><br><sub>Dark theme</sub></td>
    <td><img src="docs/screenshots/playlist.png" alt="Playlist"><br><sub>Playlists</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/songs.png" alt="Songs"><br><sub>Songs: virtualised, sortable, filterable</sub></td>
    <td><img src="docs/screenshots/albums.png" alt="Albums"><br><sub>Albums</sub></td>
  </tr>
</table>

### Liquid-glass player bar
The player bar is Apple-style liquid glass: clear and lightly frosted (backdrop blur + saturation), with a bright specular rim and no
colour of its own. It picks up whatever scrolls behind it, in both light and dark.

<img src="docs/screenshots/glass-bar.png" alt="Glass player bar close-up">

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/glass-light.png" alt="Glass player bar, light"></td>
    <td width="50%"><img src="docs/screenshots/glass-dark.png" alt="Glass player bar, dark"></td>
  </tr>
</table>

### Persian / right-to-left
Switch the language in **Settings → Language**. The whole UI flips to RTL (sidebar, queue panel, lists, breadcrumbs) and uses
[Vazirmatn](https://github.com/rastikerdar/vazirmatn) (SIL OFL) with Persian digits and the Jalali date. Playback controls and the
seek bar deliberately stay left-to-right, as on every media player.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/fa-home.png" alt="Home (Persian)"></td>
    <td width="50%"><img src="docs/screenshots/fa-queue.png" alt="Queue (Persian)"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/fa-folders.png" alt="Folders (Persian)"></td>
    <td><img src="docs/screenshots/fa-settings.png" alt="Settings (Persian)"></td>
  </tr>
</table>

### Mini player
Always-on-top, stays above every other window so you can control playback without switching apps
(`Ctrl+Shift+M`, or the mini-player button next to the queue). While it is active the full player leaves the taskbar and
lives in the **system tray** next to the clock: click the tray icon to bring it back, or right-click for previous / play / next.

<img src="docs/screenshots/mini.png" alt="Mini player" width="360"> <img src="docs/screenshots/fa-mini.png" alt="Mini player (Persian)" width="360">

### Small touches
<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/sidebar-collapsed.png" alt="Collapsed sidebar"><br><sub>Collapsible sidebar (`Ctrl+B`), icons only. Search is an icon until you click it (`Ctrl+K`).</sub></td>
    <td width="50%"><img src="docs/screenshots/playlist-dialog.png" alt="Playlist dialog"><br><sub>Playlists have an icon, can be edited from the sidebar (hover or right-click) and deleted.</sub></td>
  </tr>
</table>

<img src="docs/screenshots/app-icon.png" alt="App icon" width="96"> The logo is the "M." mark; source `apps/desktop/resources/icon.svg` (regenerate PNG/ICO with `bun scripts/make-icons.mjs`).

<sub>Screenshots use a small fictional library generated for the demo.</sub>

## Audio formats
MP3, **FLAC**, OGG/Opus, WAV, M4A/AAC and WebM audio: the formats Chromium can decode. FLAC was verified on real files from a library
(duration, tags, playback and seeking). Files are streamed with HTTP Range support, so seeking works on large files too.

## Requirements
Bun ≥ 1.2 on Windows, macOS or Linux.

## Run
```bash
bun run start      # one command: installs deps + Electron binary if needed, then launches the app
```
`bun run dev` does the same without the first-run checks.

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
- Only English and Persian are translated; API error messages (e.g. validation) are still English.

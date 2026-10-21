# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. The number lives in `package.json` (bump it with
`bun scripts/bump-version.mjs patch|minor|major`), is shown in Settings → About, and each release is tagged `vX.Y.Z` on GitHub
with the installer attached.

## [0.2.0] - 2026-10-21

### Added
- Opening an audio file with the app (double-click, "Open with") plays it. The installer registers M. Player for mp3, flac, wav, ogg, opus, m4a and aac.
- Duplicate songs are hidden everywhere in the library (same file copied, or the same song ripped twice); the best copy stays. The Duplicates page still lists them.
- Installer offers to start with an empty library (old data is renamed to a backup, never deleted), so the app asks for your music folders on first start.
- Settings → About now shows the version.
- Crossfade is on by default (3 s) for the automatic change between songs.

### Changed
- Skipping with Next/Previous or choosing a song switches immediately; fades remain for play/pause and for the automatic end-of-track transition.
- The "M." logo in the sidebar uses a round dot like the app icon.
- Albums and artists grids only render what is on screen; covers are served as small thumbnails. Much lower memory use.

### Fixed
- A click/burst of noise when pausing (the fade gain was restored while the decoder still flushed its last samples).

## [0.1.0] - 2026-10-21

First public release: offline library (Persian/English, RTL), folders view, playlists, queue, equalizer, crossfade/gapless, sleep timer, lyrics, tag editing, mini player and tray, per-user installer wizard with hardened Electron build.

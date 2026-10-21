# ADR 0002 — Process model, IPC and local file playback

**Status:** accepted

## Process model
```
Electron main ──spawns──▶ Bun + Elysia API  (127.0.0.1:<random port>, per-launch bearer token)
      │  contextBridge (4 named members)
Renderer (Vue, sandboxed, no Node)  ──fetch + token──▶ API
      │  <audio src="mohhey-media://track/<id>">
Electron main protocol handler ──▶ looks up path via API ──▶ net.fetch(file://…)  (Range supported)
```
- The API is a **child process**, not in-process, so heavy scanning never blocks Electron's main thread.
- It binds to loopback only, on an OS-assigned port, and **every request needs the bearer token** (localhost is not a
  security boundary). The token is random per launch, passed via env, never logged or stored.
- CORS allows only the renderer's origin (`http://localhost:5173` in dev, `mohhey-app://renderer` in production).
- The API exits when Electron closes its stdin pipe, so no orphan processes remain.
- Production packaging expects a compiled binary at `resources/api/mohhey-api(.exe)` (`bun build --compile`). It is not
  wired to an installer yet (see README, "Known limitations").

## Electron hardening
`contextIsolation`, `sandbox`, no `nodeIntegration`; strict CSP (no remote origins, no `eval`); window-open denied;
navigation locked to the app origin; permission requests denied; IPC handlers verify the sender's origin; the preload
exposes exactly `getApiConfig`, `pickFolder`, `setTitleBarTheme`, `platform`.

Note: for custom schemes WHATWG `URL.origin` is the string `"null"`, so origins are compared as `protocol//host`
(`electron/main/policy.ts`, covered by tests). A naive `.origin` comparison would have rejected every IPC call in production.

## Local audio
- Playback runs in the renderer with a single `HTMLAudioElement` (one element means tracks can never overlap; Chromium
  decodes natively and streams via Range requests, so files are never read into memory).
- The renderer never sees file paths: it uses `mohhey-media://track/<numeric id>`; the main process resolves the path
  through the API. Artwork uses `mohhey-media://art/<sha1>.<ext>` with a strict filename allowlist.
- Supported extensions are those Chromium decodes: mp3, flac, ogg/oga, opus, wav, m4a, aac, weba. Decode errors surface
  as a message and the track is skipped; unreadable files are marked *missing*, never deleted.

# Security

M. Player is an offline desktop app. It has no accounts, telemetry, auto-update or outgoing network traffic. This page lists
what protects it and how each point was checked.

## Model

| Layer | Protection |
| --- | --- |
| Renderer | `contextIsolation`, `sandbox`, no Node integration, strict CSP, navigation / new-window lock, all permissions and devices denied |
| IPC | Small, validated surface; every call checks the sender's origin (`mohhey-app://renderer` or the dev server) |
| Local API | Child process on `127.0.0.1` (random port), `Host` must be loopback (anti DNS-rebinding), per-launch bearer token, CORS only for the app origins |
| Privileged routes | A second per-launch secret known only to the main process guards file paths and *adding library folders*; the renderer can only add a folder through the native dialog |
| Files | Music is only read, never modified or deleted; browsing is restricted to library folders; media is served through `mohhey-media://` with its own Range handling |
| Secrets | Tokens are random per launch, compared in constant time, never logged, never given to the renderer (internal one) |
| Packaged build | Electron fuses: no `RunAsNode`, no `NODE_OPTIONS`, no `--inspect`; app loads only from the integrity-checked `app.asar`; debug switches (`--remote-debugging-port`, …) are refused at startup |
| API binary | Compiled executable started with a minimal environment |
| Installer | Installs to Program Files (64-bit, one UAC prompt; the app itself runs unelevated), explicit step-by-step wizard, uninstall asks before touching library data and never touches music |

## Verification (re-run before a release)

```bash
bun test --cwd apps/api        # includes tests/security.test.ts (token levels, rebinding, traversal, SQL, limits)
bun run --cwd apps/desktop test
bun run typecheck
bun audit                      # only build-time transitive advisories are expected
bun run dist && node scripts/checksums.mjs
```

Release build checks done: fuse state read back from the packaged exe; flipping one byte in `app.asar` (header or code) stops the app
(`ASAR Integrity Violation`); the packaged API answers `401` without a token, `403` for a foreign `Host`; silent install and
uninstall in a temp folder leave no registry entry, and library data is kept.

## Known limits

- The installer and exe are **not code-signed**, so Windows SmartScreen warns. Verify downloads with the SHA-256 in `dist/SHA256SUMS.txt`.
- Anyone with write access to the install folder (or running as the same user) can replace files; the asar integrity fuse raises the bar
  but is not a defence against a local attacker with full user rights.
- The app cannot stop someone from copying their own installed copy; it has no licensing server by design.

Report issues privately to the repository owner.

// One command to run the whole app: `bun run start`
// 1) installs dependencies if missing, 2) makes sure Electron's binary is downloaded, 3) starts Electron + API.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

if (!existsSync(join(root, 'node_modules'))) {
  console.log('› Installing dependencies…')
  run('bun', ['install'])
}

// Bun skips Electron's postinstall unless trusted; download the binary on first run.
const bunStore = join(root, 'node_modules', '.bun')
const electronDir = existsSync(bunStore)
  ? readdirSync(bunStore).find((d) => d.startsWith('electron@'))
  : undefined
const pkg = electronDir ? join(bunStore, electronDir, 'node_modules', 'electron') : join(root, 'node_modules', 'electron')
if (existsSync(pkg) && !existsSync(join(pkg, 'dist'))) {
  console.log('› Downloading Electron (first run only)…')
  run('node', ['install.js'], pkg)
}

console.log('› Starting Mohhey Player…')
run('bun', ['run', '--cwd', 'apps/desktop', 'dev'])

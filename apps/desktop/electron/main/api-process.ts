import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app } from 'electron'

export interface ApiHandle {
  baseUrl: string
  token: string
  /** Second secret for routes only this process may call (file paths, adding folders). Never sent to the renderer. */
  internalToken: string
  stop(): void
}

const SAFE_ENV = ['PATH', 'SystemRoot', 'windir', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'LANG', 'TMPDIR']
const pick = (env: NodeJS.ProcessEnv, keys: string[]): NodeJS.ProcessEnv => Object.fromEntries(keys.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]))

const READY_PREFIX = 'MOHHEY_API_READY '
const STARTUP_TIMEOUT_MS = 15_000

function resolveCommand(): { cmd: string; args: string[]; cwd: string } {
  if (app.isPackaged) {
    // Production: a self-contained binary produced by `bun build --compile` and shipped in resources/api.
    const exe = join(process.resourcesPath, 'api', process.platform === 'win32' ? 'mohhey-api.exe' : 'mohhey-api')
    return { cmd: exe, args: [], cwd: process.resourcesPath }
  }
  const apiDir = resolve(app.getAppPath(), '../api')
  return { cmd: process.env.MOHHEY_BUN ?? 'bun', args: [join(apiDir, 'src', 'main.ts')], cwd: apiDir }
}

/** Starts the Elysia API as a child process on a random loopback port, protected by a per-launch token. */
export function startApi(allowedOrigins: string[]): Promise<ApiHandle> {
  const token = randomBytes(24).toString('hex')
  const internalToken = randomBytes(24).toString('hex')
  const { cmd, args, cwd } = resolveCommand()
  if (app.isPackaged && !existsSync(cmd)) throw new Error(`API binary not found at ${cmd}`)

  const child: ChildProcess = spawn(cmd, args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    // The packaged API gets a minimal environment: it needs no proxy settings, NODE_OPTIONS, credentials, etc.
    env: {
      ...(app.isPackaged ? pick(process.env, SAFE_ENV) : process.env),
      MOHHEY_API_TOKEN: token,
      MOHHEY_INTERNAL_TOKEN: internalToken,
      MOHHEY_API_PORT: '0',
      MOHHEY_DATA_DIR: join(app.getPath('userData'), 'data'),
      MOHHEY_ALLOWED_ORIGINS: allowedOrigins.join(','),
    },
  })

  return new Promise<ApiHandle>((resolvePromise, reject) => {
    let buffer = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('The library service did not start in time.')) }, STARTUP_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const line = buffer.split('\n').find((l) => l.startsWith(READY_PREFIX))
      if (!line) return
      clearTimeout(timer)
      const { port } = JSON.parse(line.slice(READY_PREFIX.length)) as { port: number }
      buffer = ''
      child.stdout?.removeAllListeners('data')
      child.stdout?.resume()
      resolvePromise({
        baseUrl: `http://127.0.0.1:${port}`,
        token,
        internalToken,
        stop: () => { child.stdin?.end(); setTimeout(() => child.kill(), 1500).unref() },
      })
    })
    child.stderr?.on('data', (c: Buffer) => process.stderr.write(`[api] ${c}`))
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`Could not start the library service: ${err.message}`)) })
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`The library service exited unexpectedly (code ${code}).`)) })
  })
}

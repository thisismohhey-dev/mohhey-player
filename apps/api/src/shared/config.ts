import { join, resolve } from 'node:path'

export interface Config {
  dataDir: string
  artworkDir: string
  dbPath: string
  port: number
  token: string
  allowedOrigins: string[]
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const dataDir = resolve(env.MOHHEY_DATA_DIR ?? './.data')
  const token = env.MOHHEY_API_TOKEN
  if (!token || token.length < 16) {
    throw new Error('MOHHEY_API_TOKEN must be provided (min 16 chars). Electron generates one per launch.')
  }
  return {
    dataDir,
    artworkDir: join(dataDir, 'artwork'),
    dbPath: join(dataDir, 'library.db'),
    port: Number(env.MOHHEY_API_PORT ?? 0),
    token,
    allowedOrigins: (env.MOHHEY_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  }
}

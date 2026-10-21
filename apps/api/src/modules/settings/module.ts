import { Elysia } from 'elysia'
import { AppSettingsPatchSchema, AppSettingsSchema, type AppSettings, type AppSettingsPatch } from '@mohhey/contracts'
import type { Db } from '../../shared/db'

export class SettingsRepo {
  constructor(private db: Db) {}

  get(): AppSettings {
    const rows = this.db.query<{ key: string; value: string }, []>('SELECT key, value FROM app_settings').all()
    const raw: Record<string, unknown> = {}
    for (const r of rows) {
      try { raw[r.key] = JSON.parse(r.value) } catch { /* ignore corrupt entry; default applies */ }
    }
    const parsed = AppSettingsSchema.safeParse(raw)
    return parsed.success ? parsed.data : AppSettingsSchema.parse({})
  }

  patch(patch: AppSettingsPatch): AppSettings {
    const up = this.db.query('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    this.db.transaction(() => {
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) up.run(k, JSON.stringify(v))
    })()
    return this.get()
  }
}

export const settingsRoutes = (repo: SettingsRepo) =>
  new Elysia({ name: 'settings', prefix: '/settings' })
    .get('/', () => repo.get())
    .patch('/', ({ body }) => repo.patch(body), { body: AppSettingsPatchSchema })

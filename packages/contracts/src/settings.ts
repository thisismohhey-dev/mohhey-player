import { z } from 'zod'

export const RepeatModeSchema = z.enum(['off', 'one', 'all'])
export type RepeatMode = z.infer<typeof RepeatModeSchema>

export const AppSettingsSchema = z.object({
  volume: z.number().min(0).max(1).default(0.8),
  muted: z.boolean().default(false),
  shuffle: z.boolean().default(false),
  repeat: RepeatModeSchema.default('off'),
  theme: z.enum(['light', 'dark', 'system']).default('light'),
  locale: z.enum(['en', 'fa']).default('en'),
  restoreQueue: z.boolean().default(true),
  recordHistory: z.boolean().default(true),
  queue: z.object({
    trackIds: z.array(z.number().int()).default([]),
    index: z.number().int().default(-1),
    positionMs: z.number().default(0),
  }).default({ trackIds: [], index: -1, positionMs: 0 }),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>
export const AppSettingsPatchSchema = AppSettingsSchema.partial()
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>

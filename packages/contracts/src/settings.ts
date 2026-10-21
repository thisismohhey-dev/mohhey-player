import { z } from 'zod'

export const RepeatModeSchema = z.enum(['off', 'one', 'all'])
export type RepeatMode = z.infer<typeof RepeatModeSchema>

const QueueSchema = z.object({
  trackIds: z.array(z.number().int()),
  index: z.number().int(),
  positionMs: z.number(),
})

/** Field shapes without defaults, shared by the full schema and the patch schema. */
const fields = {
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  shuffle: z.boolean(),
  repeat: RepeatModeSchema,
  theme: z.enum(['light', 'dark', 'system']),
  locale: z.enum(['en', 'fa']),
  restoreQueue: z.boolean(),
  recordHistory: z.boolean(),
  queue: QueueSchema,
}

export const AppSettingsSchema = z.object({
  volume: fields.volume.default(0.8),
  muted: fields.muted.default(false),
  shuffle: fields.shuffle.default(false),
  repeat: fields.repeat.default('off'),
  theme: fields.theme.default('light'),
  locale: fields.locale.default('en'),
  restoreQueue: fields.restoreQueue.default(true),
  recordHistory: fields.recordHistory.default(true),
  queue: fields.queue.default({ trackIds: [], index: -1, positionMs: 0 }),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>

/**
 * A patch must NOT carry defaults: with defaults, `PATCH {volume}` would be parsed into a full object and silently
 * reset every other setting (locale, theme, saved queue…) to its default.
 */
export const AppSettingsPatchSchema = z.object(fields).partial()
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>

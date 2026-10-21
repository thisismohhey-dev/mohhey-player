import { z } from 'zod'

export const RepeatModeSchema = z.enum(['off', 'one', 'all'])
export type RepeatMode = z.infer<typeof RepeatModeSchema>

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_PRESETS = ['flat', 'bass', 'treble', 'vocal', 'rock', 'pop', 'classical', 'speech', 'custom'] as const
export const EqSchema = z.object({
  enabled: z.boolean(),
  preset: z.enum(EQ_PRESETS),
  /** One gain (dB, -12..12) per band in EQ_BANDS. */
  gains: z.array(z.number().min(-12).max(12)).length(EQ_BANDS.length),
})
export type EqSettings = z.infer<typeof EqSchema>
export const FLAT_EQ: EqSettings = { enabled: false, preset: 'flat', gains: EQ_BANDS.map(() => 0) }

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
  playbackRate: z.number().min(0.5).max(3),
  normalize: z.boolean(),
  crossfadeSec: z.number().min(0).max(12),
  gapless: z.boolean(),
  eq: EqSchema,
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
  playbackRate: fields.playbackRate.default(1),
  normalize: fields.normalize.default(false),
  crossfadeSec: fields.crossfadeSec.default(0),
  gapless: fields.gapless.default(true),
  eq: fields.eq.default(FLAT_EQ),
})
export type AppSettings = z.infer<typeof AppSettingsSchema>

/**
 * A patch must NOT carry defaults: with defaults, `PATCH {volume}` would be parsed into a full object and silently
 * reset every other setting (locale, theme, saved queue…) to its default.
 */
export const AppSettingsPatchSchema = z.object(fields).partial()
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>

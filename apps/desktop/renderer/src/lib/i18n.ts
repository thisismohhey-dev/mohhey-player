import { en, type MessageKey } from '@/locales/en'

/** Single-locale today; `dir` is derived from the locale so RTL locales (fa) can be added by dropping in a dictionary. */
export const locale = 'en'
export const dir: 'ltr' | 'rtl' = 'ltr'

export function t(key: MessageKey): string {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], en) as string
}

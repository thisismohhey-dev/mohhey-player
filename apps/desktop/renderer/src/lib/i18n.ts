import { computed, ref } from 'vue'
import type { AppSettings } from '@mohhey/contracts'
import { en } from '@/locales/en'
import { fa } from '@/locales/fa'

export type Locale = AppSettings['locale']
export const locale = ref<Locale>('en')
export const dir = computed<'ltr' | 'rtl'>(() => (locale.value === 'fa' ? 'rtl' : 'ltr'))

const lookup = (tree: unknown, key: string): string | undefined => {
  let node = tree
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part]
    else return undefined
  }
  return typeof node === 'string' ? node : undefined
}

/**
 * Translates either a dictionary key (`t('nav.songs')`) or an English source string (`t('Play next')`).
 * `{name}` placeholders are filled from `params`. Unknown strings fall back to themselves.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const text = (locale.value === 'fa' ? (lookup(fa.tree, key) ?? fa.literals[key]) : undefined) ?? lookup(en, key) ?? key
  return params ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? '')) : text
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
/** Locale-aware digits for numbers and times (Persian digits in fa). */
export const digits = (s: string): string => (locale.value === 'fa' ? s.replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!) : s)
export const nf = (n: number): string => n.toLocaleString(locale.value === 'fa' ? 'fa-IR' : 'en-US')
export const nounFor = (noun: string): string | undefined => (locale.value === 'fa' ? fa.nouns[noun] : undefined)
export const dateLocale = (): string => (locale.value === 'fa' ? 'fa-IR' : 'en-US')

export function setLocale(next: Locale): void {
  locale.value = next
  document.documentElement.lang = next
  document.documentElement.dir = dir.value
}

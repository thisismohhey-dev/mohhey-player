import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { en } from '@/locales/en'
import { fa } from '@/locales/fa'
import { locale, t } from '@/lib/i18n'

const SRC = resolve(import.meta.dirname, '../renderer/src')

const flatten = (tree: unknown, prefix = ''): Record<string, string> =>
  Object.entries(tree as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === 'string') acc[prefix + k] = v
    else Object.assign(acc, flatten(v, `${prefix}${k}.`))
    return acc
  }, {})

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'ui' || e.name === 'locales' ? [] : walk(join(dir, e.name))) : /\.(vue|ts)$/.test(e.name) ? [join(dir, e.name)] : [])

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')

describe('Persian dictionary', () => {
  test('has every key of the English dictionary', () => {
    const enKeys = Object.keys(flatten(en))
    const faKeys = new Set(Object.keys(flatten(fa.tree)))
    expect(enKeys.filter((k) => !faKeys.has(k))).toEqual([])
  })

  test('keeps the same {placeholders} as the English text', () => {
    const e = flatten(en)
    const f = flatten(fa.tree)
    for (const k of Object.keys(e)) expect(placeholders(f[k]!), k).toBe(placeholders(e[k]!))
    for (const [english, persian] of Object.entries(fa.literals)) expect(placeholders(persian), english).toBe(placeholders(english))
  })

  test('every English string passed to t() in the app has a Persian translation', () => {
    const used = new Set<string>()
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\bt\(\s*(?:[\w.?!&|() ]+\?\s*)?'((?:[^'\\]|\\.)*)'(?:\s*:\s*'((?:[^'\\]|\\.)*)')?/g)) {
        used.add(m[1]!.replace(/\\'/g, "'"))
        if (m[2]) used.add(m[2].replace(/\\'/g, "'"))
      }
    }
    const keyed = new Set(Object.keys(flatten(en)))
    const missing = [...used].filter((k) => !keyed.has(k) && !(k in fa.literals))
    expect(missing).toEqual([])
  })

  test('t() switches language, fills placeholders and falls back to English', () => {
    locale.value = 'fa'
    expect(t('nav.songs')).toBe('آهنگ‌ها')
    expect(t('Added to {name}', { name: 'Focus' })).toBe('به «Focus» اضافه شد')
    expect(t('A string nobody translated')).toBe('A string nobody translated')
    locale.value = 'en'
    expect(t('nav.songs')).toBe('Songs')
  })
})

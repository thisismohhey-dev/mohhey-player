import type { Lyrics } from '@mohhey/contracts'

export interface ParsedLyrics { synced: boolean; lines: Lyrics['lines'] }

const TIME = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const META_TAG = /^\[[a-zA-Z]{2,}:[^\]]*\]$/

/** Parses LRC text: `[mm:ss.xx]line`, several time tags per line allowed; metadata tags like `[ti:...]` are ignored. */
export function parseLrc(text: string): ParsedLyrics {
  const timed: { timeMs: number; text: string }[] = []
  const plain: string[] = []
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || META_TAG.test(line)) continue
    const stamps = [...line.matchAll(TIME)]
    if (!stamps.length) { plain.push(line); continue }
    const content = line.replace(TIME, '').trim()
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3].padEnd(3, '0').slice(0, 3)) : 0
      timed.push({ timeMs: Number(m[1]) * 60_000 + Number(m[2]) * 1000 + frac, text: content })
    }
  }
  if (timed.length) return { synced: true, lines: timed.sort((a, b) => a.timeMs - b.timeMs) }
  return { synced: false, lines: plain.map((t) => ({ timeMs: null, text: t })) }
}

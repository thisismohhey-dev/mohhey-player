import { digits, locale, nf, nounFor } from './i18n'

/** m:ss or h:mm:ss, always the same shape so numbers don't jump around. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return digits(h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`)
}

/** "1 hr 20 min" / "42 min" for collection summaries. */
export function formatLong(ms: number): string {
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (locale.value === 'fa') {
    if (h === 0) return `${nf(m)} دقیقه`
    return m === 0 ? `${nf(h)} ساعت` : `${nf(h)} ساعت و ${nf(m)} دقیقه`
  }
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export const plural = (n: number, one: string, many = `${one}s`) => {
  const fa = nounFor(one)
  if (fa) return `${nf(n)} ${fa}`
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (locale.value === 'fa') return h < 5 ? 'هنوز بیداری؟' : h < 12 ? 'صبح بخیر' : h < 17 ? 'بعدازظهر بخیر' : h < 20 ? 'عصر بخیر' : 'شب بخیر'
  if (h < 5) return 'Still up?'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Deterministic hue so a given album/artist always gets the same placeholder colour. */
export function hueFor(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

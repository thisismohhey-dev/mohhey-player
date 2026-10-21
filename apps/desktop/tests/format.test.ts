import { describe, expect, test } from 'vitest'
import { formatLong, formatTime, plural } from '@/lib/format'

describe('format', () => {
  test('formatTime', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(61_500)).toBe('1:01')
    expect(formatTime(3_600_000)).toBe('1:00:00')
    expect(formatTime(-5)).toBe('0:00')
  })
  test('formatLong / plural', () => {
    expect(formatLong(42 * 60_000)).toBe('42 min')
    expect(formatLong(80 * 60_000)).toBe('1 hr 20 min')
    expect(plural(1, 'song')).toBe('1 song')
    expect(plural(1200, 'song')).toBe('1,200 songs')
  })
})

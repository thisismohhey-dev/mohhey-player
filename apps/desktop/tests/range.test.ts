import { describe, expect, test } from 'vitest'
import { audioMime, parseRange } from '../electron/main/policy'

describe('parseRange', () => {
  const size = 1000
  test('no or malformed header means a full response', () => {
    expect(parseRange(null, size)).toBeNull()
    expect(parseRange('', size)).toBeNull()
    expect(parseRange('items=0-5', size)).toBeNull()
    expect(parseRange('bytes=-', size)).toBeNull()
    expect(parseRange('bytes=0-5,10-20', size)).toBeNull()
  })
  test('open-ended, bounded and suffix ranges', () => {
    expect(parseRange('bytes=0-', size)).toEqual({ start: 0, end: 999 })
    expect(parseRange('bytes=100-199', size)).toEqual({ start: 100, end: 199 })
    expect(parseRange('bytes=900-5000', size)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-100', size)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-5000', size)).toEqual({ start: 0, end: 999 })
  })
  test('ranges outside the file are unsatisfiable', () => {
    expect(parseRange('bytes=1000-', size)).toBe('unsatisfiable')
    expect(parseRange('bytes=500-100', size)).toBe('unsatisfiable')
    expect(parseRange('bytes=-0', size)).toBe('unsatisfiable')
  })
})

test('audioMime', () => {
  expect(audioMime('.MP3')).toBe('audio/mpeg')
  expect(audioMime('.xyz')).toBe('application/octet-stream')
})

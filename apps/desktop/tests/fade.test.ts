import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AudioEngine } from '@/lib/player/engine'

/** Minimal stand-in for HTMLAudioElement: the engine only needs volume + event registration for these tests. */
const fakeAudio = () => ({ volume: 1, muted: false, paused: false, ended: false, preload: '', addEventListener: () => undefined, getAttribute: () => 'x' }) as unknown as HTMLAudioElement
const noop = { status: () => undefined, time: () => undefined, ended: () => undefined, error: () => undefined }

describe('AudioEngine fades', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  test('fades the element volume to zero and back to the user volume', async () => {
    const audio = fakeAudio()
    const engine = new AudioEngine(noop, { decks: [audio, fakeAudio()], useGraph: false })
    engine.setVolume(0.8)
    expect(audio.volume).toBeCloseTo(0.8)

    const out = engine.fade(0, 200)
    await vi.advanceTimersByTimeAsync(100)
    expect(audio.volume).toBeLessThan(0.8)
    expect(audio.volume).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(await out).toBe(true)
    expect(audio.volume).toBe(0)

    const back = engine.fade(1, 300)
    await vi.advanceTimersByTimeAsync(400)
    expect(await back).toBe(true)
    expect(audio.volume).toBeCloseTo(0.8)
  })

  test('a newer fade or setGain cancels the running one', async () => {
    const engine = new AudioEngine(noop, { decks: [fakeAudio(), fakeAudio()], useGraph: false })
    const first = engine.fade(0, 500)
    await vi.advanceTimersByTimeAsync(50)
    engine.setGain(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(await first).toBe(false)
  })

  test('user volume changes keep the current fade position', async () => {
    const audio = fakeAudio()
    const engine = new AudioEngine(noop, { decks: [audio, fakeAudio()], useGraph: false })
    engine.setGain(0)
    engine.setVolume(0.5)
    expect(audio.volume).toBe(0)
    engine.setGain(1)
    expect(audio.volume).toBeCloseTo(0.5)
  })
})

import { AudioGraph } from './graph'

export type EngineStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error'

export interface EngineEvents {
  status(status: EngineStatus): void
  time(positionMs: number, durationMs: number): void
  ended(): void
  error(message: string): void
}

export interface EngineOptions {
  /** Inject the two <audio> elements (tests). */
  decks?: [HTMLAudioElement, HTMLAudioElement]
  /** Use the Web Audio graph (EQ, loudness boost, crossfade levels). Defaults to "when the browser has AudioContext". */
  useGraph?: boolean
}

const MEDIA_ERRORS: Record<number, string> = {
  1: 'Playback was cancelled.',
  2: 'The file could not be read. It may have been moved or the drive is disconnected.',
  3: 'This file could not be decoded. It may be corrupted.',
  4: 'This audio format is not supported or the file is missing.',
}

interface Deck {
  audio: HTMLAudioElement
  /** Crossfade level of this deck (0..1). */
  level: number
  /** Linear loudness correction for the track on this deck. */
  trackGain: number
  pendingStartMs: number
  autoplay: boolean
  preloaded: string | null
}

const dbToLinear = (db: number | null): number => (db === null ? 1 : Math.min(4, Math.max(0.1, 10 ** (db / 20))))

/**
 * Two <audio> decks behind one interface: normally one is active (so tracks never overlap), the other is used to
 * preload the next track (gapless) or to overlap it with the ending one (crossfade).
 */
export class AudioEngine {
  private decks: [Deck, Deck]
  private active = 0
  private graph: AudioGraph | null = null
  private userVolume = 1
  private muted = false
  /** Transient master fade used by skip/pause transitions (squared for a natural-sounding ramp). */
  private gain = 1
  private fadeId = 0
  private rampIds = [0, 0]
  private rate = 1
  private eq: { enabled: boolean; gains: readonly number[] } = { enabled: false, gains: [] }

  constructor(private events: EngineEvents, opts: EngineOptions = {}) {
    const audios = opts.decks ?? ([new Audio(), new Audio()] as [HTMLAudioElement, HTMLAudioElement])
    const useGraph = opts.useGraph ?? typeof AudioContext !== 'undefined'
    this.decks = audios.map((audio) => ({ audio, level: 1, trackGain: 1, pendingStartMs: 0, autoplay: false, preloaded: null })) as [Deck, Deck]
    this.decks.forEach((deck) => this.wire(deck))
    if (useGraph) {
      try { this.graph = new AudioGraph(audios) } catch { this.graph = null } // fall back to element volume
    }
    this.applyAll()
  }

  private get deck(): Deck { return this.decks[this.active]! }
  private get standby(): Deck { return this.decks[1 - this.active]! }

  private wire(deck: Deck): void {
    const { audio } = deck
    audio.preload = 'auto'
    // Required so the Web Audio graph may read the samples (the media scheme answers with CORS headers).
    audio.crossOrigin = 'anonymous'
    const on = (type: string, fn: () => void) => audio.addEventListener(type, () => { if (this.deck === deck) fn() })
    on('loadstart', () => this.events.status('loading'))
    audio.addEventListener('loadedmetadata', () => {
      if (deck.pendingStartMs > 0) { audio.currentTime = deck.pendingStartMs / 1000; deck.pendingStartMs = 0 }
      if (this.deck === deck) this.emitTime()
    })
    on('canplay', () => { if (!deck.autoplay && audio.paused) this.events.status('paused') })
    on('playing', () => this.events.status('playing'))
    on('pause', () => { if (!audio.ended && audio.src) this.events.status('paused') })
    on('waiting', () => this.events.status('buffering'))
    on('timeupdate', () => this.emitTime())
    on('durationchange', () => this.emitTime())
    on('ended', () => this.events.ended())
    audio.addEventListener('error', () => {
      if (this.deck !== deck || !audio.getAttribute('src')) return
      this.events.status('error')
      this.events.error(MEDIA_ERRORS[audio.error?.code ?? 4] ?? MEDIA_ERRORS[4]!)
    })
  }

  private emitTime(): void {
    const d = this.deck.audio.duration
    this.events.time(Math.round(this.deck.audio.currentTime * 1000), Number.isFinite(d) ? Math.round(d * 1000) : 0)
  }

  // ── volume model ───────────────────────────────────────────
  private masterValue(): number { return this.muted ? 0 : this.userVolume * this.gain * this.gain }

  private applyDeck(index: number, smoothMs = 0): void {
    const deck = this.decks[index]!
    if (this.graph) this.graph.setDeckGain(index, deck.level * deck.trackGain, smoothMs)
    // Without the graph the element can only attenuate.
    else deck.audio.volume = Math.min(1, this.masterValue() * deck.level * Math.min(1, deck.trackGain))
  }

  private applyAll(): void {
    if (this.graph) { this.graph.setMaster(this.masterValue()); this.graph.setEq(this.eq.enabled, this.eq.gains) }
    this.decks.forEach((_, i) => this.applyDeck(i))
  }

  setVolume(v: number): void { this.userVolume = Math.max(0, Math.min(1, v)); this.applyAll() }
  setMuted(m: boolean): void { this.muted = m; this.applyAll() }

  /** Jumps the fade gain immediately (cancels a running fade). */
  setGain(g: number): void { this.fadeId++; this.gain = Math.max(0, Math.min(1, g)); this.applyAll() }

  /**
   * Ramps the master fade to `target` over `ms`. A newer fade (or setGain) cancels this one; the promise
   * resolves either way, with `true` only when this fade ran to completion.
   */
  fade(target: number, ms: number): Promise<boolean> {
    const id = ++this.fadeId
    const from = this.gain
    const start = performance.now()
    return new Promise((resolve) => {
      const step = (now: number): void => {
        if (id !== this.fadeId) return resolve(false)
        const p = ms <= 0 ? 1 : Math.min(1, (now - start) / ms)
        this.gain = from + (target - from) * p
        this.applyAll()
        if (p < 1) setTimeout(() => step(performance.now()), 16)
        else resolve(true)
      }
      // setTimeout rather than requestAnimationFrame: rAF stops entirely while the window is minimised or hidden.
      setTimeout(() => step(performance.now()), 0)
    })
  }

  private rampDeck(index: number, to: number, ms: number): Promise<void> {
    const id = ++this.rampIds[index]!
    const deck = this.decks[index]!
    const from = deck.level
    const start = performance.now()
    return new Promise((resolve) => {
      const step = (now: number): void => {
        if (id !== this.rampIds[index]) return resolve()
        const p = ms <= 0 ? 1 : Math.min(1, (now - start) / ms)
        // Equal-power curves keep the perceived loudness steady through the overlap.
        deck.level = to >= from ? Math.sin((p * Math.PI) / 2) * (to - from) + from : Math.cos((p * Math.PI) / 2) * (from - to) + to
        this.applyDeck(index)
        if (p < 1) setTimeout(() => step(performance.now()), 16)
        else resolve()
      }
      setTimeout(() => step(performance.now()), 0)
    })
  }

  // ── loudness, EQ, rate ─────────────────────────────────────
  /** Loudness correction for the track on the active deck (smoothed), or for the track about to start. */
  setTrackGainDb(db: number | null, smooth = true): void {
    this.deck.trackGain = dbToLinear(db)
    this.applyDeck(this.active, smooth ? 600 : 0)
  }

  setEq(enabled: boolean, gains: readonly number[]): void {
    this.eq = { enabled, gains }
    this.graph?.setEq(enabled, gains)
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(3, rate))
    for (const d of this.decks) { d.audio.defaultPlaybackRate = this.rate; d.audio.playbackRate = this.rate; d.audio.preservesPitch = true }
  }

  /** RMS level (dBFS) of what is currently playing, or null without a graph. */
  levelDb(output = false): number | null { return this.graph ? this.graph.rmsDb(output) : null }

  /** Diagnostics for tests and bug reports. */
  debugState(): { active: number; hasGraph: boolean; preloaded: string | null; decks: { level: number; trackGain: number; playing: boolean }[]; graph: ReturnType<AudioGraph['debug']> | null } {
    return {
      active: this.active, hasGraph: this.graph !== null, preloaded: this.standby.preloaded,
      decks: this.decks.map((d) => ({ level: +d.level.toFixed(3), trackGain: +d.trackGain.toFixed(3), playing: !d.audio.paused })),
      graph: this.graph?.debug() ?? null,
    }
  }
  get hasGraph(): boolean { return this.graph !== null }

  // ── loading and transport ──────────────────────────────────
  private resetDeck(deck: Deck, index: number): void {
    deck.audio.pause()
    deck.audio.removeAttribute('src')
    deck.audio.load()
    deck.preloaded = null
    deck.level = 1
    deck.trackGain = 1
    deck.pendingStartMs = 0
    this.rampIds[index] = (this.rampIds[index] ?? 0) + 1
  }

  /** Loads a source on the active deck; optionally starts at `startMs` and begins playing. */
  load(src: string, opts: { play: boolean; startMs?: number; gainDb?: number | null }): void {
    const startMs = opts.startMs ?? 0
    const standbyIndex = 1 - this.active
    // A track preloaded for gapless playback starts instantly.
    if (this.standby.preloaded === src && startMs === 0) {
      const old = this.active
      this.active = standbyIndex
      this.resetDeck(this.decks[old]!, old)
      const deck = this.deck
      deck.preloaded = null
      deck.level = 1
      deck.autoplay = opts.play
      deck.trackGain = dbToLinear(opts.gainDb ?? null)
      this.applyAll()
      this.events.status('loading')
      this.emitTime()
      if (opts.play) void this.play()
      return
    }
    this.resetDeck(this.standby, standbyIndex)
    this.rampIds[this.active] = (this.rampIds[this.active] ?? 0) + 1 // cancel a crossfade that was still running
    const deck = this.deck
    deck.autoplay = opts.play
    deck.pendingStartMs = startMs
    deck.level = 1
    deck.trackGain = dbToLinear(opts.gainDb ?? null)
    deck.audio.src = src
    this.setRate(this.rate)
    this.applyAll()
    deck.audio.load()
    this.events.status('loading')
    if (opts.play) void this.play()
  }

  /** Starts buffering the next track on the standby deck so it can begin without a gap. */
  preload(src: string): void {
    const deck = this.standby
    if (deck.preloaded === src) return
    deck.audio.src = src
    deck.preloaded = src
    deck.autoplay = false
    deck.audio.load()
  }

  get preloadedSrc(): string | null { return this.standby.preloaded }

  /** Starts `src` on the standby deck and overlaps it with the current track over `ms`. */
  crossfadeTo(src: string, ms: number, opts: { gainDb?: number | null } = {}): void {
    const oldIndex = this.active
    const newIndex = 1 - oldIndex
    const old = this.decks[oldIndex]!
    const nu = this.decks[newIndex]!
    if (nu.preloaded !== src) { this.resetDeck(nu, newIndex); nu.audio.src = src }
    nu.preloaded = null
    nu.autoplay = true
    nu.pendingStartMs = 0
    nu.level = 0
    nu.trackGain = dbToLinear(opts.gainDb ?? null)
    this.active = newIndex // time/status now follow the new track
    this.setRate(this.rate)
    this.applyAll()
    if (nu.audio.readyState === 0) nu.audio.load()
    this.events.status('loading')
    this.emitTime()
    void this.play()
    void this.rampDeck(newIndex, 1, ms)
    void this.rampDeck(oldIndex, 0, ms).then(() => {
      if (this.active !== newIndex) return
      this.resetDeck(old, oldIndex)
      this.applyDeck(oldIndex)
    })
  }

  /**
   * Starts the active deck. The master fade gain is reset to full unless `keepGain` is set (resume fades up from silence):
   * after a pause the gain deliberately stays at 0, because the element still flushes a few ms of buffered audio
   * and restoring the gain at that moment is audible as a click.
   */
  async play(keepGain = false): Promise<void> {
    if (!keepGain) this.setGain(1)
    try {
      await this.graph?.resume()
      await this.deck.audio.play()
    } catch (e) {
      // AbortError happens when a new load interrupts play(); the new load reports its own state.
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'NotSupportedError') return // the error event reports it
      throw e
    }
  }

  /** Pauses both decks. Call after fading to silence; the fade gain is left at 0 on purpose (see play()). */
  pause(): void { for (const d of this.decks) d.audio.pause() }

  seek(ms: number): void {
    const audio = this.deck.audio
    const d = audio.duration
    const max = Number.isFinite(d) ? d : Infinity
    audio.currentTime = Math.max(0, Math.min(ms / 1000, max))
  }

  restart(): void { this.deck.audio.currentTime = 0; void this.play() }
  get positionMs(): number { return Math.round(this.deck.audio.currentTime * 1000) }
  get durationMs(): number { const d = this.deck.audio.duration; return Number.isFinite(d) ? Math.round(d * 1000) : 0 }

  /** True while sound is actually being produced. */
  get isAudible(): boolean { const a = this.deck.audio; return !a.paused && !a.ended && this.hasSource }
  get isPaused(): boolean { return this.deck.audio.paused }
  get hasSource(): boolean { return !!this.deck.audio.getAttribute('src') }

  unload(): void {
    this.decks.forEach((d, i) => this.resetDeck(d, i))
    this.events.status('idle')
    this.events.time(0, 0)
  }
}

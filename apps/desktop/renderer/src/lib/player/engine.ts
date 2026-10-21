export type EngineStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error'

export interface EngineEvents {
  status(status: EngineStatus): void
  time(positionMs: number, durationMs: number): void
  ended(): void
  error(message: string): void
}

const MEDIA_ERRORS: Record<number, string> = {
  1: 'Playback was cancelled.',
  2: 'The file could not be read. It may have been moved or the drive is disconnected.',
  3: 'This file could not be decoded. It may be corrupted.',
  4: 'This audio format is not supported or the file is missing.',
}

/** Thin wrapper over one HTMLAudioElement. Exactly one element exists, so tracks can never overlap. */
export class AudioEngine {
  private audio: HTMLAudioElement
  private pendingStartMs = 0
  private autoplay = false

  constructor(private events: EngineEvents, audio: HTMLAudioElement = new Audio()) {
    this.audio = audio
    audio.preload = 'auto'
    audio.addEventListener('loadstart', () => this.events.status('loading'))
    audio.addEventListener('loadedmetadata', () => {
      if (this.pendingStartMs > 0) { audio.currentTime = this.pendingStartMs / 1000; this.pendingStartMs = 0 }
      this.emitTime()
    })
    audio.addEventListener('canplay', () => { if (!this.autoplay && audio.paused) this.events.status('paused') })
    audio.addEventListener('playing', () => this.events.status('playing'))
    audio.addEventListener('pause', () => { if (!audio.ended && audio.src) this.events.status('paused') })
    audio.addEventListener('waiting', () => this.events.status('buffering'))
    audio.addEventListener('timeupdate', () => this.emitTime())
    audio.addEventListener('durationchange', () => this.emitTime())
    audio.addEventListener('ended', () => this.events.ended())
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return
      this.events.status('error')
      this.events.error(MEDIA_ERRORS[audio.error?.code ?? 4] ?? MEDIA_ERRORS[4]!)
    })
  }

  private emitTime(): void {
    const d = this.audio.duration
    this.events.time(Math.round(this.audio.currentTime * 1000), Number.isFinite(d) ? Math.round(d * 1000) : 0)
  }

  /** Loads a source; optionally starts at `startMs` and begins playing. */
  load(src: string, opts: { play: boolean; startMs?: number }): void {
    this.autoplay = opts.play
    this.pendingStartMs = opts.startMs ?? 0
    this.audio.src = src
    this.audio.load()
    this.events.status('loading')
    if (opts.play) void this.play()
  }

  async play(): Promise<void> {
    try { await this.audio.play() } catch (e) {
      // AbortError happens when a new load interrupts play(); the new load reports its own state.
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'NotSupportedError') return // the error event reports it
      throw e
    }
  }

  pause(): void { this.audio.pause() }
  seek(ms: number): void {
    const d = this.audio.duration
    const max = Number.isFinite(d) ? d : Infinity
    this.audio.currentTime = Math.max(0, Math.min(ms / 1000, max))
  }
  restart(): void { this.audio.currentTime = 0; void this.play() }
  setVolume(v: number): void { this.audio.volume = Math.max(0, Math.min(1, v)) }
  setMuted(m: boolean): void { this.audio.muted = m }
  get isPaused(): boolean { return this.audio.paused }
  get hasSource(): boolean { return !!this.audio.getAttribute('src') }

  unload(): void {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.events.status('idle')
    this.events.time(0, 0)
  }
}

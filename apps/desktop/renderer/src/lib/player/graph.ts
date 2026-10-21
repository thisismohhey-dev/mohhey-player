import { EQ_BANDS } from '@mohhey/contracts'

/**
 * Web Audio graph shared by both decks:
 *   deck element → deck gain (crossfade × loudness correction) ┐
 *                                                               ├→ 10-band EQ → limiter → master (volume, fades) → speakers
 *   deck element → analyser (measures the raw track loudness)   ┘
 * Needs CORS-enabled media (the mohhey-media scheme is registered with corsEnabled), otherwise the element would output silence.
 */
export class AudioGraph {
  readonly ctx: AudioContext
  private readonly deckGains: GainNode[]
  private readonly filters: BiquadFilterNode[]
  private readonly master: GainNode
  private readonly analyser: AnalyserNode
  /** Taps the signal after EQ + limiter (what you actually hear, before the master volume). */
  private readonly outAnalyser: AnalyserNode
  private readonly samples: Float32Array<ArrayBuffer>

  constructor(audios: HTMLAudioElement[]) {
    this.ctx = new AudioContext({ latencyHint: 'playback' })
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.samples = new Float32Array(this.analyser.fftSize)
    this.outAnalyser = this.ctx.createAnalyser()
    this.outAnalyser.fftSize = 2048

    this.filters = EQ_BANDS.map((freq, i) => {
      const f = this.ctx.createBiquadFilter()
      f.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
      f.frequency.value = freq
      f.Q.value = 1.0
      f.gain.value = 0
      return f
    })
    this.filters.forEach((f, i) => { if (i > 0) this.filters[i - 1]!.connect(f) })

    // Soft limiter so loudness boosts and EQ gains cannot clip.
    const limiter = this.ctx.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 6
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.12
    this.master = this.ctx.createGain()
    this.filters[this.filters.length - 1]!.connect(limiter)
    limiter.connect(this.master)
    limiter.connect(this.outAnalyser)
    this.master.connect(this.ctx.destination)

    this.deckGains = audios.map((audio) => {
      const source = this.ctx.createMediaElementSource(audio)
      const gain = this.ctx.createGain()
      source.connect(gain)
      source.connect(this.analyser)
      gain.connect(this.filters[0]!)
      return gain
    })
  }

  resume(): Promise<void> { return this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume() }

  /** Test/diagnostic snapshot of the graph. */
  debug(): { eqGains: number[]; deckGains: number[]; master: number } {
    return { eqGains: this.filters.map((f) => +f.gain.value.toFixed(2)), deckGains: this.deckGains.map((g) => +g.gain.value.toFixed(3)), master: +this.master.gain.value.toFixed(3) }
  }

  setMaster(value: number): void { this.master.gain.value = value }

  /** Smoothly moves a deck's gain (use `smoothMs = 0` for an immediate change). */
  setDeckGain(deck: number, value: number, smoothMs = 0): void {
    const p = this.deckGains[deck]!.gain
    p.cancelScheduledValues(this.ctx.currentTime)
    if (smoothMs <= 0) p.value = value
    else p.setTargetAtTime(value, this.ctx.currentTime, smoothMs / 3000)
  }

  setEq(enabled: boolean, gains: readonly number[]): void {
    this.filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? (gains[i] ?? 0) : 0, this.ctx.currentTime, 0.03))
  }

  /** RMS level of the audio currently playing, in dBFS (−Infinity when silent). */
  rmsDb(output = false): number {
    ;(output ? this.outAnalyser : this.analyser).getFloatTimeDomainData(this.samples)
    let sum = 0
    for (const v of this.samples) sum += v * v
    return 10 * Math.log10(sum / this.samples.length)
  }
}

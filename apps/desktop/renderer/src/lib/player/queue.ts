import type { RepeatMode, Track } from '@mohhey/contracts'

export interface QueueEntry { uid: number; track: Track }

export type Advance = { kind: 'play'; entry: QueueEntry } | { kind: 'end' }

/**
 * Pure play-queue model. `order` is the order in which tracks will be played (shuffled when shuffle is on);
 * `original` is the user-facing order restored when shuffle is turned off. The same track may appear more than once.
 */
export class PlayQueue {
  private original: QueueEntry[] = []
  private order: QueueEntry[] = []
  private pos = -1
  private nextUid = 1
  shuffle = false
  repeat: RepeatMode = 'off'

  constructor(private random: () => number = Math.random) {}

  get entries(): readonly QueueEntry[] { return this.order }
  get position(): number { return this.pos }
  get current(): QueueEntry | null { return this.order[this.pos] ?? null }
  get length(): number { return this.order.length }

  private wrap = (track: Track): QueueEntry => ({ uid: this.nextUid++, track })

  private shuffled<T>(items: T[]): T[] {
    const a = [...items]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }

  /** Replaces the queue. With shuffle on, the chosen start track is played first. */
  set(tracks: Track[], startIndex = 0): QueueEntry | null {
    this.original = tracks.map(this.wrap)
    const start = this.original[startIndex] ?? this.original[0]
    if (!start) { this.order = []; this.pos = -1; return null }
    if (this.shuffle) {
      this.order = [start, ...this.shuffled(this.original.filter((e) => e !== start))]
      this.pos = 0
    } else {
      this.order = [...this.original]
      this.pos = this.order.indexOf(start)
    }
    return start
  }

  /** Restores a saved queue without starting playback semantics (current is positioned, not played). */
  restore(tracks: Track[], index: number): void {
    this.original = tracks.map(this.wrap)
    this.order = [...this.original]
    this.pos = this.order[index] ? index : tracks.length ? 0 : -1
  }

  jumpTo(position: number): QueueEntry | null {
    if (!this.order[position]) return null
    this.pos = position
    return this.order[position]!
  }

  setShuffle(on: boolean): void {
    if (on === this.shuffle) return
    this.shuffle = on
    const cur = this.current
    if (!cur) return
    if (on) {
      this.order = [cur, ...this.shuffled(this.order.filter((e) => e !== cur))]
      this.pos = 0
    } else {
      const present = new Set(this.order)
      this.order = this.original.filter((e) => present.has(e))
      this.pos = this.order.indexOf(cur)
    }
  }

  /** `auto` is true when a track ended naturally (repeat-one replays), false for the user pressing next. */
  next(auto: boolean): Advance {
    const cur = this.current
    if (!cur) return { kind: 'end' }
    if (auto && this.repeat === 'one') return { kind: 'play', entry: cur }
    if (this.pos + 1 < this.order.length) {
      this.pos++
      return { kind: 'play', entry: this.order[this.pos]! }
    }
    if (this.repeat === 'all' || (!auto && this.repeat === 'one')) {
      if (this.shuffle && this.order.length > 1) {
        const last = this.order[this.order.length - 1]!
        let reshuffled = this.shuffled(this.order)
        // Avoid replaying the same track back-to-back at the loop boundary.
        if (reshuffled[0] === last) reshuffled = [...reshuffled.slice(1), last]
        this.order = reshuffled
      }
      this.pos = 0
      return { kind: 'play', entry: this.order[0]! }
    }
    return { kind: 'end' }
  }

  /** Returns the entry to play, or the current one when already at the start (caller restarts it). */
  previous(): QueueEntry | null {
    if (!this.current) return null
    if (this.pos > 0) { this.pos--; return this.order[this.pos]! }
    if (this.repeat === 'all' && this.order.length > 1) { this.pos = this.order.length - 1; return this.order[this.pos]! }
    return this.current
  }

  add(tracks: Track[], where: 'next' | 'end'): void {
    const entries = tracks.map(this.wrap)
    if (!entries.length) return
    if (where === 'end' || this.pos < 0) {
      this.order.push(...entries)
      this.original.push(...entries)
      if (this.pos < 0) this.pos = 0
      return
    }
    this.order.splice(this.pos + 1, 0, ...entries)
    const cur = this.current!
    const at = this.original.indexOf(cur)
    this.original.splice(at + 1, 0, ...entries)
  }

  /** Removes the entry at `position` in play order. Returns whether the current entry was removed. */
  remove(position: number): { removedCurrent: boolean } {
    const entry = this.order[position]
    if (!entry) return { removedCurrent: false }
    this.order.splice(position, 1)
    this.original = this.original.filter((e) => e !== entry)
    const removedCurrent = position === this.pos
    if (position < this.pos) this.pos--
    if (this.pos >= this.order.length) this.pos = this.order.length - 1
    return { removedCurrent }
  }

  move(from: number, to: number): void {
    if (!this.order[from] || to < 0 || to >= this.order.length || from === to) return
    const cur = this.current
    const [entry] = this.order.splice(from, 1)
    this.order.splice(to, 0, entry!)
    this.pos = this.order.indexOf(cur!)
    if (!this.shuffle) this.original = [...this.order]
  }

  /** Clears everything except the current track. */
  clearUpcoming(): void {
    const cur = this.current
    this.order = cur ? [cur] : []
    this.original = cur ? [cur] : []
    this.pos = cur ? 0 : -1
  }

  clear(): void {
    this.order = []
    this.original = []
    this.pos = -1
  }

  /** Updates cached track data (e.g. favorite flag) for all entries of a track. */
  patchTrack(id: number, patch: Partial<Track>): void {
    for (const e of this.original) if (e.track.id === id) e.track = { ...e.track, ...patch }
  }
}

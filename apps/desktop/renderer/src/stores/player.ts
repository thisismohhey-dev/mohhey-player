import { t } from '@/lib/i18n'
import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, triggerRef } from 'vue'
import type { RepeatMode, Track } from '@mohhey/contracts'
import { api, artUrl, trackUrl } from '@/lib/api'
import { AudioEngine, type EngineStatus } from '@/lib/player/engine'
import { PlayQueue } from '@/lib/player/queue'
import { useUiStore } from './ui'

const HISTORY_MIN_MS = 30_000
const FADE_OUT_MS = 220
const FADE_IN_MS = 380
const PAUSE_FADE_MS = 140
const RESUME_FADE_MS = 200
const PERSIST_DEBOUNCE_MS = 600
const POSITION_PERSIST_MS = 5_000

export const usePlayerStore = defineStore('player', () => {
  const ui = useUiStore()
  const queue = markRaw(new PlayQueue())
  const queueVersion = shallowRef(0)
  const touchQueue = () => { queueVersion.value++; triggerRef(queueVersion) }

  const status = ref<EngineStatus>('idle')
  const positionMs = ref(0)
  const durationMs = ref(0)
  const volume = ref(0.8)
  const muted = ref(false)
  const shuffle = ref(false)
  const repeat = ref<RepeatMode>('off')
  const errorMessage = ref<string | null>(null)
  const current = shallowRef<Track | null>(null)
  const ready = ref(false)

  let historyCounted = false
  let consecutiveFailures = 0
  let lastPositionPersist = 0
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let restoreRecordHistory = true

  const engine = markRaw(new AudioEngine({
    status: (s) => { status.value = s; if (s === 'playing') { errorMessage.value = null; consecutiveFailures = 0 } },
    time: (p, d) => {
      positionMs.value = p
      if (d) durationMs.value = d
      maybeCountPlay(p)
      const now = Date.now()
      if (status.value === 'playing' && now - lastPositionPersist > POSITION_PERSIST_MS) { lastPositionPersist = now; persistQueue() }
    },
    ended: () => advance(true),
    error: (m) => void handleFailure(m),
  }))

  const entries = computed(() => { void queueVersion.value; return queue.entries })
  const position = computed(() => { void queueVersion.value; return queue.position })
  const isPlaying = computed(() => status.value === 'playing' || status.value === 'buffering' || (status.value === 'loading' && !engine.isPaused))
  const hasTrack = computed(() => current.value !== null)

  function syncCurrent(): void {
    current.value = queue.current?.track ?? null
    touchQueue()
    updateMediaSession()
  }

  function maybeCountPlay(p: number): void {
    const t = current.value
    if (!t || historyCounted) return
    const threshold = Math.min(HISTORY_MIN_MS, (durationMs.value || t.durationMs) * 0.5)
    if (threshold > 0 && p >= threshold) {
      historyCounted = true
      void api.tracks.played(t.id, restoreRecordHistory).catch(() => undefined)
    }
  }

  function loadCurrent(play: boolean, startMs = 0): void {
    const t = queue.current?.track
    syncCurrent()
    historyCounted = false
    errorMessage.value = null
    positionMs.value = startMs
    durationMs.value = t?.durationMs ?? 0
    if (!t) { engine.unload(); return }
    engine.load(trackUrl(t.id), { play, startMs })
    persistQueue()
  }

  async function handleFailure(message: string): Promise<void> {
    const t = current.value
    errorMessage.value = t ? `Can't play “${t.title}”. ${message}` : message
    consecutiveFailures++
    if (t) void api.tracks.markMissing(t.id).catch(() => undefined)
    // Skip forward automatically, but stop when everything in the queue has failed in a row.
    if (consecutiveFailures < Math.min(queue.length, 5) && queue.position + 1 < queue.length) {
      setTimeout(() => { if (status.value === 'error') advance(false) }, 1500)
    }
  }

  /**
   * Changes track without an abrupt cut: fade the current sound out, switch, then fade the new track in.
   * Rapid presses are safe: only the most recent switch completes.
   */
  let switchId = 0
  async function withFade(change: () => void): Promise<void> {
    const mine = ++switchId
    if (engine.isAudible) {
      await engine.fade(0, FADE_OUT_MS)
      if (mine !== switchId) return
    }
    change()
    if (engine.isPaused && !engine.hasSource) { engine.setGain(1); return }
    engine.setGain(0)
    void engine.fade(1, FADE_IN_MS)
  }

  function advance(auto: boolean): void {
    if (auto) engine.setGain(1) // the previous track already ended on its own
    const step = queue.next(auto)
    if (step.kind === 'end') {
      // Playback finished: park on the last track, paused at the end.
      status.value = 'paused'
      return
    }
    loadCurrent(true)
  }

  // ── transport ──────────────────────────────────────────────
  function playTracks(tracks: Track[], startIndex = 0): void {
    if (!tracks.length) return
    queue.set(tracks, startIndex)
    syncCurrent()
    void withFade(() => loadCurrent(true))
  }

  async function togglePlay(): Promise<void> {
    if (!current.value) return
    if (status.value === 'error') { loadCurrent(true); return }
    if (engine.isPaused) {
      if (!engine.hasSource) loadCurrent(true, positionMs.value)
      else { engine.setGain(0); await engine.play().catch(() => undefined); void engine.fade(1, RESUME_FADE_MS) }
    } else {
      // Short fade so pausing doesn't click.
      const mine = ++switchId
      await engine.fade(0, PAUSE_FADE_MS)
      if (mine !== switchId) return
      engine.pause()
      engine.setGain(1)
    }
  }

  function next(): void {
    if (!queue.current) return
    // The queue position moves on every press (so rapid presses skip several tracks); only the audio switch is faded/debounced.
    const step = queue.next(false)
    if (step.kind === 'end') return
    syncCurrent()
    void withFade(() => loadCurrent(true))
  }

  function previous(): void {
    if (!queue.current) return
    if (positionMs.value > 3000) { engine.seek(0); return }
    const before = queue.position
    queue.previous()
    if (queue.position === before) {
      // Already on the first track: restart it instead of moving.
      engine.seek(0)
      if (engine.isPaused) void engine.play().catch(() => undefined)
      return
    }
    syncCurrent()
    void withFade(() => loadCurrent(true))
  }

  function seek(ms: number): void { engine.seek(ms); positionMs.value = ms }

  function setVolume(v: number): void {
    volume.value = Math.max(0, Math.min(1, v))
    if (volume.value > 0 && muted.value) muted.value = false
    engine.setVolume(volume.value); engine.setMuted(muted.value)
    persistSettings()
  }
  function toggleMute(): void { muted.value = !muted.value; engine.setMuted(muted.value); persistSettings() }
  function toggleShuffle(): void { shuffle.value = !shuffle.value; queue.setShuffle(shuffle.value); touchQueue(); persistSettings(); persistQueue() }
  function cycleRepeat(): void {
    repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off'
    queue.repeat = repeat.value
    persistSettings()
  }

  // ── queue management ───────────────────────────────────────
  function jumpTo(pos: number): void { if (queue.jumpTo(pos)) { syncCurrent(); void withFade(() => loadCurrent(true)) } }

  function enqueue(tracks: Track[], where: 'next' | 'end'): void {
    const wasEmpty = queue.length === 0
    queue.add(tracks, where)
    if (wasEmpty) loadCurrent(false)
    else { touchQueue(); persistQueue() }
    ui.toast(t(where === 'next' ? 'Playing next' : 'Added to queue'))
  }

  function removeFromQueue(pos: number): void {
    const { removedCurrent } = queue.remove(pos)
    if (removedCurrent) {
      if (queue.current) loadCurrent(!engine.isPaused)
      else { engine.unload(); syncCurrent() }
    } else { touchQueue(); persistQueue() }
  }

  function moveInQueue(from: number, to: number): void { queue.move(from, to); touchQueue(); persistQueue() }
  function clearUpcoming(): void { queue.clearUpcoming(); touchQueue(); persistQueue() }

  async function toggleFavorite(track: Track): Promise<void> {
    const value = !track.favorite
    patchTrack(track.id, { favorite: value })
    try { await api.tracks.setFavorite(track.id, value) } catch {
      patchTrack(track.id, { favorite: !value })
      ui.toast(t('Couldn’t update favorite'), 'error')
    }
  }

  /** Keeps cached copies of a track (queue, now-playing) in sync after a change. */
  function patchTrack(id: number, patch: Partial<Track>): void {
    queue.patchTrack(id, patch)
    if (current.value?.id === id) current.value = { ...current.value, ...patch }
    touchQueue()
    ui.bumpTracks(id, patch)
  }

  // ── persistence ────────────────────────────────────────────
  function persistSettings(): void {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      void api.settings.patch({ volume: volume.value, muted: muted.value, shuffle: shuffle.value, repeat: repeat.value }).catch(() => undefined)
    }, PERSIST_DEBOUNCE_MS)
  }

  let queueTimer: ReturnType<typeof setTimeout> | undefined
  function persistQueue(): void {
    clearTimeout(queueTimer)
    queueTimer = setTimeout(() => {
      void api.settings.patch({
        queue: { trackIds: queue.entries.map((e) => e.track.id), index: queue.position, positionMs: positionMs.value },
      }).catch(() => undefined)
    }, PERSIST_DEBOUNCE_MS)
  }

  async function init(): Promise<void> {
    const s = await api.settings.get()
    volume.value = s.volume; muted.value = s.muted; shuffle.value = s.shuffle; repeat.value = s.repeat
    restoreRecordHistory = s.recordHistory
    queue.repeat = s.repeat
    queue.shuffle = s.shuffle
    engine.setVolume(s.volume); engine.setMuted(s.muted)
    if (s.restoreQueue && s.queue.trackIds.length) {
      const unique = [...new Set(s.queue.trackIds)]
      const found = new Map((await api.tracks.byIds(unique)).map((t) => [t.id, t]))
      const tracks = s.queue.trackIds.flatMap((id) => found.get(id) ?? [])
      const savedCurrentId = s.queue.trackIds[s.queue.index]
      const idx = Math.max(0, tracks.findIndex((t) => t.id === savedCurrentId))
      if (tracks.length) {
        // The saved list is already in play order; restore paused at the saved position.
        queue.restore(tracks, idx)
        queue.shuffle = s.shuffle
        loadCurrent(false, s.queue.positionMs)
      }
    }
    ready.value = true
  }

  function setRecordHistory(v: boolean): void { restoreRecordHistory = v }

  // ── OS media integration ───────────────────────────────────
  function updateMediaSession(): void {
    if (!('mediaSession' in navigator)) return
    const t = current.value
    if (!t) { navigator.mediaSession.metadata = null; return }
    const art = artUrl(t.artworkHash)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: t.album,
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    })
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => void togglePlay())
    ms.setActionHandler('pause', () => void togglePlay())
    ms.setActionHandler('previoustrack', previous)
    ms.setActionHandler('nexttrack', next)
    ms.setActionHandler('seekto', (d) => { if (d.seekTime !== undefined) seek(d.seekTime * 1000) })
  }

  return {
    status, positionMs, durationMs, volume, muted, shuffle, repeat, errorMessage, current, ready, entries, position,
    isPlaying, hasTrack,
    playTracks, togglePlay, next, previous, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat,
    jumpTo, enqueue, removeFromQueue, moveInQueue, clearUpcoming, toggleFavorite, patchTrack, init, setRecordHistory,
  }
})

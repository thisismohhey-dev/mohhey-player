import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef, triggerRef } from 'vue'
import { FLAT_EQ, type EqSettings, type RepeatMode, type Track } from '@mohhey/contracts'
import { api, artUrl, trackUrl } from '@/lib/api'
import { formatTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { AudioEngine, type EngineStatus } from '@/lib/player/engine'
import { PlayQueue } from '@/lib/player/queue'
import { useUiStore } from './ui'

const HISTORY_MIN_MS = 30_000
const PAUSE_FADE_MS = 140
const RESUME_FADE_MS = 200
const SLEEP_FADE_MS = 4000
const PERSIST_DEBOUNCE_MS = 600
const POSITION_PERSIST_MS = 5_000
/** Tracks at least this long (podcasts, audiobooks, DJ sets) remember where you stopped. */
export const LONG_TRACK_MS = 10 * 60_000
const RESUME_MIN_MS = 5_000
const RESUME_END_MARGIN_MS = 15_000
/** Loudness target (RMS, dBFS) and how much correction we allow. */
const TARGET_RMS_DB = -18
const MAX_CUT_DB = 12
const MAX_BOOST_DB = 9
const MEASURE_SAMPLES = 24
const MEASURE_SILENCE_DB = -55

export type SleepMode = 'off' | 'minutes' | 'track'
export const isLong = (t: Track | null | undefined): boolean => !!t && t.durationMs >= LONG_TRACK_MS

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
  const playbackRate = ref(1)
  const normalize = ref(false)
  const crossfadeSec = ref(0)
  const gapless = ref(true)
  const eq = ref<EqSettings>({ ...FLAT_EQ, gains: [...FLAT_EQ.gains] })
  const sleepMode = ref<SleepMode>('off')
  const sleepRemainingMs = ref(0)

  let historyCounted = false
  let consecutiveFailures = 0
  let lastPositionPersist = 0
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let restoreRecordHistory = true
  /** The track actually loaded in the audio engine (differs from `current` for a moment while a skip is fading). */
  let loadedTrack: Track | null = null
  let crossfading = false
  let sleepEndsAt = 0
  let sleepTimer: ReturnType<typeof setInterval> | undefined
  let measure: number[] = []

  const engine = markRaw(new AudioEngine({
    status: (s) => {
      status.value = s
      if (s === 'playing') { errorMessage.value = null; consecutiveFailures = 0 }
      if (s === 'paused') flushResume()
      updatePlaybackState()
    },
    time: (p, d) => {
      positionMs.value = p
      if (d) durationMs.value = d
      maybeCountPlay(p)
      const now = Date.now()
      if (status.value === 'playing' && now - lastPositionPersist > POSITION_PERSIST_MS) { lastPositionPersist = now; persistQueue(); flushResume() }
      scheduleTransitions(p, d || durationMs.value)
      updatePositionState()
    },
    ended: () => onEnded(),
    error: (m) => void handleFailure(m),
  }))

  const entries = computed(() => { void queueVersion.value; return queue.entries })
  const position = computed(() => { void queueVersion.value; return queue.position })
  const isPlaying = computed(() => status.value === 'playing' || status.value === 'buffering' || (status.value === 'loading' && !engine.isPaused))
  const hasTrack = computed(() => current.value !== null)
  const currentIsLong = computed(() => isLong(current.value))

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

  // ── resume position (long tracks) ──────────────────────────
  /** Saves where the loaded long track stopped; 0 when it is at the very start or practically finished. */
  function flushResume(forceFinished = false): void {
    const track = loadedTrack
    if (!track || !isLong(track)) return
    const pos = positionMs.value
    const dur = durationMs.value || track.durationMs
    const value = forceFinished || pos < RESUME_MIN_MS || pos > dur - RESUME_END_MARGIN_MS ? 0 : pos
    if (value === (resumeSaved.get(track.id) ?? track.resumeMs)) return
    resumeSaved.set(track.id, value)
    patchTrack(track.id, { resumeMs: value })
    void api.tracks.setPosition(track.id, value).catch(() => undefined)
  }
  const resumeSaved = new Map<number, number>()

  // ── loading ────────────────────────────────────────────────
  function loadCurrent(play: boolean, startMs?: number): void {
    flushResume() // remember where the previous long track stopped
    const t0 = queue.current?.track
    syncCurrent()
    historyCounted = false
    measure = []
    errorMessage.value = null
    let start = startMs ?? 0
    if (startMs === undefined && t0 && isLong(t0) && t0.resumeMs >= RESUME_MIN_MS && t0.resumeMs < t0.durationMs - RESUME_END_MARGIN_MS) {
      start = t0.resumeMs
      if (play) ui.toast(t('Resumed at {time}', { time: formatTime(start) }))
    }
    positionMs.value = start
    durationMs.value = t0?.durationMs ?? 0
    loadedTrack = t0 ?? null
    crossfading = false
    if (!t0) { engine.unload(); return }
    engine.load(trackUrl(t0.id), { play, startMs: start, gainDb: normalize.value ? t0.gainDb : null })
    persistQueue()
  }

  async function handleFailure(message: string): Promise<void> {
    const t0 = current.value
    errorMessage.value = t0 ? t('Can’t play “{title}”. {reason}', { title: t0.title, reason: t(message) }) : t(message)
    consecutiveFailures++
    if (t0) void api.tracks.markMissing(t0.id).catch(() => undefined)
    // Skip forward automatically, but stop when everything in the queue has failed in a row.
    if (consecutiveFailures < Math.min(queue.length, 5) && queue.position + 1 < queue.length) {
      setTimeout(() => { if (status.value === 'error') advance(false) }, 1500)
    }
  }

  /**
   * Manual track changes (next, previous, picking a song) switch immediately; only play/pause and the automatic
   * end-of-track transition (crossfade/gapless) are faded. Bumping switchId cancels a pause fade that is still running.
   */
  let switchId = 0
  function switchNow(change: () => void): void {
    switchId++
    change()
  }

  function onEnded(): void {
    flushResume(true) // finished: next time it starts from the beginning
    if (sleepMode.value === 'track') {
      clearSleep()
      status.value = 'paused'
      ui.toast(t('Sleep timer: stopped after this track'))
      return
    }
    advance(true)
  }

  function advance(auto: boolean): void {
    if (auto) engine.setGain(1) // the previous track already ended on its own
    const step = queue.next(auto)
    if (step.kind === 'end') {
      // Playback finished: park on the last track, paused at the end.
      status.value = 'paused'
      return
    }
    loadCurrent(true, auto ? 0 : undefined)
  }

  // ── gapless + crossfade ────────────────────────────────────
  function scheduleTransitions(p: number, d: number): void {
    if (status.value !== 'playing' || !d || crossfading) return
    const upcoming = queue.peek(true)
    if (!upcoming || upcoming.track.id === loadedTrack?.id && queue.length === 1) return
    if (sleepMode.value === 'track') return
    const remaining = d - p
    const fadeMs = crossfadeSec.value * 1000
    if (fadeMs > 0 && d > fadeMs * 2 + 4000 && remaining <= fadeMs + 120 && upcoming.track.resumeMs < RESUME_MIN_MS) {
      startCrossfade(fadeMs)
    } else if (gapless.value && remaining < 12_000 && engine.preloadedSrc !== trackUrl(upcoming.track.id)) {
      engine.preload(trackUrl(upcoming.track.id))
    }
  }

  function startCrossfade(ms: number): void {
    const step = queue.next(true)
    if (step.kind === 'end') return
    crossfading = true
    flushResume(true)
    syncCurrent()
    const t1 = queue.current!.track
    historyCounted = false
    measure = []
    loadedTrack = t1
    positionMs.value = 0
    durationMs.value = t1.durationMs
    engine.crossfadeTo(trackUrl(t1.id), ms, { gainDb: normalize.value ? t1.gainDb : null })
    persistQueue()
    setTimeout(() => { crossfading = false }, ms + 300)
  }

  // ── transport ──────────────────────────────────────────────
  function playTracks(tracks: Track[], startIndex = 0): void {
    if (!tracks.length) return
    queue.set(tracks, startIndex)
    syncCurrent()
    switchNow(() => loadCurrent(true))
  }

  async function togglePlay(): Promise<void> {
    if (!current.value) return
    if (status.value === 'error') { loadCurrent(true); return }
    if (engine.isPaused) {
      if (!engine.hasSource) { loadCurrent(true, positionMs.value); engine.setGain(0); void engine.fade(1, RESUME_FADE_MS) }
      else { engine.setGain(0); await engine.play(true).catch(() => undefined); void engine.fade(1, RESUME_FADE_MS) }
    } else {
      // Short fade so pausing doesn't click.
      const mine = ++switchId
      await engine.fade(0, PAUSE_FADE_MS)
      if (mine !== switchId) return
      engine.pause() // gain stays at 0 until the next play, otherwise the decoder's last buffered samples click
    }
  }

  function next(): void {
    if (!queue.current) return
    // The queue position moves on every press (so rapid presses skip several tracks); only the audio switch is faded/debounced.
    const step = queue.next(false)
    if (step.kind === 'end') return
    syncCurrent()
    switchNow(() => loadCurrent(true))
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
    switchNow(() => loadCurrent(true))
  }

  function seek(ms: number): void { engine.seek(ms); positionMs.value = ms }
  /** Relative seek, used by the −15 s / +30 s buttons and shortcuts. */
  function skipBy(deltaMs: number): void {
    if (!current.value) return
    const max = (durationMs.value || current.value.durationMs) - 500
    seek(Math.max(0, Math.min(max, positionMs.value + deltaMs)))
  }

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

  // ── speed, loudness, EQ, crossfade ─────────────────────────
  function setRate(rate: number): void {
    playbackRate.value = Math.max(0.5, Math.min(3, rate))
    engine.setRate(playbackRate.value)
    persistExtras()
    updatePositionState()
  }

  function setNormalize(on: boolean): void {
    normalize.value = on
    engine.setTrackGainDb(on ? (current.value?.gainDb ?? null) : null)
    measure = []
    persistExtras()
  }

  function setEq(next: EqSettings): void {
    eq.value = { ...next, gains: [...next.gains] }
    engine.setEq(next.enabled, next.gains)
    persistExtras()
  }

  function setCrossfade(sec: number): void { crossfadeSec.value = Math.max(0, Math.min(12, sec)); persistExtras() }
  function setGapless(on: boolean): void { gapless.value = on; persistExtras() }

  /** Learns a loudness correction for tracks without a ReplayGain tag: average level of the first ~12 s of audio. */
  function sampleLoudness(): void {
    const track = loadedTrack
    if (!normalize.value || !track || track.gainDb !== null || status.value !== 'playing') return
    const db = engine.levelDb()
    if (db === null || !Number.isFinite(db) || db < MEASURE_SILENCE_DB) return
    measure.push(db)
    if (measure.length < MEASURE_SAMPLES) return
    const avg = measure.reduce((a, b) => a + b, 0) / measure.length
    const gainDb = Math.round(Math.max(-MAX_CUT_DB, Math.min(MAX_BOOST_DB, TARGET_RMS_DB - avg)) * 10) / 10
    measure = []
    engine.setTrackGainDb(gainDb)
    patchTrack(track.id, { gainDb })
    void api.tracks.setGain(track.id, gainDb).catch(() => undefined)
  }
  setInterval(sampleLoudness, 500)

  // ── sleep timer ────────────────────────────────────────────
  function clearSleep(): void {
    clearInterval(sleepTimer)
    sleepMode.value = 'off'
    sleepRemainingMs.value = 0
    sleepEndsAt = 0
  }

  async function sleepStop(): Promise<void> {
    clearSleep()
    if (engine.isAudible) {
      const mine = ++switchId
      await engine.fade(0, SLEEP_FADE_MS)
      if (mine !== switchId) { engine.setGain(1); return }
      engine.pause() // gain stays at 0 so the buffered tail cannot click; the next play() restores it
    }
    ui.toast(t('Sleep timer: playback stopped'))
  }

  function setSleep(mode: 'off' | 'track' | number): void {
    clearSleep()
    if (mode === 'off') return
    if (mode === 'track') { sleepMode.value = 'track'; return }
    sleepMode.value = 'minutes'
    sleepEndsAt = Date.now() + mode * 60_000
    sleepRemainingMs.value = mode * 60_000
    sleepTimer = setInterval(() => {
      sleepRemainingMs.value = Math.max(0, sleepEndsAt - Date.now())
      if (sleepRemainingMs.value <= 0) void sleepStop()
    }, 1000)
  }

  // ── queue management ───────────────────────────────────────
  function jumpTo(pos: number): void { if (queue.jumpTo(pos)) { syncCurrent(); switchNow(() => loadCurrent(true)) } }

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
    if (loadedTrack?.id === id) loadedTrack = { ...loadedTrack, ...patch }
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

  let extrasTimer: ReturnType<typeof setTimeout> | undefined
  function persistExtras(): void {
    clearTimeout(extrasTimer)
    extrasTimer = setTimeout(() => {
      void api.settings.patch({
        playbackRate: playbackRate.value, normalize: normalize.value, crossfadeSec: crossfadeSec.value, gapless: gapless.value, eq: eq.value,
      }).catch(() => undefined)
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
    playbackRate.value = s.playbackRate; normalize.value = s.normalize; crossfadeSec.value = s.crossfadeSec; gapless.value = s.gapless
    eq.value = { ...s.eq, gains: [...s.eq.gains] }
    restoreRecordHistory = s.recordHistory
    queue.repeat = s.repeat
    queue.shuffle = s.shuffle
    engine.setVolume(s.volume); engine.setMuted(s.muted); engine.setRate(s.playbackRate); engine.setEq(s.eq.enabled, s.eq.gains)
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
        const restored = tracks[idx]
        // A long track continues from its own remembered position, which is more reliable than the queue snapshot.
        loadCurrent(false, isLong(restored) && (restored?.resumeMs ?? 0) >= RESUME_MIN_MS ? restored!.resumeMs : s.queue.positionMs)
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

  function updatePlaybackState(): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = status.value === 'playing' || status.value === 'buffering' ? 'playing' : current.value ? 'paused' : 'none'
  }

  let lastPositionStateAt = 0
  function updatePositionState(): void {
    if (!('mediaSession' in navigator) || Date.now() - lastPositionStateAt < 1000) return
    lastPositionStateAt = Date.now()
    const duration = (durationMs.value || current.value?.durationMs || 0) / 1000
    const position = Math.min(positionMs.value / 1000, duration)
    if (!(duration > 0)) return
    try { navigator.mediaSession.setPositionState({ duration, position, playbackRate: playbackRate.value }) } catch { /* unsupported combination */ }
  }

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => void togglePlay())
    ms.setActionHandler('pause', () => void togglePlay())
    ms.setActionHandler('previoustrack', previous)
    ms.setActionHandler('nexttrack', next)
    ms.setActionHandler('seekto', (d) => { if (d.seekTime !== undefined) seek(d.seekTime * 1000) })
    ms.setActionHandler('seekbackward', (d) => skipBy(-(d.seekOffset ?? 15) * 1000))
    ms.setActionHandler('seekforward', (d) => skipBy((d.seekOffset ?? 30) * 1000))
  }

  return {
    status, positionMs, durationMs, volume, muted, shuffle, repeat, errorMessage, current, ready, entries, position,
    isPlaying, hasTrack, currentIsLong, playbackRate, normalize, crossfadeSec, gapless, eq, sleepMode, sleepRemainingMs,
    playTracks, togglePlay, next, previous, seek, skipBy, setVolume, toggleMute, toggleShuffle, cycleRepeat,
    setRate, setNormalize, setEq, setCrossfade, setGapless, setSleep,
    /** Diagnostics: engine state and the current output level (dBFS). */
    debug: () => ({ ...engine.debugState(), inDb: engine.levelDb(), outDb: engine.levelDb(true) }),
    jumpTo, enqueue, removeFromQueue, moveInQueue, clearUpcoming, toggleFavorite, patchTrack, init, setRecordHistory,
  }
})

import { onScopeDispose, ref, shallowRef, triggerRef, watch } from 'vue'
import type { Track, TrackQuery } from '@mohhey/contracts'
import { api, ApiClientError } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'

const PAGE = 100
const ALL_CHUNK = 500
const ALL_CAP = 20_000

/** A read-only window over a track list; rows are fetched lazily as they scroll into view. */
export interface TrackSource {
  total: { value: number }
  version: { value: number }
  get(i: number): Track | undefined
  ensure(i: number): void
  /** Resolves every track (used to build a play queue from the whole list). */
  all(): Promise<Track[]>
}

export function arraySource(tracks: Track[]): TrackSource {
  return { total: { value: tracks.length }, version: { value: 0 }, get: (i) => tracks[i], ensure: () => undefined, all: async () => tracks }
}

export function usePagedTracks(getQuery: () => TrackQuery) {
  const library = useLibraryStore()
  const ui = useUiStore()
  const total = ref(0)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const version = ref(0)
  const rows = shallowRef<(Track | undefined)[]>([])
  const inflight = new Set<number>()
  let generation = 0

  async function loadPage(page: number, gen: number): Promise<void> {
    if (inflight.has(page)) return
    inflight.add(page)
    try {
      const res = await api.tracks.list({ ...getQuery(), limit: PAGE, offset: page * PAGE })
      if (gen !== generation) return
      res.items.forEach((t, i) => { rows.value[page * PAGE + i] = t })
      total.value = res.total
      version.value++
      triggerRef(rows)
    } catch (e) {
      if (gen === generation) error.value = e instanceof ApiClientError ? e.message : t(t('Could not load songs.'))
    } finally {
      inflight.delete(page)
    }
  }

  async function reset(): Promise<void> {
    const gen = ++generation
    inflight.clear()
    loading.value = true; error.value = null
    try {
      const res = await api.tracks.list({ ...getQuery(), limit: PAGE, offset: 0 })
      if (gen !== generation) return
      rows.value = new Array(res.total)
      res.items.forEach((t, i) => { rows.value[i] = t })
      total.value = res.total
      version.value++
    } catch (e) {
      if (gen === generation) { error.value = e instanceof ApiClientError ? e.message : t(t('Could not load songs.')); rows.value = []; total.value = 0 }
    } finally {
      if (gen === generation) loading.value = false
    }
  }

  const source: TrackSource = {
    total, version,
    get: (i) => rows.value[i],
    ensure: (i) => { if (!rows.value[i] && i < total.value) void loadPage(Math.floor(i / PAGE), generation) },
    all: async () => {
      const out: Track[] = []
      const q = getQuery()
      for (let offset = 0; offset < Math.min(total.value, ALL_CAP); offset += ALL_CHUNK) {
        out.push(...(await api.tracks.list({ ...q, limit: ALL_CHUNK, offset })).items)
      }
      return out
    },
  }

  watch(getQuery, () => void reset(), { deep: true, immediate: true })
  watch(() => library.revision, () => void reset())
  const stop = watch(() => ui.trackPatch, (p) => {
    if (!p) return
    const i = rows.value.findIndex((t) => t?.id === p.id)
    const row = rows.value[i]
    if (row) {
      // Un-favoriting while viewing the Favorites list removes the row on next refresh; keep it visible until then.
      rows.value[i] = { ...row, ...p.patch }
      version.value++
      triggerRef(rows)
    }
  })
  onScopeDispose(() => { generation++; stop() })

  return { source, total, loading, error, reload: reset }
}

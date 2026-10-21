import { onScopeDispose, ref, shallowRef, watch, type WatchSource } from 'vue'
import { ApiClientError } from '@/lib/api'
import { useLibraryStore } from '@/stores/library'

/** Runs `fn` now and whenever `deps` (or the library revision) change; guards against out-of-order responses. */
export function useLoader<T>(fn: () => Promise<T>, deps: WatchSource[] = [], opts: { refreshOnLibrary?: boolean } = { refreshOnLibrary: true }) {
  const library = useLibraryStore()
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  let run = 0
  let alive = true

  async function reload(): Promise<void> {
    const mine = ++run
    loading.value = data.value === null
    error.value = null
    try {
      const result = await fn()
      if (mine === run && alive) data.value = result
    } catch (e) {
      if (mine === run && alive) error.value = e instanceof ApiClientError ? e.message : 'Something went wrong while loading.'
    } finally {
      if (mine === run && alive) loading.value = false
    }
  }

  const sources: WatchSource[] = [...deps]
  if (opts.refreshOnLibrary) sources.push(() => library.revision)
  watch(sources, () => void reload(), { immediate: true })
  onScopeDispose(() => { alive = false })
  return { data, loading, error, reload }
}

import { t } from '@/lib/i18n'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LibraryFolder, Playlist, ScanStatus } from '@mohhey/contracts'
import { api, ApiClientError } from '@/lib/api'
import { useUiStore } from './ui'

export const useLibraryStore = defineStore('library', () => {
  const ui = useUiStore()
  const folders = ref<LibraryFolder[]>([])
  const playlists = ref<Playlist[]>([])
  const scan = ref<ScanStatus | null>(null)
  const loaded = ref(false)
  /** Bumped whenever library content changes so pages refetch. */
  const revision = ref(0)
  let pollTimer: ReturnType<typeof setTimeout> | undefined

  const hasLibrary = computed(() => folders.value.length > 0)
  const isScanning = computed(() => scan.value?.state === 'scanning')

  async function load(): Promise<void> {
    const [f, p, s] = await Promise.all([api.library.folders(), api.playlists.list(), api.library.scanStatus()])
    folders.value = f; playlists.value = p; scan.value = s
    loaded.value = true
    if (s.state === 'scanning') poll()
  }

  function poll(): void {
    clearTimeout(pollTimer)
    pollTimer = setTimeout(async () => {
      try {
        const s = await api.library.scanStatus()
        scan.value = s
        if (s.state === 'scanning') { revision.value++; poll() } else { await refreshFolders(); revision.value++ }
      } catch { poll() }
    }, 600)
  }

  async function refreshFolders(): Promise<void> { folders.value = await api.library.folders() }
  async function refreshPlaylists(): Promise<void> { playlists.value = await api.playlists.list() }

  async function addFolder(): Promise<void> {
    const result = await window.mohhey.addLibraryFolder()
    if (result.status === 'cancelled') return
    if (result.status === 'error') { ui.toast(t(result.message), 'error'); return }
    try {
      folders.value = await api.library.folders()
      scan.value = await api.library.scanStatus()
      poll()
    } catch (e) {
      ui.toast(e instanceof ApiClientError ? e.message : t('Couldn’t add that folder.'), 'error')
    }
  }

  async function removeFolder(id: number): Promise<void> {
    folders.value = await api.library.removeFolder(id)
    revision.value++
  }

  async function rescan(): Promise<void> {
    scan.value = await api.library.scan()
    poll()
  }

  return {
    folders, playlists, scan, loaded, revision, hasLibrary, isScanning,
    load, addFolder, removeFolder, rescan, refreshFolders, refreshPlaylists,
  }
})

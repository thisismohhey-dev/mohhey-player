import { useRouter } from 'vue-router'
import type { Playlist } from '@mohhey/contracts'
import { api, ApiClientError } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import { askPlaylistDetails } from './usePlaylistDialog'

/** Create / edit / delete playlists with the shared dialog, keeping the sidebar list in sync. */
export function usePlaylistActions() {
  const library = useLibraryStore()
  const ui = useUiStore()
  const router = useRouter()

  const fail = (e: unknown, fallback: string) => ui.toast(e instanceof ApiClientError ? e.message : fallback, 'error')

  async function create(): Promise<Playlist | null> {
    const details = await askPlaylistDetails({ mode: 'create' })
    if (!details) return null
    try {
      const p = await api.playlists.create(details.name, details.icon)
      await library.refreshPlaylists()
      return p
    } catch (e) { fail(e, t('Couldn’t create the playlist.')); return null }
  }

  async function edit(p: Pick<Playlist, 'id' | 'name' | 'icon'>): Promise<boolean> {
    const details = await askPlaylistDetails({ mode: 'edit', name: p.name, icon: p.icon })
    if (!details) return false
    try {
      await api.playlists.update(p.id, details)
      await library.refreshPlaylists()
      library.revision++
      return true
    } catch (e) { fail(e, t('Couldn’t rename the playlist.')); return false }
  }

  async function remove(p: Pick<Playlist, 'id' | 'name'>, currentRouteId?: number): Promise<boolean> {
    if (!confirm(t('Delete “{name}”? The songs themselves stay in your library.', { name: p.name }))) return false
    try {
      await api.playlists.remove(p.id)
      await library.refreshPlaylists()
      if (currentRouteId === p.id) void router.replace({ name: 'playlists' })
      return true
    } catch (e) { fail(e, t('Couldn’t delete the playlist.')); return false }
  }

  return { create, edit, remove }
}

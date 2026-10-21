import { t } from '@/lib/i18n'
import { useRouter } from 'vue-router'
import type { Track } from '@mohhey/contracts'
import { api, ApiClientError } from '@/lib/api'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import { usePlaylistActions } from './usePlaylistActions'

export function useTrackActions() {
  const player = usePlayerStore()
  const library = useLibraryStore()
  const ui = useUiStore()
  const router = useRouter()
  const playlistActions = usePlaylistActions()

  async function addToPlaylist(playlistId: number, tracks: Track[]): Promise<void> {
    try {
      const p = await api.playlists.addTracks(playlistId, tracks.map((t) => t.id))
      await library.refreshPlaylists()
      ui.toast(t('Added to {name}', { name: p.name }))
    } catch (e) {
      ui.toast(e instanceof ApiClientError ? e.message : t('Couldn’t add to playlist.'), 'error')
    }
  }

  async function addToNewPlaylist(tracks: Track[]): Promise<void> {
    const p = await playlistActions.create()
    if (p && tracks.length) await addToPlaylist(p.id, tracks)
  }

  return {
    play: (tracks: Track[], index = 0) => player.playTracks(tracks, index),
    playNext: (tracks: Track[]) => player.enqueue(tracks, 'next'),
    addToQueue: (tracks: Track[]) => player.enqueue(tracks, 'end'),
    toggleFavorite: (t: Track) => player.toggleFavorite(t),
    addToPlaylist, addToNewPlaylist,
    goToAlbum: (t: Track) => { if (t.albumId) void router.push({ name: 'album', params: { id: t.albumId } }) },
    goToArtist: (t: Track) => { if (t.artistId) void router.push({ name: 'artist', params: { id: t.artistId } }) },
  }
}

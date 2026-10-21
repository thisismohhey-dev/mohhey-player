import { ref } from 'vue'
import type { PlaylistIcon } from '@mohhey/contracts'

export interface PlaylistDialogRequest {
  mode: 'create' | 'edit'
  name: string
  icon: PlaylistIcon
  resolve: (value: { name: string; icon: PlaylistIcon } | null) => void
}

export const activePlaylistDialog = ref<PlaylistDialogRequest | null>(null)

/** Opens the create/edit playlist dialog. Resolves to the chosen name + icon, or null when cancelled. */
export function askPlaylistDetails(opts: { mode: 'create' | 'edit'; name?: string; icon?: PlaylistIcon }): Promise<{ name: string; icon: PlaylistIcon } | null> {
  return new Promise((resolve) => {
    activePlaylistDialog.value = { mode: opts.mode, name: opts.name ?? '', icon: opts.icon ?? 'list-music', resolve }
  })
}

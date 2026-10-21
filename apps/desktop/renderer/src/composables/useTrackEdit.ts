import { ref } from 'vue'
import type { Track } from '@mohhey/contracts'

export const trackBeingEdited = ref<Track | null>(null)

/** Opens the "Edit info" dialog for a track. */
export function editTrackInfo(track: Track): void { trackBeingEdited.value = track }

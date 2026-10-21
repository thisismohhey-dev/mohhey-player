import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Track } from '@mohhey/contracts'

export type ThemeSetting = 'light' | 'dark' | 'system'
export interface Toast { id: number; text: string; kind: 'info' | 'error' }

let toastId = 0

export const useUiStore = defineStore('ui', () => {
  const queueOpen = ref(false)
  const nowPlayingOpen = ref(false)
  const theme = ref<ThemeSetting>('light')
  const toasts = ref<Toast[]>([])
  /** Incremented when a track changes elsewhere (e.g. favorite) so list views can patch their rows. */
  const trackPatch = ref<{ id: number; patch: Partial<Track>; n: number } | null>(null)
  let patchN = 0

  function toast(text: string, kind: Toast['kind'] = 'info'): void {
    const t = { id: ++toastId, text, kind }
    toasts.value = [...toasts.value.slice(-2), t]
    setTimeout(() => { toasts.value = toasts.value.filter((x) => x.id !== t.id) }, kind === 'error' ? 6000 : 2600)
  }

  function bumpTracks(id: number, patch: Partial<Track>): void { trackPatch.value = { id, patch, n: ++patchN } }

  function applyTheme(): void {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    window.mohhey.setTitleBarTheme(dark)
  }
  function setTheme(t: ThemeSetting): void { theme.value = t; applyTheme() }

  return { queueOpen, nowPlayingOpen, theme, toasts, trackPatch, toast, bumpTracks, setTheme, applyTheme }
})

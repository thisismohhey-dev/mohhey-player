import { defineStore } from 'pinia'
import { ref } from 'vue'
import { t } from '@/lib/i18n'
import type { Track } from '@mohhey/contracts'

export type ThemeSetting = 'light' | 'dark' | 'system'
export interface Toast { id: number; text: string; kind: 'info' | 'error' }

let toastId = 0
const trayLabels = () => ({
  show: t('Back to full player'), playPause: t('Play / pause'), next: t('player.next'), previous: t('player.previous'), quit: t('Quit'), tooltip: t('appName'),
})
const SIDEBAR_KEY = 'mohhey.sidebarCollapsed'
function readCollapsed(): boolean {
  try { return localStorage.getItem(SIDEBAR_KEY) === '1' } catch { return false }
}

export const useUiStore = defineStore('ui', () => {
  const queueOpen = ref(false)
  const nowPlayingOpen = ref(false)
  const miniMode = ref(false)
  const sidebarCollapsed = ref(readCollapsed())
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

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    try { localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0') } catch { /* storage unavailable: not persisted */ }
  }

  function setMiniMode(on: boolean): void {
    miniMode.value = on
    if (on) { queueOpen.value = false; nowPlayingOpen.value = false }
    window.mohhey.setMiniMode(on, on ? trayLabels() : undefined)
  }

  function applyTheme(): void {
    const dark = theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }
  function setTheme(t: ThemeSetting): void { theme.value = t; applyTheme() }

  return { queueOpen, nowPlayingOpen, miniMode, setMiniMode, sidebarCollapsed, toggleSidebar, theme, toasts, trackPatch, toast, bumpTracks, setTheme, applyTheme }
})

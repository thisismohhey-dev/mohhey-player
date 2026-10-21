<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { FolderPlus, Moon, Monitor, RefreshCw, Sun, Trash2, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiStore, type ThemeSetting } from '@/stores/ui'

const library = useLibraryStore()
const player = usePlayerStore()
const ui = useUiStore()
const restoreQueue = ref(true)
const recordHistory = ref(true)
const cache = ref<{ files: number; bytes: number } | null>(null)

onMounted(async () => {
  const s = await api.settings.get()
  restoreQueue.value = s.restoreQueue
  recordHistory.value = s.recordHistory
  cache.value = await api.artworkCache.info()
})

const themes: { id: ThemeSetting; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'System', icon: Monitor },
]

async function setTheme(t: ThemeSetting): Promise<void> { ui.setTheme(t); await api.settings.patch({ theme: t }) }
async function toggle(key: 'restoreQueue' | 'recordHistory'): Promise<void> {
  const ref_ = key === 'restoreQueue' ? restoreQueue : recordHistory
  ref_.value = !ref_.value
  await api.settings.patch({ [key]: ref_.value })
  if (key === 'recordHistory') player.setRecordHistory(ref_.value)
}
async function clearCache(): Promise<void> {
  await api.artworkCache.clear()
  cache.value = await api.artworkCache.info()
  ui.toast('Artwork cache cleared. Rescanning to rebuild it…')
  await library.rescan()
}
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
const switchCls = (on: boolean) => cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-foreground/20')
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 pb-10 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">Settings</h1>

    <section class="mt-10" aria-labelledby="s-lib">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="s-lib" class="text-2xl font-medium">Music folders</h2>
        <div class="flex gap-2">
          <Button variant="secondary" class="rounded-full" :disabled="library.isScanning || !library.folders.length" @click="library.rescan()">
            <RefreshCw class="size-4" :class="library.isScanning && 'animate-spin'" />{{ library.isScanning ? 'Scanning…' : 'Rescan' }}
          </Button>
          <Button class="rounded-full" @click="library.addFolder()"><FolderPlus class="size-4" />Add folder</Button>
        </div>
      </div>
      <ul class="divide-y overflow-hidden rounded-2xl bg-card shadow-card">
        <li v-for="f in library.folders" :key="f.id" class="flex items-center gap-4 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-medium" :title="f.path">{{ f.path }}</div>
            <div class="text-sm text-muted-foreground">{{ plural(f.trackCount, 'song') }}</div>
          </div>
          <Button variant="ghost" size="icon" class="rounded-full text-muted-foreground hover:text-destructive" :aria-label="`Remove ${f.path}`" title="Remove from library (files are not deleted)" @click="library.removeFolder(f.id)"><Trash2 class="size-4" /></Button>
        </li>
      </ul>
      <p class="mt-2 text-[13px] text-muted-foreground">Removing a folder only removes it from Mohhey. Your files are never touched.</p>

      <div v-if="library.scan && library.scan.state !== 'idle'" class="mt-4 rounded-2xl bg-card p-5 shadow-card" role="status">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">{{ library.scan.state === 'scanning' ? 'Scanning your library' : library.scan.state === 'done' ? 'Last scan finished' : 'Scan stopped' }}</span>
          <span class="tabular text-muted-foreground">{{ library.scan.processed }} / {{ library.scan.discovered }}</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"><div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${library.scan.discovered ? (library.scan.processed / library.scan.discovered) * 100 : 0}%` }" /></div>
        <p class="mt-3 text-[13px] text-muted-foreground">{{ library.scan.added }} added · {{ library.scan.updated }} updated · {{ library.scan.removed }} missing · {{ library.scan.failed }} couldn’t be read</p>
        <details v-if="library.scan.errors.length" class="mt-3">
          <summary class="flex cursor-pointer items-center gap-2 text-sm font-medium text-destructive"><TriangleAlert class="size-4" />{{ library.scan.errors.length }} problem{{ library.scan.errors.length === 1 ? '' : 's' }} — show details</summary>
          <ul class="mt-2 max-h-48 space-y-2 overflow-y-auto text-[13px]">
            <li v-for="e in library.scan.errors" :key="e.path + e.message"><div class="truncate font-medium" :title="e.path">{{ e.path || 'Scan' }}</div><div class="text-muted-foreground">{{ e.message }}</div></li>
          </ul>
          <Button variant="outline" size="sm" class="mt-3 rounded-full" :disabled="library.isScanning" @click="library.rescan()">Try again</Button>
        </details>
      </div>
    </section>

    <section class="mt-10" aria-labelledby="s-look">
      <h2 id="s-look" class="mb-3 text-2xl font-medium">Appearance</h2>
      <div class="inline-flex rounded-full bg-foreground/[0.06] p-1" role="radiogroup" aria-label="Theme">
        <button
          v-for="th in themes" :key="th.id" role="radio" :aria-checked="ui.theme === th.id"
          :class="cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors', ui.theme === th.id && 'bg-card text-foreground shadow-card')"
          @click="setTheme(th.id)"
        ><component :is="th.icon" class="size-4" />{{ th.label }}</button>
      </div>
    </section>

    <section class="mt-10" aria-labelledby="s-play">
      <h2 id="s-play" class="mb-3 text-2xl font-medium">Playback & privacy</h2>
      <ul class="divide-y overflow-hidden rounded-2xl bg-card shadow-card">
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">Remember my queue</div><div class="text-sm text-muted-foreground">Pick up where you left off after restarting.</div></div>
          <button role="switch" :aria-checked="restoreQueue" aria-label="Remember my queue" :class="switchCls(restoreQueue)" @click="toggle('restoreQueue')"><span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="restoreQueue ? 'start-[22px]' : 'start-0.5'" /></button>
        </li>
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">Keep play history</div><div class="text-sm text-muted-foreground">Powers “Recently played”. Stored only on this computer.</div></div>
          <button role="switch" :aria-checked="recordHistory" aria-label="Keep play history" :class="switchCls(recordHistory)" @click="toggle('recordHistory')"><span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="recordHistory ? 'start-[22px]' : 'start-0.5'" /></button>
        </li>
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">Artwork cache</div><div class="text-sm text-muted-foreground">{{ cache ? `${plural(cache.files, 'image')} · ${mb(cache.bytes)}` : '…' }}</div></div>
          <Button variant="outline" class="rounded-full" :disabled="library.isScanning" @click="clearCache">Clear & rebuild</Button>
        </li>
      </ul>
    </section>

    <section class="mt-10" aria-labelledby="s-keys">
      <h2 id="s-keys" class="mb-3 text-2xl font-medium">Keyboard shortcuts</h2>
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-card p-5 text-sm shadow-card">
        <template v-for="[k, v] in [['Space', 'Play / pause'], ['Ctrl + → / ←', 'Next / previous track'], ['Ctrl + ↑ / ↓', 'Volume up / down'], ['M', 'Mute'], ['Q', 'Show or hide queue'], ['Ctrl + Shift + M', 'Mini player (always on top)'], ['Ctrl + K  or  /', 'Search'], ['Alt + ↑ / ↓', 'Move item in queue or playlist']]" :key="k">
          <dt><kbd class="rounded-md bg-foreground/[0.07] px-2 py-1 font-mono text-xs">{{ k }}</kbd></dt><dd class="py-1 text-muted-foreground">{{ v }}</dd>
        </template>
      </dl>
    </section>
  </div>
</template>

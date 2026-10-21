<script setup lang="ts">
import { digits, locale, nf, setLocale, t, type Locale } from '@/lib/i18n'
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
type Tab = 'library' | 'appearance' | 'playback' | 'shortcuts'
const TAB_KEY = 'mohhey.settingsTab'
const tabs: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Library' }, { id: 'appearance', label: 'Appearance' }, { id: 'playback', label: 'Playback' }, { id: 'shortcuts', label: 'Shortcuts' },
]
const savedTab = (): Tab => { try { const v = localStorage.getItem(TAB_KEY); return tabs.some((x) => x.id === v) ? (v as Tab) : 'library' } catch { return 'library' } }
const tab = ref<Tab>(savedTab())
function selectTab(id: Tab): void { tab.value = id; try { localStorage.setItem(TAB_KEY, id) } catch { /* not persisted */ } }
/** Arrow keys move between tabs, as in a native tab list. */
function tabKey(e: KeyboardEvent): void {
  const dir = (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) * (document.documentElement.dir === 'rtl' ? -1 : 1)
  if (!dir) return
  e.preventDefault()
  const i = (tabs.findIndex((x) => x.id === tab.value) + dir + tabs.length) % tabs.length
  selectTab(tabs[i]!.id)
  requestAnimationFrame(() => document.getElementById('tab-' + tabs[i]!.id)?.focus())
}
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
const languages: { id: Locale; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'fa', label: 'فارسی' }]

async function chooseLanguage(l: Locale): Promise<void> { setLocale(l); await api.settings.patch({ locale: l }) }

async function setTheme(theme: ThemeSetting): Promise<void> { ui.setTheme(theme); await api.settings.patch({ theme }) }
async function toggle(key: 'restoreQueue' | 'recordHistory'): Promise<void> {
  const ref_ = key === 'restoreQueue' ? restoreQueue : recordHistory
  ref_.value = !ref_.value
  await api.settings.patch({ [key]: ref_.value })
  if (key === 'recordHistory') player.setRecordHistory(ref_.value)
}
async function clearCache(): Promise<void> {
  await api.artworkCache.clear()
  cache.value = await api.artworkCache.info()
  ui.toast(t('Artwork cache cleared. Rescanning to rebuild it…'))
  await library.rescan()
}
const mb = (b: number) => digits(`${(b / 1024 / 1024).toFixed(1)} MB`)
const switchCls = (on: boolean) => cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-foreground/20')
</script>

<template>
  <div class="mx-auto max-w-3xl px-8 pb-10 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">{{ t('Settings') }}</h1>

    <div class="mt-6 inline-flex max-w-full overflow-x-auto rounded-full bg-foreground/[0.06] p-1" role="tablist" :aria-label="t('Settings')" @keydown="tabKey">
      <button
        v-for="x in tabs" :id="'tab-' + x.id" :key="x.id" role="tab" :aria-selected="tab === x.id" :aria-controls="'panel-' + x.id" :tabindex="tab === x.id ? 0 : -1"
        :class="cn('shrink-0 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground', tab === x.id && 'bg-card text-foreground shadow-card')"
        @click="selectTab(x.id)"
      >{{ t(x.label) }}</button>
    </div>

    <section v-if="tab === 'library'" id="panel-library" role="tabpanel" aria-labelledby="tab-library" class="mt-6">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="s-lib" class="text-2xl font-medium">{{ t('Music folders') }}</h2>
        <div class="flex gap-2">
          <Button variant="secondary" class="rounded-full" :disabled="library.isScanning || !library.folders.length" @click="library.rescan()">
            <RefreshCw class="size-4" :class="library.isScanning && 'animate-spin'" />{{ t(library.isScanning ? 'Scanning…' : 'Rescan') }}
          </Button>
          <Button class="rounded-full" @click="library.addFolder()"><FolderPlus class="size-4" />{{ t('Add folder') }}</Button>
        </div>
      </div>
      <ul class="divide-y overflow-hidden rounded-2xl bg-card shadow-card">
        <li v-for="f in library.folders" :key="f.id" class="flex items-center gap-4 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="truncate text-[15px] font-medium" :title="f.path">{{ f.path }}</div>
            <div class="text-sm text-muted-foreground">{{ plural(f.trackCount, 'song') }}</div>
          </div>
          <Button variant="ghost" size="icon" class="rounded-full text-muted-foreground hover:text-destructive" :aria-label="t('Remove folder {name}', { name: f.path })" :title="t('Remove from library (files are not deleted)')" @click="library.removeFolder(f.id)"><Trash2 class="size-4" /></Button>
        </li>
      </ul>
      <p class="mt-2 text-[13px] text-muted-foreground">{{ t('Removing a folder only removes it from Mohhey. Your files are never touched.') }}</p>

      <div v-if="library.scan && library.scan.state !== 'idle'" class="mt-4 rounded-2xl bg-card p-5 shadow-card" role="status">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">{{ t(library.scan.state === 'scanning' ? 'Scanning your library' : library.scan.state === 'done' ? 'Last scan finished' : 'Scan stopped') }}</span>
          <span class="tabular text-muted-foreground">{{ nf(library.scan.processed) }} / {{ nf(library.scan.discovered) }}</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"><div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${library.scan.discovered ? (library.scan.processed / library.scan.discovered) * 100 : 0}%` }" /></div>
        <p class="mt-3 text-[13px] text-muted-foreground">{{ t('{added} added · {updated} updated · {removed} missing · {failed} couldn’t be read', { added: nf(library.scan.added), updated: nf(library.scan.updated), removed: nf(library.scan.removed), failed: nf(library.scan.failed) }) }}</p>
        <details v-if="library.scan.errors.length" class="mt-3">
          <summary class="flex cursor-pointer items-center gap-2 text-sm font-medium text-destructive"><TriangleAlert class="size-4" />{{ locale === 'fa' ? t('Problems — show details') + ' (' + nf(library.scan.errors.length) + ')' : `${library.scan.errors.length} problem${library.scan.errors.length === 1 ? '' : 's'} — show details` }}</summary>
          <ul class="mt-2 max-h-48 space-y-2 overflow-y-auto text-[13px]">
            <li v-for="e in library.scan.errors" :key="e.path + e.message"><div class="truncate font-medium" :title="e.path">{{ e.path || t('Scan') }}</div><div class="text-muted-foreground">{{ t(e.message) }}</div></li>
          </ul>
          <Button variant="outline" size="sm" class="mt-3 rounded-full" :disabled="library.isScanning" @click="library.rescan()">{{ t('Try again') }}</Button>
        </details>
      </div>
    </section>

    <section v-if="tab === 'appearance'" id="panel-appearance" role="tabpanel" aria-labelledby="tab-appearance" class="mt-6">
      <h2 id="s-look" class="mb-3 text-2xl font-medium">{{ t('Appearance') }}</h2>
      <div class="inline-flex rounded-full bg-foreground/[0.06] p-1" role="radiogroup" :aria-label="t('Theme')">
        <button
          v-for="th in themes" :key="th.id" role="radio" :aria-checked="ui.theme === th.id"
          :class="cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors', ui.theme === th.id && 'bg-card text-foreground shadow-card')"
          @click="setTheme(th.id)"
        ><component :is="th.icon" class="size-4" />{{ t(th.label) }}</button>
      </div>
    </section>

    <section v-if="tab === 'appearance'" class="mt-10" aria-labelledby="s-lang">
      <h2 id="s-lang" class="mb-3 text-2xl font-medium">{{ t('Language') }}</h2>
      <div class="inline-flex rounded-full bg-foreground/[0.06] p-1" role="radiogroup" :aria-label="t('Language')">
        <button
          v-for="l in languages" :key="l.id" role="radio" :aria-checked="locale === l.id" :lang="l.id"
          :class="cn('rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors', locale === l.id && 'bg-card text-foreground shadow-card')"
          @click="chooseLanguage(l.id)"
        >{{ l.label }}</button>
      </div>
    </section>

    <section v-if="tab === 'playback'" id="panel-playback" role="tabpanel" aria-labelledby="tab-playback" class="mt-6">
      <h2 id="s-play" class="mb-3 text-2xl font-medium">{{ t('Playback & privacy') }}</h2>
      <ul class="divide-y overflow-hidden rounded-2xl bg-card shadow-card">
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">{{ t('Remember my queue') }}</div><div class="text-sm text-muted-foreground">{{ t('Pick up where you left off after restarting.') }}</div></div>
          <button role="switch" :aria-checked="restoreQueue" :aria-label="t('Remember my queue')" :class="switchCls(restoreQueue)" @click="toggle('restoreQueue')"><span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="restoreQueue ? 'start-[22px]' : 'start-0.5'" /></button>
        </li>
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">{{ t('Keep play history') }}</div><div class="text-sm text-muted-foreground">{{ t('Powers “Recently played”. Stored only on this computer.') }}</div></div>
          <button role="switch" :aria-checked="recordHistory" :aria-label="t('Keep play history')" :class="switchCls(recordHistory)" @click="toggle('recordHistory')"><span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="recordHistory ? 'start-[22px]' : 'start-0.5'" /></button>
        </li>
        <li class="flex items-center justify-between gap-6 px-5 py-4">
          <div><div class="text-[15px] font-medium">{{ t('Artwork cache') }}</div><div class="text-sm text-muted-foreground">{{ cache ? `${plural(cache.files, 'image')} · ${mb(cache.bytes)}` : '…' }}</div></div>
          <Button variant="outline" class="rounded-full" :disabled="library.isScanning" @click="clearCache">{{ t('Clear & rebuild') }}</Button>
        </li>
      </ul>
    </section>

    <section v-if="tab === 'shortcuts'" id="panel-shortcuts" role="tabpanel" aria-labelledby="tab-shortcuts" class="mt-6">
      <h2 id="s-keys" class="mb-3 text-2xl font-medium">{{ t('Keyboard shortcuts') }}</h2>
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl bg-card p-5 text-sm shadow-card">
        <template v-for="[k, v] in [['Space', 'Play / pause'], ['Ctrl + → / ←', 'Next / previous track'], ['Ctrl + ↑ / ↓', 'Volume up / down'], ['M', 'Mute'], ['Q', 'Show or hide queue'], ['Ctrl + B', 'Collapse or expand the sidebar'], ['Ctrl + Shift + M', 'Mini player (always on top)'], ['Ctrl + K  or  /', 'Search'], ['Alt + ↑ / ↓', 'Move item in queue or playlist']]" :key="k">
          <dt><kbd class="rounded-md bg-foreground/[0.07] px-2 py-1 font-mono text-xs">{{ k }}</kbd></dt><dd class="py-1 text-muted-foreground">{{ t(v) }}</dd>
        </template>
      </dl>
    </section>
  </div>
</template>

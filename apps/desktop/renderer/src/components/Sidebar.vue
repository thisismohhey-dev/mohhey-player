<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Disc3, Heart, House, ListMusic, Mic2, Music, Plus, Settings } from 'lucide-vue-next'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/stores/library'
import { promptText } from '@/composables/usePrompt'

const library = useLibraryStore()
const route = useRoute()
const router = useRouter()
const isMac = window.mohhey.platform === 'darwin'

const nav = [
  { name: 'home', label: t('nav.home'), icon: House },
  { name: 'songs', label: t('nav.songs'), icon: Music },
  { name: 'albums', label: t('nav.albums'), icon: Disc3 },
  { name: 'artists', label: t('nav.artists'), icon: Mic2 },
  { name: 'favorites', label: t('nav.favorites'), icon: Heart },
] as const

const scanPct = computed(() => {
  const s = library.scan
  return s && s.discovered ? Math.min(100, Math.round((s.processed / s.discovered) * 100)) : 0
})

const link = (active: boolean) => cn(
  'flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground',
  active && 'bg-foreground/[0.07] text-foreground',
)

async function newPlaylist(): Promise<void> {
  const name = await promptText({ title: 'New playlist', label: 'Name', confirmLabel: 'Create' })
  if (!name) return
  const p = await library.createPlaylist(name)
  if (p) void router.push({ name: 'playlist', params: { id: p.id } })
}
</script>

<template>
  <aside class="relative z-10 flex w-[248px] shrink-0 flex-col border-e bg-[var(--sidebar-bg)] backdrop-blur-xl" aria-label="Sidebar">
    <div class="drag h-[var(--titlebar-h)] shrink-0" :class="isMac && 'ps-20'" />
    <div class="px-6 pb-5 pt-2">
      <div class="font-display text-[28px] font-bold leading-none tracking-tight">Mohhey<span class="text-brand">.</span></div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 pb-4" aria-label="Library">
      <ul class="space-y-0.5">
        <li v-for="n in nav" :key="n.name">
          <RouterLink :to="{ name: n.name }" custom v-slot="{ href, navigate, isActive }">
            <a :href="href" :class="link(isActive)" :aria-current="isActive ? 'page' : undefined" @click="navigate">
              <component :is="n.icon" class="size-[18px]" :stroke-width="1.8" />{{ n.label }}
            </a>
          </RouterLink>
        </li>
      </ul>

      <div class="mb-1 mt-7 flex items-center justify-between px-3">
        <RouterLink :to="{ name: 'playlists' }" class="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground">{{ t('nav.playlists') }}</RouterLink>
        <button class="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" :aria-label="t('nav.newPlaylist')" :title="t('nav.newPlaylist')" @click="newPlaylist"><Plus class="size-4" /></button>
      </div>
      <ul class="space-y-0.5">
        <li v-for="p in library.playlists" :key="p.id">
          <RouterLink :to="{ name: 'playlist', params: { id: p.id } }" custom v-slot="{ href, navigate, isActive }">
            <a :href="href" :class="link(isActive)" :aria-current="isActive ? 'page' : undefined" @click="navigate">
              <ListMusic class="size-[18px] shrink-0" :stroke-width="1.8" /><span class="truncate">{{ p.name }}</span>
            </a>
          </RouterLink>
        </li>
        <li v-if="!library.playlists.length" class="px-3 py-2 text-[13px] text-muted-foreground">{{ t('empty.playlistsTitle') }}</li>
      </ul>
    </nav>

    <div class="space-y-3 px-3 pb-4">
      <div v-if="library.isScanning" class="rounded-2xl bg-foreground/[0.05] p-3" role="status" aria-live="polite">
        <div class="mb-2 flex items-center justify-between text-xs"><span class="font-medium">Scanning library</span><span class="tabular text-muted-foreground">{{ scanPct }}%</span></div>
        <div class="h-1 overflow-hidden rounded-full bg-foreground/10"><div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${scanPct}%` }" /></div>
        <div class="mt-2 truncate text-[11px] text-muted-foreground">{{ library.scan?.currentFile ?? '' }}</div>
      </div>
      <RouterLink :to="{ name: 'settings' }" custom v-slot="{ href, navigate, isActive }">
        <a :href="href" :class="link(isActive)" :aria-current="route.name === 'settings' ? 'page' : undefined" @click="navigate">
          <Settings class="size-[18px]" :stroke-width="1.8" />{{ t('nav.settings') }}
        </a>
      </RouterLink>
    </div>
  </aside>
</template>

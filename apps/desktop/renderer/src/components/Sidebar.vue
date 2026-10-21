<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Disc3, FolderTree, Heart, House, Mic2, Music, Pencil, Plus, Settings, Trash2 } from 'lucide-vue-next'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { usePlaylistActions } from '@/composables/usePlaylistActions'
import { nf, t } from '@/lib/i18n'
import { iconFor } from '@/lib/playlistIcons'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'

const library = useLibraryStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const actions = usePlaylistActions()
const isMac = window.mohhey.platform === 'darwin'
const collapsed = computed(() => ui.sidebarCollapsed)

const nav = computed(() => [
  { name: 'home', label: t('nav.home'), icon: House },
  { name: 'songs', label: t('nav.songs'), icon: Music },
  { name: 'albums', label: t('nav.albums'), icon: Disc3 },
  { name: 'artists', label: t('nav.artists'), icon: Mic2 },
  { name: 'folders', label: t('nav.folders'), icon: FolderTree },
  { name: 'favorites', label: t('nav.favorites'), icon: Heart },
] as const)

const scanPct = computed(() => {
  const s = library.scan
  return s && s.discovered ? Math.min(100, Math.round((s.processed / s.discovered) * 100)) : 0
})

const link = (active: boolean) => cn(
  'flex items-center rounded-xl text-[14px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground',
  collapsed.value ? 'size-11 justify-center' : 'gap-3 px-3 py-2',
  active && 'bg-foreground/[0.07] text-foreground',
)

async function newPlaylist(): Promise<void> {
  const p = await actions.create()
  if (p) void router.push({ name: 'playlist', params: { id: p.id } })
}
const openedPlaylist = computed(() => (route.name === 'playlist' ? Number(route.params.id) : undefined))
</script>

<template>
  <aside
    class="relative z-10 flex shrink-0 flex-col border-e bg-[var(--sidebar-bg)] backdrop-blur-xl transition-[width] duration-200"
    :class="collapsed ? 'w-[76px]' : 'w-[248px]'" :aria-label="t('Sidebar')"
  >
    <div class="drag h-[var(--titlebar-h)] shrink-0" :class="isMac && !collapsed && 'pl-20'" />
    <div class="pb-5 pt-2" :class="collapsed ? 'text-center' : 'px-6'">
      <BrandMark :size="collapsed ? 30 : 40" />
    </div>

    <nav class="flex-1 overflow-y-auto overflow-x-hidden pb-4" :class="collapsed ? 'flex flex-col items-center px-2' : 'px-3'" :aria-label="t('Library')">
      <ul class="space-y-0.5" :class="collapsed && 'flex flex-col items-center'">
        <li v-for="n in nav" :key="n.name">
          <RouterLink :to="{ name: n.name }" custom v-slot="{ href, navigate, isActive }">
            <a :href="href" :class="link(isActive)" :title="collapsed ? n.label : undefined" :aria-label="n.label" :aria-current="isActive ? 'page' : undefined" @click="navigate">
              <component :is="n.icon" class="size-[18px] shrink-0" :stroke-width="1.8" /><span v-if="!collapsed">{{ n.label }}</span>
            </a>
          </RouterLink>
        </li>
      </ul>

      <div class="mb-1 mt-7 flex items-center" :class="collapsed ? 'justify-center' : 'justify-between px-3'">
        <RouterLink v-if="!collapsed" :to="{ name: 'playlists' }" class="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground">{{ t('nav.playlists') }}</RouterLink>
        <button class="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" :aria-label="t('nav.newPlaylist')" :title="t('nav.newPlaylist')" @click="newPlaylist"><Plus class="size-4" /></button>
      </div>
      <ul class="space-y-0.5" :class="collapsed && 'flex flex-col items-center'">
        <li v-for="p in library.playlists" :key="p.id" class="group/pl relative">
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <div>
                <RouterLink :to="{ name: 'playlist', params: { id: p.id } }" custom v-slot="{ href, navigate, isActive }">
                  <a :href="href" :class="link(isActive)" :title="collapsed ? p.name : undefined" :aria-label="p.name" :aria-current="isActive ? 'page' : undefined" @click="navigate">
                    <component :is="iconFor(p.icon)" class="size-[18px] shrink-0" :stroke-width="1.8" />
                    <span v-if="!collapsed" dir="auto" class="min-w-0 flex-1 truncate">{{ p.name }}</span>
                  </a>
                </RouterLink>
                <button
                  v-if="!collapsed"
                  class="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover/pl:opacity-100"
                  :aria-label="t('Edit playlist')" :title="t('Edit playlist')" @click.stop.prevent="actions.edit(p)"
                ><Pencil class="size-3.5" /></button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent class="w-48 rounded-2xl p-1.5 shadow-float">
              <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="actions.edit(p)"><Pencil class="size-4" />{{ t('Edit playlist') }}</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" class="gap-2.5 rounded-lg py-2" @select="actions.remove(p, openedPlaylist)"><Trash2 class="size-4" />{{ t('Delete playlist') }}</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </li>
        <li v-if="!library.playlists.length && !collapsed" class="px-3 py-2 text-[13px] text-muted-foreground">{{ t('empty.playlistsTitle') }}</li>
      </ul>
    </nav>

    <div class="space-y-3 pb-4" :class="collapsed ? 'flex flex-col items-center px-2' : 'px-3'">
      <div v-if="library.isScanning && !collapsed" class="rounded-2xl bg-foreground/[0.05] p-3" role="status" aria-live="polite">
        <div class="mb-2 flex items-center justify-between text-xs"><span class="font-medium">{{ t('Scanning library') }}</span><span class="tabular text-muted-foreground">{{ nf(scanPct) }}%</span></div>
        <div class="h-1 overflow-hidden rounded-full bg-foreground/10"><div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${scanPct}%` }" /></div>
        <div class="mt-2 truncate text-[11px] text-muted-foreground">{{ library.scan?.currentFile ?? '' }}</div>
      </div>
      <div v-else-if="library.isScanning" class="size-2 animate-pulse rounded-full bg-brand" role="status" :aria-label="t('Scanning library')" :title="`${t('Scanning library')} ${nf(scanPct)}%`" />
      <RouterLink :to="{ name: 'settings' }" custom v-slot="{ href, navigate, isActive }">
        <a :href="href" :class="link(isActive)" :title="collapsed ? t('Settings') : undefined" :aria-label="t('Settings')" :aria-current="isActive ? 'page' : undefined" @click="navigate">
          <Settings class="size-[18px] shrink-0" :stroke-width="1.8" /><span v-if="!collapsed">{{ t('Settings') }}</span>
        </a>
      </RouterLink>
    </div>
  </aside>
</template>

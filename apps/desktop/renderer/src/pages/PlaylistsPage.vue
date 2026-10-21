<script setup lang="ts">
import { ListMusic, Plus } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { usePlaylistActions } from '@/composables/usePlaylistActions'
import { api } from '@/lib/api'
import { formatLong, plural } from '@/lib/format'
import { t } from '@/lib/i18n'
import { iconFor } from '@/lib/playlistIcons'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import EmptyState from '@/components/EmptyState.vue'
import MediaCard from '@/components/MediaCard.vue'

const library = useLibraryStore()
const player = usePlayerStore()
const router = useRouter()
const actions = usePlaylistActions()

async function create(): Promise<void> {
  const p = await actions.create()
  if (p) void router.push({ name: 'playlist', params: { id: p.id } })
}
async function play(id: number): Promise<void> {
  const tracks = await api.playlists.tracks(id)
  if (tracks.length) player.playTracks(tracks, 0)
}
</script>

<template>
  <header class="flex items-end justify-between gap-4 px-8 pb-4 pt-6">
    <div>
      <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">{{ t('Playlists') }}</h1>
      <p class="mt-3 text-[15px] text-muted-foreground">{{ plural(library.playlists.length, 'playlist') }}</p>
    </div>
    <Button class="h-11 rounded-full px-5" @click="create"><Plus class="size-4" />{{ t('nav.newPlaylist') }}</Button>
  </header>
  <EmptyState v-if="!library.playlists.length" :icon="ListMusic" :title="t('empty.playlistsTitle')" :body="t('empty.playlistsBody')">
    <Button class="rounded-full" @click="create"><Plus class="size-4" />{{ t('nav.newPlaylist') }}</Button>
  </EmptyState>
  <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-x-2 gap-y-3 px-6">
    <MediaCard
      v-for="p in library.playlists" :key="p.id" :to="{ name: 'playlist', params: { id: p.id } }" :title="p.name"
      :subtitle="`${plural(p.trackCount, 'song')}${p.durationMs ? ' · ' + formatLong(p.durationMs) : ''}`" :mosaic="p.coverHashes" :icon="iconFor(p.icon)"
      :play-label="p.trackCount ? t('Play {title}', { title: p.name }) : undefined" @play="play(p.id)"
    />
  </div>
</template>

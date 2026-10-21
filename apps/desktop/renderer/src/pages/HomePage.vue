<script setup lang="ts">
import { computed } from 'vue'
import { Clock } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { greeting, plural } from '@/lib/format'
import { t } from '@/lib/i18n'
import { useLoader } from '@/composables/useLoader'
import { arraySource } from '@/composables/usePagedTracks'
import ErrorState from '@/components/ErrorState.vue'
import MediaCard from '@/components/MediaCard.vue'
import Shelf from '@/components/Shelf.vue'
import TrackList from '@/components/TrackList.vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const { data, loading, error, reload } = useLoader(async () => {
  const [recent, added, albums] = await Promise.all([
    api.tracks.list({ recent: 'true', limit: 6 }),
    api.tracks.list({ sort: 'added', dir: 'desc', limit: 6 }),
    api.albums.list(undefined, 12),
  ])
  return { recent, added, albums }
})
const recent = computed(() => arraySource(data.value?.recent.items ?? []))
const added = computed(() => arraySource(data.value?.added.items ?? []))

async function playAlbum(id: number): Promise<void> {
  const res = await api.tracks.list({ albumId: id, sort: 'album', limit: 500 })
  player.playTracks(res.items, 0)
}
</script>

<template>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <div v-else>
    <header class="px-8 pb-2 pt-6">
      <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }}</p>
      <h1 class="mt-3 text-[clamp(3rem,7vw,6rem)] font-medium leading-[0.95]">{{ greeting() }}</h1>
      <p v-if="data" class="mt-4 text-[15px] text-muted-foreground">{{ plural(data.added.total, 'song') }} · {{ plural(data.albums.total, 'album') }}</p>
    </header>

    <div v-if="loading" class="px-8 pt-10" aria-busy="true">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-4"><div v-for="i in 6" :key="i" class="aspect-square animate-pulse rounded-2xl bg-foreground/6" /></div>
    </div>
    <template v-else-if="data">
      <Shelf title="Recently played">
        <TrackList v-if="data.recent.items.length" :source="recent" numbered />
        <div v-else class="flex items-center gap-4 rounded-2xl bg-card p-6 shadow-card">
          <Clock class="size-6 text-muted-foreground" :stroke-width="1.5" />
          <div><div class="font-medium">{{ t('empty.historyTitle') }}</div><div class="text-sm text-muted-foreground">{{ t('empty.historyBody') }}</div></div>
        </div>
      </Shelf>

      <Shelf v-if="data.albums.items.length" title="Albums" :to="{ name: 'albums' }">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-2 gap-y-2">
          <MediaCard
            v-for="a in data.albums.items.slice(0, 8)" :key="a.id" :to="{ name: 'album', params: { id: a.id } }"
            :title="a.title" :subtitle="a.artist || 'Unknown artist'" :hash="a.artworkHash" :play-label="`Play ${a.title}`" @play="playAlbum(a.id)"
          />
        </div>
      </Shelf>

      <Shelf v-if="data.added.items.length" title="Recently added">
        <TrackList :source="added" numbered />
      </Shelf>
    </template>
  </div>
</template>

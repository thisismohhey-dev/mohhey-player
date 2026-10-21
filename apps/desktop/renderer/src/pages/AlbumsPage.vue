<script setup lang="ts">
import { t } from '@/lib/i18n'
import { Disc3 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { useLoader } from '@/composables/useLoader'
import { usePlayerStore } from '@/stores/player'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import MediaCard from '@/components/MediaCard.vue'
import VirtualGrid from '@/components/VirtualGrid.vue'

const player = usePlayerStore()
const { data, loading, error, reload } = useLoader(() => api.albums.list(undefined, 500))
async function play(id: number): Promise<void> {
  player.playTracks((await api.tracks.list({ albumId: id, sort: 'album', limit: 500 })).items, 0)
}
</script>

<template>
  <header class="px-8 pb-4 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">{{ t('Albums') }}</h1>
    <p v-if="data" class="mt-3 text-[15px] text-muted-foreground">{{ plural(data.total, 'album') }}</p>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <div v-else-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-4 px-8" aria-busy="true"><div v-for="i in 10" :key="i" class="aspect-square animate-pulse rounded-2xl bg-foreground/6" /></div>
  <EmptyState v-else-if="!data?.items.length" :icon="Disc3" :title="t('No albums yet')" :body="t('Albums appear once your songs have album tags.')" />
  <VirtualGrid v-else :items="data.items" :key-of="(a) => a.id">
    <template #default="{ item: a }">
      <MediaCard
        :key="a.id" :to="{ name: 'album', params: { id: a.id } }" :title="a.title"
      :subtitle="[a.artist, a.year].filter(Boolean).join(' · ') || t('Unknown artist')" :hash="a.artworkHash" :play-label="t('Play {title}', { title: a.title })" @play="play(a.id)"
      />
    </template>
  </VirtualGrid>
</template>

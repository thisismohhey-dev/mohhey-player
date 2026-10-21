<script setup lang="ts">
import { Mic2 } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { useLoader } from '@/composables/useLoader'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import MediaCard from '@/components/MediaCard.vue'

const { data, loading, error, reload } = useLoader(() => api.artists.list(undefined, 500))
</script>

<template>
  <header class="px-8 pb-4 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">Artists</h1>
    <p v-if="data" class="mt-3 text-[15px] text-muted-foreground">{{ plural(data.total, 'artist') }}</p>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <div v-else-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-4 px-8" aria-busy="true"><div v-for="i in 10" :key="i" class="aspect-square animate-pulse rounded-full bg-foreground/6" /></div>
  <EmptyState v-else-if="!data?.items.length" :icon="Mic2" title="No artists yet" body="Artists appear once your songs have artist tags." />
  <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-x-2 gap-y-3 px-6">
    <MediaCard
      v-for="a in data.items" :key="a.id" :to="{ name: 'artist', params: { id: a.id } }" :title="a.name" round kind="artist"
      :subtitle="plural(a.trackCount, 'song')" :hash="a.artworkHash"
    />
  </div>
</template>

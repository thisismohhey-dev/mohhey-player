<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SearchX, Search } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLoader } from '@/composables/useLoader'
import { arraySource } from '@/composables/usePagedTracks'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import MediaCard from '@/components/MediaCard.vue'
import Shelf from '@/components/Shelf.vue'
import TrackList from '@/components/TrackList.vue'

const route = useRoute()
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const { data, loading, error, reload } = useLoader(async () => (q.value ? api.search(q.value) : null), [q])
const tracks = computed(() => arraySource(data.value?.tracks ?? []))
const empty = computed(() => !!data.value && !data.value.tracks.length && !data.value.albums.length && !data.value.artists.length)
</script>

<template>
  <header class="px-8 pb-2 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">{{ q ? `“${q}”` : 'Search' }}</h1>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <EmptyState v-else-if="!q" :icon="Search" :title="t('empty.searchStart')" :body="t('Type in the search box above. Press Ctrl+K from anywhere.')" />
  <div v-else-if="loading && !data" class="px-8 pt-8 text-muted-foreground" role="status">{{ t('Searching…') }}</div>
  <EmptyState v-else-if="empty" :icon="SearchX" :title="t('empty.searchTitle')" :body="t('empty.searchBody')" />
  <template v-else-if="data">
    <Shelf v-if="data.tracks.length" :title="t('Songs')"><TrackList :source="tracks" numbered /></Shelf>
    <Shelf v-if="data.albums.length" :title="t('Albums')">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        <MediaCard v-for="a in data.albums" :key="a.id" :to="{ name: 'album', params: { id: a.id } }" :title="a.title" :subtitle="a.artist" :hash="a.artworkHash" />
      </div>
    </Shelf>
    <Shelf v-if="data.artists.length" :title="t('Artists')">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        <MediaCard v-for="a in data.artists" :key="a.id" :to="{ name: 'artist', params: { id: a.id } }" :title="a.name" round kind="artist" :hash="a.artworkHash" />
      </div>
    </Shelf>
  </template>
</template>

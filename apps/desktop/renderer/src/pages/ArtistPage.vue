<script setup lang="ts">
import { t } from '@/lib/i18n'
import { computed } from 'vue'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { useLoader } from '@/composables/useLoader'
import { usePagedTracks } from '@/composables/usePagedTracks'
import ErrorState from '@/components/ErrorState.vue'
import MediaCard from '@/components/MediaCard.vue'
import PageHero from '@/components/PageHero.vue'
import PlayActions from '@/components/PlayActions.vue'
import Shelf from '@/components/Shelf.vue'
import TrackList from '@/components/TrackList.vue'

const props = defineProps<{ id: string }>()
const { data, error, reload } = useLoader(async () => {
  const [artist, albums] = await Promise.all([api.artists.get(Number(props.id)), api.albums.list(undefined, 500)])
  return { artist, albums }
}, [() => props.id])
const artistId = computed(() => Number(props.id))
const { source, total } = usePagedTracks(() => ({ artistId: artistId.value, sort: 'album' as const }))
const albums = computed(() => data.value?.albums.items.filter((a) => a.artist === data.value?.artist.name) ?? [])
</script>

<template>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <template v-else-if="data">
    <PageHero :title="data.artist.name" :eyebrow="t('Artist')" round kind="artist" :hash="data.artist.artworkHash" :meta="`${plural(data.artist.trackCount, 'song')} · ${plural(data.artist.albumCount, 'album')}`">
      <template #actions><PlayActions :load="source.all" :disabled="!total" /></template>
    </PageHero>
    <Shelf v-if="albums.length" :title="t('Albums')">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        <MediaCard v-for="a in albums" :key="a.id" :to="{ name: 'album', params: { id: a.id } }" :title="a.title" :subtitle="String(a.year ?? '')" :hash="a.artworkHash" />
      </div>
    </Shelf>
    <Shelf :title="t('Songs')"><TrackList :source="source" numbered /></Shelf>
  </template>
</template>

<script setup lang="ts">
import { t } from '@/lib/i18n'
import { computed } from 'vue'
import { api } from '@/lib/api'
import { formatLong, plural } from '@/lib/format'
import { useLoader } from '@/composables/useLoader'
import { arraySource } from '@/composables/usePagedTracks'
import ErrorState from '@/components/ErrorState.vue'
import PageHero from '@/components/PageHero.vue'
import PlayActions from '@/components/PlayActions.vue'
import TrackList from '@/components/TrackList.vue'

const props = defineProps<{ id: string }>()
const { data, error, reload } = useLoader(async () => {
  const id = Number(props.id)
  const [album, tracks] = await Promise.all([api.albums.get(id), api.tracks.list({ albumId: id, sort: 'album', limit: 500 })])
  return { album, tracks: tracks.items }
}, [() => props.id])
const source = computed(() => arraySource(data.value?.tracks ?? []))
</script>

<template>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <template v-else-if="data">
    <PageHero
      :title="data.album.title" :eyebrow="t('Album')" :hash="data.album.artworkHash"
      :meta="[data.album.artist, data.album.year, plural(data.album.trackCount, 'song'), formatLong(data.album.durationMs)].filter(Boolean).join(' · ')"
    >
      <template #actions><PlayActions :load="source.all" /></template>
    </PageHero>
    <div class="px-4"><TrackList :source="source" /></div>
  </template>
</template>

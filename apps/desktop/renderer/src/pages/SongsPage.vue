<script setup lang="ts">
import { computed, ref } from 'vue'
import { Music } from 'lucide-vue-next'
import type { TrackSort } from '@mohhey/contracts'
import { Input } from '@/components/ui/input'
import { usePagedTracks } from '@/composables/usePagedTracks'
import { plural } from '@/lib/format'
import { t } from '@/lib/i18n'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PlayActions from '@/components/PlayActions.vue'
import TrackList from '@/components/TrackList.vue'

const sort = ref<TrackSort>('title')
const dir = ref<'asc' | 'desc'>('asc')
const filter = ref('')
const query = computed(() => ({ sort: sort.value, dir: dir.value, q: filter.value.trim() || undefined }))
const { source, total, loading, error, reload } = usePagedTracks(() => query.value)

function setSort(s: TrackSort): void {
  if (sort.value === s) dir.value = dir.value === 'asc' ? 'desc' : 'asc'
  else { sort.value = s; dir.value = 'asc' }
}
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4 px-8 pb-4 pt-6">
    <div>
      <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">Songs</h1>
      <p class="mt-3 text-[15px] text-muted-foreground">{{ plural(total, 'song') }}</p>
    </div>
    <div class="flex items-center gap-3">
      <Input v-model="filter" placeholder="Filter songs" aria-label="Filter songs" class="h-10 w-56 rounded-full bg-card" />
      <PlayActions :load="source.all" :disabled="!total" />
    </div>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <EmptyState v-else-if="!loading && !total" :icon="Music" :title="filter ? t('empty.searchTitle') : t('empty.songsTitle')" :body="filter ? t('empty.searchBody') : t('empty.songsBody')" />
  <div v-else class="px-4"><TrackList :source="source" :sort="sort" :dir="dir" sortable @sort="setSort" /></div>
</template>

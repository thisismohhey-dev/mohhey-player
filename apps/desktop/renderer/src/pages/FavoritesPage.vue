<script setup lang="ts">
import { Heart } from 'lucide-vue-next'
import { usePagedTracks } from '@/composables/usePagedTracks'
import { plural } from '@/lib/format'
import { t } from '@/lib/i18n'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PlayActions from '@/components/PlayActions.vue'
import TrackList from '@/components/TrackList.vue'

const { source, total, loading, error, reload } = usePagedTracks(() => ({ favorite: 'true' as const, sort: 'added' as const, dir: 'desc' as const }))
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4 px-8 pb-4 pt-6">
    <div>
      <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">Favorites</h1>
      <p class="mt-3 text-[15px] text-muted-foreground">{{ plural(total, 'song') }}</p>
    </div>
    <div class="flex items-center gap-3"><PlayActions :load="source.all" :disabled="!total" /></div>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <EmptyState v-else-if="!loading && !total" :icon="Heart" :title="t('empty.favoritesTitle')" :body="t('empty.favoritesBody')" />
  <div v-else class="px-4"><TrackList :source="source" numbered /></div>
</template>

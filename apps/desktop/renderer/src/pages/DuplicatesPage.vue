<script setup lang="ts">
import { CopyCheck, Play } from 'lucide-vue-next'
import type { DuplicateGroup } from '@mohhey/contracts'
import { api } from '@/lib/api'
import { formatTime } from '@/lib/format'
import { digits, nf, t } from '@/lib/i18n'
import { useLoader } from '@/composables/useLoader'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import Cover from '@/components/Cover.vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const { data, loading, error, reload } = useLoader(() => api.library.duplicates())
const mb = (bytes: number) => digits(`${(bytes / 1024 / 1024).toFixed(1)} MB`)
const why = (g: DuplicateGroup) => (g.reason === 'identical' ? t('Identical files') : t('Same song, different files'))
const hint = (g: DuplicateGroup) =>
  g.reason === 'identical' ? t('These files have exactly the same content.') : t('Same title, artist, album and length, but the files differ (another rip, bitrate or format).')
</script>

<template>
  <header class="px-8 pb-4 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">{{ t('Duplicates') }}</h1>
    <p class="mt-3 max-w-2xl text-[15px] text-muted-foreground">{{ t('M. Player never deletes your files. Use this list to decide what to clean up yourself.') }}</p>
  </header>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <div v-else-if="loading" class="px-8 text-muted-foreground" role="status">{{ t('Loading…') }}</div>
  <EmptyState v-else-if="!data?.length" :icon="CopyCheck" :title="t('No duplicates found')" :body="t('Every song in your library appears only once.')" />
  <div v-else class="space-y-5 px-8 pb-6">
    <section v-for="(g, i) in data" :key="i" class="overflow-hidden rounded-2xl bg-card shadow-card" :aria-label="why(g)">
      <header class="border-b px-5 py-3">
        <h2 class="text-[15px] font-medium">{{ why(g) }} <span class="text-muted-foreground">· {{ nf(g.tracks.length) }}</span></h2>
        <p class="text-[13px] text-muted-foreground">{{ hint(g) }}</p>
      </header>
      <ul class="divide-y">
        <li v-for="tr in g.tracks" :key="tr.id" class="flex items-center gap-3 px-5 py-3">
          <Cover :size="96" :hash="tr.artworkHash" :seed="tr.album || tr.title" class="size-10 shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1">
            <div dir="auto" class="truncate text-[14px] font-medium">{{ tr.title }}</div>
            <div dir="ltr" class="truncate text-start text-[12px] text-muted-foreground" :title="tr.folder">{{ tr.folder }}</div>
          </div>
          <div class="hidden shrink-0 text-end text-[12px] tabular text-muted-foreground sm:block">
            <div>{{ tr.format.toUpperCase() }}<template v-if="tr.bitrate"> · {{ digits(String(tr.bitrate)) }} kbps</template></div>
            <div>{{ mb(tr.sizeBytes) }} · {{ formatTime(tr.durationMs) }}</div>
          </div>
          <button class="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" :aria-label="t('Play {title}', { title: tr.title })" @click="player.playTracks([tr])">
            <Play class="size-4 fill-current" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

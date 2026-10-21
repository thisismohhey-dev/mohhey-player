<script setup lang="ts">
import { Heart, ListMusic, Maximize2, PictureInPicture2, TriangleAlert } from 'lucide-vue-next'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import Cover from './Cover.vue'
import SeekBar from './SeekBar.vue'
import TransportControls from './TransportControls.vue'
import VolumeControl from './VolumeControl.vue'

const player = usePlayerStore()
const ui = useUiStore()
</script>

<template>
  <footer class="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 pb-5">
    <div
      role="region" :aria-label="t('Player')"
      class="pointer-events-auto mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 rounded-[28px] border bg-card/90 px-4 py-3 shadow-float backdrop-blur-xl @container lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
    >
      <!-- track info -->
      <div class="flex min-w-0 items-center gap-3">
        <button
          class="group relative shrink-0 rounded-xl" :disabled="!player.current" :aria-label="t('player.nowPlaying')"
          data-action="now-playing-open" @click="ui.nowPlayingOpen = true"
        >
          <Cover :hash="player.current?.artworkHash" :seed="player.current?.album || player.current?.title" class="size-14 rounded-xl shadow-card" />
          <span v-if="player.current" class="absolute inset-0 grid place-items-center rounded-xl bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 class="size-4" /></span>
        </button>
        <div class="min-w-0 flex-1">
          <template v-if="player.current">
            <div dir="auto" class="truncate text-[15px] font-medium leading-tight" :title="player.current.title">{{ player.current.title }}</div>
            <div dir="auto" v-if="player.errorMessage" class="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-destructive" role="alert">
              <TriangleAlert class="size-3.5 shrink-0" /><span class="truncate">{{ player.errorMessage }}</span>
            </div>
            <div dir="auto" v-else class="truncate text-[13px] text-muted-foreground">{{ player.current.artist || t('Unknown artist') }}</div>
          </template>
          <div v-else class="text-[14px] text-muted-foreground">{{ t('player.nothingPlaying') }}</div>
        </div>
        <button
          v-if="player.current"
          :class="cn('grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-foreground/8', player.current.favorite ? 'text-brand' : 'text-muted-foreground hover:text-foreground')"
          :aria-label="player.current.favorite ? t('player.unfavorite') : t('player.favorite')" :aria-pressed="player.current.favorite"
          @click="player.toggleFavorite(player.current)"
        ><Heart class="size-[18px]" :class="player.current.favorite && 'fill-current'" /></button>
      </div>

      <!-- transport + seek -->
      <div class="order-last col-span-2 flex flex-col items-stretch gap-1 lg:order-none lg:col-span-1">
        <div class="hidden lg:block"><TransportControls /></div>
        <SeekBar />
      </div>

      <!-- right: compact transport (small widths), queue, volume -->
      <div class="flex items-center justify-end gap-1">
        <div class="lg:hidden"><TransportControls /></div>
        <div class="hidden xl:block"><VolumeControl /></div>
        <button
          class="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
          :aria-label="t('Mini player')" :title="t('Mini player (Ctrl+Shift+M)')" data-action="mini-enter" @click="ui.setMiniMode(true)"
        ><PictureInPicture2 class="size-5" /></button>
        <button
          :class="cn('grid size-10 place-items-center rounded-full transition-colors hover:bg-foreground/8', ui.queueOpen ? 'bg-foreground/8 text-brand' : 'text-muted-foreground hover:text-foreground')"
          :aria-label="t('player.queue')" :aria-pressed="ui.queueOpen" :title="t('player.queue')" data-action="queue-toggle" @click="ui.queueOpen = !ui.queueOpen"
        ><ListMusic class="size-5" /></button>
      </div>
    </div>
  </footer>
</template>

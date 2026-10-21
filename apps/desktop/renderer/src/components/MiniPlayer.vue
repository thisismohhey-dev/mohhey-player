<script setup lang="ts">
import { computed } from 'vue'
import { Heart, Loader2, Maximize2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-vue-next'
import type { WindowControl } from '@mohhey/contracts'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import Cover from './Cover.vue'
import SeekBar from './SeekBar.vue'

const player = usePlayerStore()
const ui = useUiStore()
const busy = computed(() => (player.status === 'loading' || player.status === 'buffering') && !player.isPlaying)
const control = (action: WindowControl) => window.mohhey.windowControl(action)

const btn = 'no-drag grid place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-35'
const chip = 'no-drag grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground'
</script>

<template>
  <div dir="ltr" class="drag flex h-full items-center gap-3 bg-card px-3" role="region" :aria-label="t('Mini player')">
    <Cover :hash="player.current?.artworkHash" :seed="player.current?.album || player.current?.title" class="size-[76px] shrink-0 rounded-xl shadow-card" />

    <div class="flex min-w-0 flex-1 flex-col justify-between self-stretch py-2">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <div v-if="player.current" dir="auto" class="truncate text-[14px] font-medium leading-tight" :title="player.current.title">{{ player.current.title }}</div>
          <div v-else class="text-[13px] text-muted-foreground">{{ t('player.nothingPlaying') }}</div>
          <div v-if="player.errorMessage" class="truncate text-[11px] text-destructive" role="alert">{{ player.errorMessage }}</div>
          <div v-else-if="player.current" dir="auto" class="truncate text-[12px] text-muted-foreground">{{ player.current.artist || t('Unknown artist') }}</div>
        </div>
        <!-- small custom window buttons (the OS ones are not used in this window) -->
        <div dir="ltr" class="no-drag -mr-1 -mt-0.5 flex shrink-0 items-center gap-0.5">
          <button :class="chip" :aria-label="t('Back to full player')" :title="t('Back to full player')" data-action="mini-exit" @click="ui.setMiniMode(false)"><Maximize2 class="size-3" :stroke-width="2" /></button>
          <button :class="cn(chip, 'hover:bg-destructive/15 hover:text-destructive')" :aria-label="t('Close')" :title="t('Close')" @click="control('close')"><X class="size-3" :stroke-width="2" /></button>
        </div>
      </div>

      <div class="space-y-0">
        <div dir="ltr" class="flex items-center gap-0.5">
          <button :class="cn(btn, 'size-7')" :aria-label="t('player.previous')" :title="t('player.previous')" :disabled="!player.hasTrack" @click="player.previous()"><SkipBack class="size-3.5 fill-current" /></button>
          <button
            class="no-drag grid size-8 place-items-center rounded-full bg-foreground text-background shadow-card transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
            :aria-label="player.isPlaying ? t('player.pause') : t('player.play')" :title="player.isPlaying ? t('player.pause') : t('player.play')" :disabled="!player.hasTrack" @click="player.togglePlay()"
          >
            <Loader2 v-if="busy" class="size-3.5 animate-spin" /><Pause v-else-if="player.isPlaying" class="size-3.5 fill-current" /><Play v-else class="size-3.5 translate-x-px fill-current" />
          </button>
          <button :class="cn(btn, 'size-7')" :aria-label="t('player.next')" :title="t('player.next')" :disabled="!player.hasTrack" @click="player.next()"><SkipForward class="size-3.5 fill-current" /></button>
          <button
            v-if="player.current" :class="cn(btn, 'ml-1 size-7', player.current.favorite && 'text-brand hover:text-brand')"
            :aria-label="player.current.favorite ? t('player.unfavorite') : t('player.favorite')" :aria-pressed="player.current.favorite" @click="player.toggleFavorite(player.current)"
          ><Heart class="size-3.5" :class="player.current.favorite && 'fill-current'" /></button>
        </div>
        <div class="no-drag [&_span]:text-[11px]"><SeekBar /></div>
      </div>
    </div>
  </div>
</template>

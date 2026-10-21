<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, Maximize2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-vue-next'
import type { WindowControl } from '@mohhey/contracts'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import Cover from './Cover.vue'
import Scrubber from './Scrubber.vue'

const player = usePlayerStore()
const ui = useUiStore()
const busy = computed(() => (player.status === 'loading' || player.status === 'buffering') && !player.isPlaying)
const duration = computed(() => player.durationMs || player.current?.durationMs || 0)
const fraction = computed(() => (duration.value ? player.positionMs / duration.value : 0))
const control = (action: WindowControl) => window.mohhey.windowControl(action)

const skip = 'no-drag grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-35'
const chip = 'no-drag grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground'
</script>

<template>
  <div class="drag group/mini relative flex h-full items-center gap-3 overflow-hidden bg-card px-3" role="region" :aria-label="t('Mini player')">
    <Cover :hash="player.current?.artworkHash" :seed="player.current?.album || player.current?.title" class="size-[60px] shrink-0 rounded-lg" />

    <div class="min-w-0 flex-1">
      <div v-if="player.current" dir="auto" class="truncate text-[14px] font-medium leading-tight" :title="player.current.title">{{ player.current.title }}</div>
      <div v-else class="text-[13px] text-muted-foreground">{{ t('player.nothingPlaying') }}</div>
      <div v-if="player.errorMessage" class="truncate text-[11px] text-destructive" role="alert">{{ player.errorMessage }}</div>
      <div v-else-if="player.current" dir="auto" class="truncate text-[12px] text-muted-foreground">{{ player.current.artist || t('Unknown artist') }}</div>
    </div>

    <div dir="ltr" class="flex shrink-0 items-center">
      <button :class="skip" :aria-label="t('player.previous')" :title="t('player.previous')" :disabled="!player.hasTrack" @click="player.previous()"><SkipBack class="size-3.5 fill-current" /></button>
      <button
        class="no-drag grid size-9 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
        :aria-label="player.isPlaying ? t('player.pause') : t('player.play')" :title="player.isPlaying ? t('player.pause') : t('player.play')" :disabled="!player.hasTrack" @click="player.togglePlay()"
      >
        <Loader2 v-if="busy" class="size-4 animate-spin" /><Pause v-else-if="player.isPlaying" class="size-4 fill-current" /><Play v-else class="size-4 translate-x-px fill-current" />
      </button>
      <button :class="skip" :aria-label="t('player.next')" :title="t('player.next')" :disabled="!player.hasTrack" @click="player.next()"><SkipForward class="size-3.5 fill-current" /></button>
    </div>

    <!-- window actions stay out of the way until the pointer is over the player -->
    <div dir="ltr" class="absolute right-1.5 top-1.5 flex gap-0.5 rounded-md bg-card/85 opacity-0 backdrop-blur transition-opacity focus-within:opacity-100 group-hover/mini:opacity-100">
      <button :class="chip" :aria-label="t('Back to full player')" :title="t('Back to full player')" data-action="mini-exit" @click="ui.setMiniMode(false)"><Maximize2 class="size-3" :stroke-width="2" /></button>
      <button :class="cn(chip, 'hover:bg-destructive/15 hover:text-destructive')" :aria-label="t('Close')" :title="t('Close')" @click="control('close')"><X class="size-3" :stroke-width="2" /></button>
    </div>

    <!-- hairline progress along the bottom edge; draggable -->
    <div dir="ltr" class="no-drag absolute inset-x-0 bottom-0">
      <Scrubber
        size="sm" class="h-3 [&>div:first-child]:h-[3px] [&>div:first-child]:rounded-none" :value="fraction" :label="t('player.seek')"
        :disabled="!player.hasTrack || !duration" :step="duration ? Math.min(0.1, 5000 / duration) : 0.02" @commit="player.seek($event * duration)"
      />
    </div>
  </div>
</template>

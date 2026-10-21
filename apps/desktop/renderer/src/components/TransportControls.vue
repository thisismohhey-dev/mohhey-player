<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-vue-next'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'

withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })
const player = usePlayerStore()
const busy = computed(() => player.status === 'loading' || player.status === 'buffering')
const repeatLabel = computed(() => ({ off: t('player.repeatOff'), all: t('player.repeatAll'), one: t('player.repeatOne') })[player.repeat])
const side = 'grid place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-35'
</script>

<template>
  <div class="flex items-center justify-center" :class="size === 'lg' ? 'gap-5' : 'gap-3'">
    <button :class="cn(side, 'size-9', player.shuffle && 'text-brand hover:text-brand')" :aria-label="t('player.shuffle')" :aria-pressed="player.shuffle" :title="t('player.shuffle')" @click="player.toggleShuffle()">
      <Shuffle class="size-[18px]" />
    </button>
    <button :class="cn(side, 'size-10')" :aria-label="t('player.previous')" :title="t('player.previous')" :disabled="!player.hasTrack" @click="player.previous()">
      <SkipBack class="size-5 fill-current" />
    </button>
    <button
      class="grid place-items-center rounded-full bg-foreground text-background shadow-card transition-transform hover:scale-[1.04] active:scale-95 disabled:pointer-events-none disabled:opacity-35"
      :class="size === 'lg' ? 'size-16' : 'size-12'"
      :aria-label="player.isPlaying ? t('player.pause') : t('player.play')" :title="player.isPlaying ? t('player.pause') : t('player.play')"
      :disabled="!player.hasTrack" @click="player.togglePlay()"
    >
      <Loader2 v-if="busy && !player.isPlaying" class="animate-spin" :class="size === 'lg' ? 'size-7' : 'size-5'" />
      <Pause v-else-if="player.isPlaying" class="fill-current" :class="size === 'lg' ? 'size-7' : 'size-5'" />
      <Play v-else class="translate-x-px fill-current" :class="size === 'lg' ? 'size-7' : 'size-5'" />
    </button>
    <button :class="cn(side, 'size-10')" :aria-label="t('player.next')" :title="t('player.next')" :disabled="!player.hasTrack" @click="player.next()">
      <SkipForward class="size-5 fill-current" />
    </button>
    <button :class="cn(side, 'size-9', player.repeat !== 'off' && 'text-brand hover:text-brand')" :aria-label="repeatLabel" :aria-pressed="player.repeat !== 'off'" :title="repeatLabel" @click="player.cycleRepeat()">
      <Repeat1 v-if="player.repeat === 'one'" class="size-[18px]" />
      <Repeat v-else class="size-[18px]" />
    </button>
  </div>
</template>

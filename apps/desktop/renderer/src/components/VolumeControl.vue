<script setup lang="ts">
import { computed } from 'vue'
import { Volume1, Volume2, VolumeX } from 'lucide-vue-next'
import { t } from '@/lib/i18n'
import { usePlayerStore } from '@/stores/player'
import Scrubber from './Scrubber.vue'

const player = usePlayerStore()
const shownVolume = computed(() => (player.muted ? 0 : player.volume))
const Icon = computed(() => (shownVolume.value === 0 ? VolumeX : shownVolume.value < 0.5 ? Volume1 : Volume2))
</script>

<template>
  <div dir="ltr" class="flex items-center gap-2">
    <button
      class="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      :aria-label="player.muted ? t('player.unmute') : t('player.mute')" :aria-pressed="player.muted" :title="player.muted ? t('player.unmute') : t('player.mute')"
      @click="player.toggleMute()"
    ><component :is="Icon" class="size-[18px]" /></button>
    <Scrubber
      class="w-24" size="sm" :value="shownVolume" :label="t('player.volume')" :value-text="`${Math.round(shownVolume * 100)}%`" :step="0.05"
      @input="player.setVolume($event)"
    />
  </div>
</template>

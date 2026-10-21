<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { usePlayerStore } from '@/stores/player'
import Scrubber from './Scrubber.vue'

const player = usePlayerStore()
const preview = ref<number | null>(null)
const duration = computed(() => player.durationMs || player.current?.durationMs || 0)
const fraction = computed(() => (duration.value ? player.positionMs / duration.value : 0))
const shown = computed(() => (preview.value !== null ? preview.value * duration.value : player.positionMs))

function commit(f: number): void {
  preview.value = null
  player.seek(f * duration.value)
}
</script>

<template>
  <div dir="ltr" class="flex w-full items-center gap-3">
    <span class="w-11 text-end text-xs tabular text-muted-foreground">{{ formatTime(shown) }}</span>
    <Scrubber
      :value="fraction" :label="t('player.seek')" :value-text="t('{a} of {b}', { a: formatTime(shown), b: formatTime(duration) })"
      :step="duration ? Math.min(0.1, 5000 / duration) : 0.02" :disabled="!player.hasTrack || !duration"
      @input="preview = $event" @commit="commit"
    />
    <span class="w-11 text-xs tabular text-muted-foreground">{{ formatTime(duration) }}</span>
  </div>
</template>

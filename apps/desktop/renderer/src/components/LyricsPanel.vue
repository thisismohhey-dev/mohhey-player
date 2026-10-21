<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Lyrics } from '@mohhey/contracts'
import { api, ApiClientError } from '@/lib/api'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const lyrics = ref<Lyrics | null>(null)
const state = ref<'loading' | 'ready' | 'none' | 'error'>('loading')
const box = ref<HTMLElement>()
let loadId = 0

watch(() => player.current?.id, async (id) => {
  const mine = ++loadId
  lyrics.value = null
  if (id === undefined) { state.value = 'none'; return }
  state.value = 'loading'
  try {
    const l = await api.tracks.lyrics(id)
    if (mine === loadId) { lyrics.value = l; state.value = 'ready' }
  } catch (e) {
    if (mine === loadId) state.value = e instanceof ApiClientError && e.status === 404 ? 'none' : 'error'
  }
}, { immediate: true })

/** Index of the line being sung: the last line whose timestamp has passed. */
const activeIndex = computed(() => {
  const l = lyrics.value
  if (!l?.synced) return -1
  let lo = 0, hi = l.lines.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((l.lines[mid]!.timeMs ?? 0) <= player.positionMs + 150) { ans = mid; lo = mid + 1 } else hi = mid - 1
  }
  return ans
})

watch(activeIndex, async (i) => {
  if (i < 0) return
  await nextTick()
  box.value?.querySelector<HTMLElement>(`[data-line="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})
</script>

<template>
  <div
    ref="box" class="relative overflow-y-auto overscroll-contain rounded-[28px] bg-white/[0.06] px-6 py-8 text-center backdrop-blur-xl"
    :aria-label="t('Lyrics')" role="region"
  >
    <p v-if="state === 'loading'" class="mt-10 text-white/60" role="status">{{ t('Loading…') }}</p>
    <div v-else-if="state !== 'ready'" class="mx-auto mt-10 max-w-xs text-white/65">
      <p class="text-lg font-medium text-white/85">{{ state === 'error' ? t('Couldn’t load the lyrics.') : t('No lyrics found') }}</p>
      <p v-if="state === 'none'" class="mt-2 text-sm leading-relaxed">{{ t('Put a .lrc file with the same name next to the song, or embed lyrics in its tags.') }}</p>
    </div>
    <ol v-else class="space-y-3 py-[30%]">
      <li
        v-for="(line, i) in lyrics!.lines" :key="i" :data-line="i" dir="auto"
        :class="cn('mx-auto max-w-[28rem] text-[clamp(1rem,2.6vh,1.35rem)] font-medium leading-snug transition-all duration-300',
          !lyrics!.synced ? 'text-white/80' : i === activeIndex ? 'scale-105 text-white' : 'text-white/35',
          lyrics!.synced && line.timeMs !== null && 'cursor-pointer hover:text-white/70')"
        @click="lyrics!.synced && line.timeMs !== null && player.seek(line.timeMs)"
      >{{ line.text || '♪' }}</li>
    </ol>
  </div>
</template>

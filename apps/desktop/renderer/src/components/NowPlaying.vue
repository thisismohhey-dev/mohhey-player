<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { ChevronDown, Heart } from 'lucide-vue-next'
import { artUrl } from '@/lib/api'
import { hueFor } from '@/lib/format'
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
const track = computed(() => player.current)
const bg = computed(() => artUrl(track.value?.artworkHash))
const hue = computed(() => hueFor(track.value?.album || track.value?.title || ''))

function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') ui.nowPlayingOpen = false }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="dark absolute inset-0 z-40 overflow-hidden bg-background text-foreground" role="dialog" aria-modal="true" :aria-label="t('player.nowPlaying')">
    <!-- Blurred artwork wash: kept dim so text always has contrast. -->
    <div class="absolute inset-0 scale-125 transition-opacity duration-700" aria-hidden="true">
      <img v-if="bg" :src="bg" alt="" class="size-full object-cover blur-[90px] saturate-150" />
      <div v-else class="size-full" :style="{ background: `radial-gradient(60% 60% at 30% 20%, hsl(${hue} 45% 62%), transparent), radial-gradient(60% 60% at 80% 80%, hsl(${(hue + 50) % 360} 45% 55%), transparent)` }" />
    </div>
    <div class="absolute inset-0 bg-black/45" aria-hidden="true" />

    <div class="relative flex h-full flex-col px-8 pb-6 pt-[calc(var(--titlebar-h)+4px)] text-foreground">
      <button class="grid size-10 place-items-center self-start rounded-full bg-white/12 backdrop-blur hover:bg-white/20" :aria-label="t('Close now playing')" data-action="now-playing-close" @click="ui.nowPlayingOpen = false">
        <ChevronDown class="size-5" />
      </button>

      <div v-if="track" class="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-[clamp(10px,2.4vh,24px)]">
        <!-- Always a true square: the size comes from the free height, never from the flex container (which used to squash it). -->
        <Cover
          :hash="track.artworkHash" :seed="track.album || track.title"
          class="size-[clamp(140px,calc(100vh-390px),440px)] shrink-0 rounded-[28px] shadow-[0_40px_80px_-24px_rgb(0_0_0/0.65)]"
        />
        <div class="flex w-full items-center gap-4">
          <div class="min-w-0 flex-1">
            <h2 dir="auto" class="truncate font-display text-[clamp(1.5rem,4.2vh,2.2rem)] font-medium leading-[1.15] tracking-[-0.01em]">{{ track.title }}</h2>
            <p dir="auto" class="mt-1 truncate text-[clamp(0.9rem,2vh,1.1rem)] font-medium text-white/80">{{ track.artist || t('Unknown artist') }}</p>
            <p v-if="track.album" dir="auto" class="truncate text-[clamp(0.8rem,1.8vh,0.95rem)] text-white/55">{{ track.album }}</p>
          </div>
          <button
            :class="cn('grid size-11 shrink-0 place-items-center rounded-full bg-white/12 backdrop-blur transition-colors hover:bg-white/22', track.favorite && 'text-[#ff7a4d]')"
            :aria-label="track.favorite ? t('player.unfavorite') : t('player.favorite')" :aria-pressed="track.favorite" @click="player.toggleFavorite(track)"
          ><Heart class="size-5" :class="track.favorite && 'fill-current'" /></button>
        </div>
        <div class="w-full"><SeekBar /></div>
        <TransportControls size="lg" />
        <div class="[@media(max-height:640px)]:hidden"><VolumeControl /></div>
      </div>
      <p v-else class="m-auto text-white/70">{{ t('player.nothingPlaying') }}</p>
    </div>
  </section>
</template>

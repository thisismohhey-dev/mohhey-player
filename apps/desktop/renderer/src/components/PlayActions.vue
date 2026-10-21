<script setup lang="ts">
import { t } from '@/lib/i18n'
import { Play, Shuffle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePlayerStore } from '@/stores/player'
import type { Track } from '@mohhey/contracts'

const props = defineProps<{ load: () => Promise<Track[]>; disabled?: boolean }>()
const player = usePlayerStore()

async function go(shuffle: boolean): Promise<void> {
  const tracks = await props.load()
  if (!tracks.length) return
  if (player.shuffle !== shuffle) player.toggleShuffle()
  player.playTracks(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0)
}
</script>

<template>
  <Button class="h-11 rounded-full px-6 text-[15px] shadow-card" :disabled="disabled" @click="go(false)"><Play class="size-4 fill-current" />{{ t('Play') }}</Button>
  <Button variant="secondary" class="h-11 rounded-full px-5 text-[15px]" :disabled="disabled" @click="go(true)"><Shuffle class="size-4" />{{ t('Shuffle') }}</Button>
</template>

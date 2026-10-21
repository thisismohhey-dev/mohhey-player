<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import { Music2, UserRound } from 'lucide-vue-next'
import { artUrl } from '@/lib/api'
import { hueFor } from '@/lib/format'
import { cn } from '@/lib/utils'

const props = defineProps<{ hash?: string | null; seed?: string; round?: boolean; kind?: 'track' | 'artist'; icon?: Component; class?: string }>()
const failed = ref(false)
watch(() => props.hash, () => { failed.value = false })

const src = computed(() => (failed.value ? null : artUrl(props.hash)))
const hue = computed(() => hueFor(props.seed ?? ''))
const bg = computed(() => `linear-gradient(135deg, hsl(${hue.value} 28% 78%), hsl(${(hue.value + 40) % 360} 32% 66%))`)
</script>

<template>
  <div :class="cn('relative aspect-square overflow-hidden bg-secondary', round ? 'rounded-full' : 'rounded-xl', props.class)">
    <img v-if="src" :src="src" alt="" draggable="false" loading="lazy" class="size-full object-cover" @error="failed = true" />
    <div v-else class="grid size-full place-items-center text-white/80" :style="{ background: bg }" aria-hidden="true">
      <component :is="icon" v-if="icon" class="size-[38%]" :stroke-width="1.5" />
      <UserRound v-else-if="kind === 'artist'" class="size-[38%]" :stroke-width="1.5" />
      <Music2 v-else class="size-[38%]" :stroke-width="1.5" />
    </div>
  </div>
</template>

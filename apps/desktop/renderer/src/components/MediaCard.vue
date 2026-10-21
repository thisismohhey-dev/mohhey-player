<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { Component } from 'vue'
import { Play } from 'lucide-vue-next'
import Cover from './Cover.vue'

defineProps<{
  to: RouteLocationRaw
  title: string
  subtitle?: string
  hash?: string | null
  seed?: string
  round?: boolean
  kind?: 'track' | 'artist'
  icon?: Component
  /** Up to four hashes for a mosaic cover (playlists). */
  mosaic?: string[]
  playLabel?: string
}>()
defineEmits<{ play: [] }>()
</script>

<template>
  <div class="group relative w-full min-w-0">
    <RouterLink :to="to" class="block rounded-2xl p-2 transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06]">
      <div class="relative">
        <div v-if="mosaic && mosaic.length > 1" class="grid aspect-square grid-cols-2 gap-0.5 overflow-hidden rounded-xl shadow-card">
          <Cover v-for="(h, i) in mosaic.slice(0, 4)" :key="i" :hash="h" :seed="title + i" class="rounded-none" />
        </div>
        <Cover v-else :hash="mosaic?.[0] ?? hash" :seed="seed ?? title" :round="round" :kind="kind" :icon="icon" class="w-full shadow-card" />
      </div>
      <div class="mt-3 min-w-0" :class="round && 'text-center'">
        <div dir="auto" class="truncate text-[15px] font-medium leading-tight">{{ title }}</div>
        <div dir="auto" v-if="subtitle" class="mt-0.5 truncate text-[13px] text-muted-foreground">{{ subtitle }}</div>
      </div>
    </RouterLink>
    <button
      v-if="playLabel"
      class="absolute bottom-[3.9rem] end-4 grid size-11 translate-y-1 place-items-center rounded-full bg-foreground text-background opacity-0 shadow-float transition-all hover:scale-105 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      :class="round && 'bottom-[4.4rem]'"
      :aria-label="playLabel" @click.prevent="$emit('play')"
    ><Play class="size-5 translate-x-px fill-current" /></button>
  </div>
</template>

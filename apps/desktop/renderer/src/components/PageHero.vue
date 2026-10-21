<script setup lang="ts">
import type { Component } from 'vue'
import { artUrl } from '@/lib/api'
import Cover from './Cover.vue'

defineProps<{
  title: string
  eyebrow?: string
  meta?: string
  hash?: string | null
  seed?: string
  round?: boolean
  kind?: 'track' | 'artist'
  icon?: Component
  mosaic?: string[]
}>()
</script>

<template>
  <header class="relative isolate overflow-hidden px-8 pb-8 pt-4">
    <!-- Soft tinted wash taken from the artwork, like a magazine spread. -->
    <img v-if="artUrl(hash)" :src="artUrl(hash)!" alt="" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 size-full scale-150 object-cover opacity-30 blur-[80px] saturate-150 dark:opacity-25" />
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/40 to-background" aria-hidden="true" />
    <div class="flex items-end gap-8">
      <div v-if="mosaic && mosaic.length > 1" class="grid size-52 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-2xl shadow-float">
        <Cover v-for="(h, i) in mosaic.slice(0, 4)" :key="i" :hash="h" :seed="title + i" class="rounded-none" />
      </div>
      <Cover v-else :hash="mosaic?.[0] ?? hash" :seed="seed ?? title" :round="round" :kind="kind" :icon="icon" class="size-52 shrink-0 shadow-float" :class="round ? '' : 'rounded-2xl'" />
      <div class="min-w-0 pb-1">
        <div v-if="eyebrow" class="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{{ eyebrow }}</div>
        <h1 dir="auto" class="line-clamp-2 text-[clamp(2.5rem,5.5vw,5rem)] font-medium leading-[0.98]">{{ title }}</h1>
        <p v-if="meta" class="mt-4 text-[15px] text-muted-foreground">{{ meta }}</p>
        <div class="mt-6 flex flex-wrap items-center gap-3"><slot name="actions" /></div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ title: string; body?: string; icon?: Component }>()
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
    <div v-if="icon" class="mb-6 grid size-16 place-items-center rounded-full bg-secondary text-muted-foreground">
      <component :is="icon" class="size-7" :stroke-width="1.5" />
    </div>
    <h2 class="text-3xl font-medium leading-tight">{{ title }}</h2>
    <p v-if="body" class="mt-3 text-[15px] leading-relaxed text-muted-foreground">{{ body }}</p>
    <div class="mt-7"><slot /></div>
  </div>
</template>

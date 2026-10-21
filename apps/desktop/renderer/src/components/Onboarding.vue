<script setup lang="ts">
import { FolderOpen, LockKeyhole, Search, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'

const library = useLibraryStore()
const points = [
  { icon: LockKeyhole, text: 'Everything stays on your computer' },
  { icon: Sparkles, text: 'Artwork and tags read from your files' },
  { icon: Search, text: 'Instant search, in any language' },
]
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <div class="drag h-[var(--titlebar-h)] shrink-0" />
    <div class="pointer-events-none absolute -end-40 top-10 size-[620px] rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
    <div class="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-10 pb-16">
      <div class="font-display text-xl font-bold tracking-tight">Mohhey<span class="text-brand">.</span></div>
      <h1 class="mt-10 max-w-3xl text-[clamp(3rem,7vw,5.5rem)] font-medium leading-[0.95]">{{ t('empty.libraryTitle') }}</h1>
      <p class="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{{ t('empty.libraryBody') }}</p>
      <div class="mt-10 flex items-center gap-5">
        <Button size="lg" class="h-12 rounded-full px-7 text-[15px] shadow-card" @click="library.addFolder()"><FolderOpen class="size-5" />{{ t('empty.chooseFolder') }}</Button>
        <span class="text-sm text-muted-foreground">MP3, FLAC, OGG, Opus, WAV, M4A, AAC</span>
      </div>
      <ul class="mt-16 grid max-w-3xl gap-4 sm:grid-cols-3">
        <li v-for="p in points" :key="p.text" class="rounded-2xl bg-card p-5 shadow-card">
          <component :is="p.icon" class="mb-4 size-5 text-brand" :stroke-width="1.7" />
          <span class="text-[14px] font-medium leading-snug">{{ p.text }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

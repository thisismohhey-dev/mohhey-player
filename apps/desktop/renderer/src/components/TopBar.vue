<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-vue-next'
import { t } from '@/lib/i18n'

const route = useRoute()
const router = useRouter()
const input = ref<HTMLInputElement>()
const text = ref(typeof route.query.q === 'string' ? route.query.q : '')
let timer: ReturnType<typeof setTimeout> | undefined

watch(() => route.query.q, (q) => { if (route.name === 'search') text.value = typeof q === 'string' ? q : '' })

function onInput(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const q = text.value.trim()
    if (q) void router.replace({ name: 'search', query: { q } })
    else if (route.name === 'search') void router.replace({ name: 'search' })
  }, 180)
}

function clear(): void { text.value = ''; onInput(); input.value?.focus() }

function shortcut(e: KeyboardEvent): void {
  const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.value?.focus(); input.value?.select() }
  else if (e.key === '/' && !typing) { e.preventDefault(); input.value?.focus() }
}
onMounted(() => window.addEventListener('keydown', shortcut))
onBeforeUnmount(() => { window.removeEventListener('keydown', shortcut); clearTimeout(timer) })
</script>

<template>
  <div class="drag flex h-[var(--titlebar-h)] shrink-0 items-center gap-2 ps-6 pe-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw)+16px)]">
    <button class="no-drag grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" aria-label="Back" @click="router.back()"><ChevronLeft class="size-5" /></button>
    <button class="no-drag grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" aria-label="Forward" @click="router.forward()"><ChevronRight class="size-5" /></button>
    <label class="no-drag relative ms-3 block w-full max-w-sm">
      <span class="sr-only">{{ t('nav.search') }}</span>
      <Search class="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref="input" v-model="text" type="search" autocomplete="off" spellcheck="false" placeholder="Search songs, albums, artists"
        class="h-9 w-full rounded-full border border-transparent bg-foreground/[0.06] ps-9 pe-9 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring/50 focus:bg-card [&::-webkit-search-cancel-button]:hidden"
        @input="onInput" @keydown.esc="clear"
      />
      <button v-if="text" class="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Clear search" @click="clear"><X class="size-3.5" /></button>
    </label>
  </div>
</template>

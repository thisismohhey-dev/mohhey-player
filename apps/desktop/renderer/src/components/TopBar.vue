<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-vue-next'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui'
import WindowControls from './WindowControls.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const input = ref<HTMLInputElement>()
const text = ref(typeof route.query.q === 'string' ? route.query.q : '')
/** The search field is just an icon until it is clicked (or Ctrl+K / "/" is pressed). */
const open = ref(text.value.length > 0)
let timer: ReturnType<typeof setTimeout> | undefined

watch(() => [route.name, route.query.q], () => {
  text.value = route.name === 'search' && typeof route.query.q === 'string' ? route.query.q : ''
  if (text.value) open.value = true
  else if (document.activeElement !== input.value) open.value = false
})

async function openSearch(): Promise<void> {
  open.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function onBlur(): void { if (!text.value.trim()) open.value = false }

function onInput(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const q = text.value.trim()
    if (q) void router.replace({ name: 'search', query: { q } })
    else if (route.name === 'search') void router.replace({ name: 'search' })
  }, 180)
}

function clear(): void { text.value = ''; onInput(); open.value = false; input.value?.blur() }

function shortcut(e: KeyboardEvent): void {
  const typing = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); void openSearch() }
  else if (e.key === '/' && !typing) { e.preventDefault(); void openSearch() }
}
onMounted(() => window.addEventListener('keydown', shortcut))
onBeforeUnmount(() => { window.removeEventListener('keydown', shortcut); clearTimeout(timer) })

const iconBtn = 'no-drag grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground'
</script>

<template>
  <div class="drag flex h-[var(--titlebar-h)] shrink-0 items-center gap-1.5 pl-4 pr-2">
    <button :class="iconBtn" :aria-label="ui.sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')" :title="`${ui.sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar')} (Ctrl+B)`" @click="ui.toggleSidebar()">
      <PanelLeftOpen v-if="ui.sidebarCollapsed" class="size-[18px] rtl:-scale-x-100" /><PanelLeftClose v-else class="size-[18px] rtl:-scale-x-100" />
    </button>
    <button :class="iconBtn" :aria-label="t('Back')" @click="router.back()"><ChevronLeft class="size-5 rtl:rotate-180" /></button>
    <button :class="iconBtn" :aria-label="t('Forward')" @click="router.forward()"><ChevronRight class="size-5 rtl:rotate-180" /></button>

    <div
      role="search"
      :class="cn('no-drag relative ms-2 flex h-9 items-center overflow-hidden rounded-full border border-transparent transition-[width,background-color] duration-200 ease-out',
        open ? 'w-[22rem] max-w-[60%] bg-foreground/[0.06] focus-within:border-ring/50 focus-within:bg-card' : 'w-9 hover:bg-foreground/8')"
    >
      <button
        class="grid size-9 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
        :aria-label="t('nav.search')" :aria-expanded="open" :title="`${t('nav.search')} (Ctrl+K)`" @click="open ? input?.focus() : openSearch()"
      ><Search class="size-4" /></button>
      <input
        ref="input" v-model="text" type="search" autocomplete="off" spellcheck="false" :tabindex="open ? 0 : -1"
        :placeholder="t('Search songs, albums, artists')" :aria-label="t('nav.search')"
        class="h-full min-w-0 flex-1 bg-transparent pe-9 text-[14px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        :class="open ? 'opacity-100' : 'pointer-events-none opacity-0'"
        @input="onInput" @blur="onBlur" @keydown.esc="clear"
      />
      <button v-if="open && text" class="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground" :aria-label="t('Clear search')" @mousedown.prevent @click="clear"><X class="size-3.5" /></button>
    </div>

    <span class="flex-1" />
    <WindowControls />
  </div>
</template>

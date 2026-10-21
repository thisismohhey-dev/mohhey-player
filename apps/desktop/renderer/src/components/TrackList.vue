<script setup lang="ts">
import { t, digits } from '@/lib/i18n'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ArrowDown, ArrowUp, Heart, MoreHorizontal, Pause, Play } from 'lucide-vue-next'
import type { TrackSort } from '@mohhey/contracts'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { TrackSource } from '@/composables/usePagedTracks'
import { formatTime } from '@/lib/format'
import { usePlayerStore } from '@/stores/player'
import { cn } from '@/lib/utils'
import Cover from './Cover.vue'
import TrackMenu from './TrackMenu.vue'

const props = withDefaults(defineProps<{
  source: TrackSource
  sort?: TrackSort
  dir?: 'asc' | 'desc'
  sortable?: boolean
  /** Show the running number instead of the album track number. */
  numbered?: boolean
  /** Adds a "remove from playlist" action to the track menu. */
  removable?: boolean
  /** Enables drag-and-drop (and Alt+Arrow) reordering; emits move(from, to). */
  reorderable?: boolean
}>(), { sort: 'title', dir: 'asc' })
const emit = defineEmits<{ sort: [sort: TrackSort]; remove: [index: number]; move: [from: number, to: number] }>()
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

const ROW = 60
const COLS = 'grid-cols-[2.5rem_minmax(0,1fr)_2rem_3.5rem_2rem] @2xl:grid-cols-[2.5rem_minmax(0,1.6fr)_minmax(0,1fr)_2rem_3.5rem_2rem]'
const player = usePlayerStore()
const scroller = inject<Ref<HTMLElement | undefined>>('mainScroll')!
const root = ref<HTMLElement>()
const margin = ref(0)
/** Distance from the top of the scroll content to this list; re-measured when surrounding layout changes. */
function measure(): void {
  const el = root.value
  const sc = scroller.value
  if (!el || !sc) return
  margin.value = Math.round(el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop)
}
let ro: ResizeObserver | undefined
onMounted(async () => {
  await nextTick()
  measure()
  ro = new ResizeObserver(measure)
  if (scroller.value?.firstElementChild) ro.observe(scroller.value.firstElementChild)
  if (root.value) ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const count = computed(() => props.source.total.value)
const virt = useVirtualizer(computed(() => ({
  count: count.value,
  getScrollElement: () => scroller.value ?? null,
  estimateSize: () => ROW,
  overscan: 8,
  scrollMargin: margin.value,
})))
const items = computed(() => virt.value.getVirtualItems())
watch(items, (list) => { for (const it of list) props.source.ensure(it.index) }, { immediate: true })
const selected = ref<number | null>(null)

const rows = computed(() => {
  void props.source.version.value
  return items.value.map((it) => ({ it, track: props.source.get(it.index) }))
})

async function playAt(index: number): Promise<void> {
  const t = props.source.get(index)
  if (!t) return
  if (player.current?.id === t.id) { await player.togglePlay(); return }
  const all = await props.source.all()
  const start = all[index]?.id === t.id ? index : all.findIndex((x) => x.id === t.id)
  player.playTracks(all, Math.max(0, start))
}

function openMenu(e: MouseEvent): void {
  const row = (e.currentTarget as HTMLElement).closest('[data-row]')
  row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX, clientY: e.clientY }))
}

function key(e: KeyboardEvent, index: number): void {
  if (props.reorderable && e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
    const to = index + (e.key === 'ArrowDown' ? 1 : -1)
    if (to >= 0 && to < count.value) { emit('move', index, to); selected.value = to; requestAnimationFrame(() => root.value?.querySelector<HTMLElement>('[data-index="' + to + '"]')?.focus()) }
    return
  }
  if (e.key === 'Enter') { e.preventDefault(); void playAt(index) }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const next = Math.min(count.value - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))
    selected.value = next
    virt.value.scrollToIndex(next, { align: 'auto' })
    requestAnimationFrame(() => root.value?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus())
  }
}

const isCurrent = (id: number) => player.current?.id === id
</script>

<template>
  <div ref="root" class="@container">
    <div :class="cn('sticky top-0 z-10 grid items-center gap-3 border-b bg-background/85 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground backdrop-blur', COLS)">
      <span class="text-center">#</span>
      <button v-if="sortable" class="flex items-center gap-1 text-start uppercase hover:text-foreground" @click="emit('sort', 'title')">
        {{ t('Title') }} <component :is="dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort === 'title'" class="size-3" />
      </button>
      <span v-else>{{ t('Title') }}</span>
      <button v-if="sortable" class="hidden items-center gap-1 text-start uppercase hover:text-foreground @2xl:flex" @click="emit('sort', 'album')">
        {{ t('Album') }} <component :is="dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort === 'album'" class="size-3" />
      </button>
      <span v-else class="hidden @2xl:block">{{ t('Album') }}</span>
      <span />
      <button v-if="sortable" class="flex items-center justify-end gap-1 uppercase hover:text-foreground" @click="emit('sort', 'duration')">
        <component :is="dir === 'asc' ? ArrowUp : ArrowDown" v-if="sort === 'duration'" class="size-3" /> {{ t('Time') }}
      </button>
      <span v-else class="text-end">{{ t('Time') }}</span>
      <span />
    </div>

    <div class="relative w-full" :style="{ height: `${virt.getTotalSize()}px` }" role="list">
      <div
        v-for="{ it, track } in rows" :key="String(it.key)"
        class="absolute inset-x-0 top-0"
        :style="{ height: `${it.size}px`, transform: `translateY(${it.start - margin}px)` }"
      >
        <ContextMenu v-if="track">
          <ContextMenuTrigger as-child>
            <div
              data-row :data-index="it.index" role="listitem" tabindex="0" :draggable="reorderable"
              @dragstart="dragFrom = it.index" @dragenter.prevent="dragOver = it.index" @dragover.prevent
              @drop.prevent="dragFrom !== null && dragFrom !== it.index && emit('move', dragFrom, it.index); dragFrom = dragOver = null" @dragend="dragFrom = dragOver = null"
              :aria-label="track.artist ? t('{title} by {artist}', { title: track.title, artist: track.artist }) : track.title"
              :class="cn(
                'group mx-1 grid h-[56px] cursor-default items-center gap-3 rounded-xl px-2 transition-colors',
                COLS,
                'hover:bg-foreground/[0.045] focus-visible:bg-foreground/[0.06]',
                selected === it.index && 'bg-foreground/[0.06]',
                isCurrent(track.id) && 'bg-brand/10 hover:bg-brand/[0.14]',
                track.missing && 'opacity-50',
                dragFrom === it.index && 'opacity-40',
                reorderable && dragOver === it.index && dragFrom !== null && dragFrom !== it.index && 'shadow-[inset_0_2px_0_var(--brand)]',
              )"
              @click="selected = it.index" @dblclick="playAt(it.index)" @keydown="key($event, it.index)"
            >
              <button
                class="relative grid size-9 place-items-center rounded-full text-sm text-muted-foreground"
                :aria-label="isCurrent(track.id) && player.isPlaying ? t('Pause') : t('Play {title}', { title: track.title })"
                @click.stop="playAt(it.index)"
              >
                <span class="tabular group-hover:hidden group-focus-within:hidden" :class="isCurrent(track.id) && 'text-brand'">
                  <span v-if="isCurrent(track.id) && player.isPlaying" class="eq" aria-hidden="true"><i /><i /><i /></span>
                  <template v-else>{{ digits(String(numbered ? it.index + 1 : (track.trackNo ?? it.index + 1))) }}</template>
                </span>
                <component :is="isCurrent(track.id) && player.isPlaying ? Pause : Play" class="hidden size-4 fill-current text-foreground group-hover:block group-focus-within:block" />
              </button>

              <div class="flex min-w-0 items-center gap-3">
                <Cover :hash="track.artworkHash" :seed="track.album || track.title" class="size-10 shrink-0 rounded-lg" />
                <div class="min-w-0">
                  <div dir="auto" class="truncate text-[14px] font-medium leading-tight" :class="isCurrent(track.id) && 'text-brand'">{{ track.title }}</div>
                  <div dir="auto" class="truncate text-[13px] text-muted-foreground">{{ track.artist || t('Unknown artist') }}</div>
                </div>
              </div>
              <div dir="auto" class="hidden min-w-0 truncate text-[13px] text-muted-foreground @2xl:block">{{ track.album }}</div>

              <button
                class="grid size-8 place-items-center rounded-full transition-opacity hover:bg-foreground/8"
                :class="track.favorite ? 'text-brand' : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'"
                :aria-label="t(track.favorite ? 'Remove from favorites' : 'Add to favorites')" :aria-pressed="track.favorite"
                @click.stop="player.toggleFavorite(track)"
              >
                <Heart class="size-4" :class="track.favorite && 'fill-current'" />
              </button>
              <span class="text-end text-[13px] tabular text-muted-foreground">{{ formatTime(track.durationMs) }}</span>
              <button
                class="grid size-8 place-items-center rounded-full text-muted-foreground opacity-0 hover:bg-foreground/8 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                :aria-label="t('More actions')" @click.stop="openMenu"
              ><MoreHorizontal class="size-4" /></button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent class="w-56 rounded-2xl p-1.5 shadow-float">
            <TrackMenu :track="track" :removable="removable" @remove="emit('remove', it.index)" />
          </ContextMenuContent>
        </ContextMenu>
        <div v-else class="mx-1 grid h-[56px] grid-cols-[2.5rem_1fr] items-center gap-3 px-2" aria-hidden="true">
          <div />
          <div class="flex items-center gap-3">
            <div class="size-10 animate-pulse rounded-lg bg-foreground/8" />
            <div class="space-y-2"><div class="h-3 w-40 animate-pulse rounded bg-foreground/8" /><div class="h-2.5 w-24 animate-pulse rounded bg-foreground/6" /></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
.eq i { width: 3px; background: currentColor; border-radius: 1px; animation: eq 0.9s ease-in-out infinite; }
.eq i:nth-child(2) { animation-delay: -0.3s; }
.eq i:nth-child(3) { animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { height: 4px } 50% { height: 14px } }
</style>

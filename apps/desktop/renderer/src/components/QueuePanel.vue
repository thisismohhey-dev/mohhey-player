<script setup lang="ts">
import { ref } from 'vue'
import { GripVertical, ListMusic, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import Cover from './Cover.vue'
import EmptyState from './EmptyState.vue'

const player = usePlayerStore()
const ui = useUiStore()
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function drop(to: number): void {
  if (dragFrom.value !== null && dragFrom.value !== to) player.moveInQueue(dragFrom.value, to)
  dragFrom.value = dragOver.value = null
}

function key(e: KeyboardEvent, pos: number): void {
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const to = pos + (e.key === 'ArrowUp' ? -1 : 1)
    player.moveInQueue(pos, to)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-queue-pos="${to}"]`)?.focus())
  } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); player.removeFromQueue(pos) }
  else if (e.key === 'Enter') { e.preventDefault(); player.jumpTo(pos) }
}
</script>

<template>
  <aside
    class="absolute inset-y-0 end-0 z-20 flex w-[380px] max-w-[92vw] flex-col border-s bg-surface/95 pt-[var(--titlebar-h)] shadow-float backdrop-blur-xl"
    :aria-label="t('Queue')"
  >
    <header class="flex items-center justify-between px-6 pb-3 pt-4">
      <h2 class="text-2xl font-medium">{{ t('player.queue') }}</h2>
      <div class="flex items-center gap-1">
        <Button variant="ghost" size="sm" class="rounded-full text-muted-foreground" :disabled="player.entries.length < 2" @click="player.clearUpcoming()">{{ t('Clear upcoming') }}</Button>
        <Button variant="ghost" size="icon-sm" class="rounded-full" :aria-label="t('Close queue')" @click="ui.queueOpen = false"><X class="size-4" /></Button>
      </div>
    </header>

    <EmptyState v-if="!player.entries.length" :title="t('empty.queueTitle')" :body="t('empty.queueBody')" :icon="ListMusic" />
    <ol v-else class="min-h-0 flex-1 overflow-y-auto px-3 pb-36" @dragover.prevent>
      <li
        v-for="(entry, pos) in player.entries" :key="entry.uid"
        :data-queue-pos="pos" tabindex="0" draggable="true"
        :aria-current="pos === player.position ? 'true' : undefined"
        :class="cn(
          'group relative flex items-center gap-2 rounded-xl px-2 py-1.5 outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.06]',
          pos === player.position && 'bg-brand/10',
          dragFrom === pos && 'opacity-40',
          dragOver === pos && dragFrom !== null && dragFrom !== pos && 'before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:rounded before:bg-brand',
        )"
        @dragstart="dragFrom = pos" @dragenter.prevent="dragOver = pos" @drop.prevent="drop(pos)" @dragend="dragFrom = dragOver = null"
        @dblclick="player.jumpTo(pos)" @keydown="key($event, pos)"
      >
        <GripVertical class="size-4 shrink-0 cursor-grab text-muted-foreground/60 opacity-0 group-hover:opacity-100" aria-hidden="true" />
        <Cover :size="96" :hash="entry.track.artworkHash" :seed="entry.track.album || entry.track.title" class="size-10 shrink-0 rounded-lg" />
        <button class="min-w-0 flex-1 text-start" :aria-label="t('Play {title}', { title: entry.track.title })" @click="player.jumpTo(pos)">
          <div dir="auto" class="truncate text-[14px] font-medium" :class="pos === player.position && 'text-brand'">{{ entry.track.title }}</div>
          <div dir="auto" class="truncate text-[13px] text-muted-foreground">{{ entry.track.artist }}</div>
        </button>
        <span class="text-xs tabular text-muted-foreground">{{ formatTime(entry.track.durationMs) }}</span>
        <button
          class="grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 hover:bg-foreground/8 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
          :aria-label="t('Remove {title} from queue', { title: entry.track.title })" @click="player.removeFromQueue(pos)"
        ><X class="size-3.5" /></button>
      </li>
    </ol>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  /** 0..1 */ value: number
  label: string
  valueText?: string
  step?: number
  disabled?: boolean
  size?: 'sm' | 'md'
  class?: string
}>(), { step: 0.02, size: 'md' })
const emit = defineEmits<{ input: [fraction: number]; commit: [fraction: number] }>()

const track = ref<HTMLElement>()
const dragging = ref(false)
const dragValue = ref(0)
const shown = computed(() => Math.min(1, Math.max(0, dragging.value ? dragValue.value : props.value)))

function fractionAt(e: PointerEvent): number {
  const r = track.value!.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  // Honour RTL: the track is mirrored with the document direction.
  const f = getComputedStyle(track.value!).direction === 'rtl' ? 1 - x : x
  return Math.min(1, Math.max(0, f))
}
function down(e: PointerEvent): void {
  if (props.disabled) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
  dragValue.value = fractionAt(e)
  emit('input', dragValue.value)
}
function move(e: PointerEvent): void {
  if (!dragging.value) return
  dragValue.value = fractionAt(e)
  emit('input', dragValue.value)
}
function up(): void {
  if (!dragging.value) return
  dragging.value = false
  emit('commit', dragValue.value)
}
function key(e: KeyboardEvent): void {
  if (props.disabled) return
  const dir = getComputedStyle(track.value!).direction === 'rtl' ? -1 : 1
  let next: number | null = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = props.value + props.step * (e.key === 'ArrowUp' ? 1 : dir)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = props.value - props.step * (e.key === 'ArrowDown' ? 1 : dir)
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = 1
  if (next === null) return
  e.preventDefault()
  const f = Math.min(1, Math.max(0, next))
  emit('input', f); emit('commit', f)
}
</script>

<template>
  <div
    ref="track"
    role="slider" tabindex="0"
    :aria-label="label" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="Math.round(shown * 100)"
    :aria-valuetext="valueText" :aria-disabled="disabled"
    :class="cn('group relative flex w-full cursor-pointer touch-none items-center', size === 'md' ? 'h-5' : 'h-4', disabled && 'pointer-events-none opacity-40', props.class)"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key"
  >
    <div class="relative w-full overflow-hidden rounded-full bg-foreground/12" :class="size === 'md' ? 'h-1 group-hover:h-1.5 group-focus-visible:h-1.5' : 'h-1'" style="transition: height .12s">
      <div class="absolute inset-y-0 start-0 rounded-full bg-foreground" :style="{ width: `${shown * 100}%` }" />
    </div>
    <div
      class="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 rtl:translate-x-1/2"
      :class="[dragging && 'opacity-100', 'ltr:-translate-x-1/2']"
      :style="{ insetInlineStart: `${shown * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts" generic="T">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance, type Ref } from 'vue'

/**
 * A responsive grid of cards that only renders the rows near the viewport. Albums and artists lists can hold thousands of covers;
 * keeping every card (and its decoded image) alive used to cost hundreds of MB.
 */
const props = withDefaults(defineProps<{ items: readonly T[]; keyOf: (item: T) => string | number; minWidth?: number; gapX?: number; gapY?: number; extraHeight?: number }>(), {
  minWidth: 168, gapX: 8, gapY: 12, extraHeight: 52,
})

const scroller = inject<Ref<HTMLElement | undefined>>('mainScroll')!
const root = ref<HTMLElement>()
const width = ref(0)
const margin = ref(0)

const cols = computed(() => Math.max(1, Math.floor((width.value + props.gapX) / (props.minWidth + props.gapX))))
const cellWidth = computed(() => (width.value - props.gapX * (cols.value - 1)) / cols.value)
const rowCount = computed(() => Math.ceil(props.items.length / cols.value))

function measure(): void {
  const el = root.value
  const sc = scroller.value
  if (!el) return
  width.value = Math.max(0, el.clientWidth)
  if (sc) margin.value = Math.round(el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop)
}
let ro: ResizeObserver | undefined
onMounted(async () => {
  await nextTick()
  measure()
  ro = new ResizeObserver(measure)
  if (root.value) ro.observe(root.value)
  if (scroller.value?.firstElementChild) ro.observe(scroller.value.firstElementChild)
})
onBeforeUnmount(() => ro?.disconnect())

const virt = useVirtualizer(computed(() => ({
  count: rowCount.value,
  getScrollElement: () => scroller.value ?? null,
  estimateSize: () => cellWidth.value + props.extraHeight + props.gapY,
  overscan: 2,
  scrollMargin: margin.value,
})))
const rows = computed(() => virt.value.getVirtualItems())
const rowItems = (row: number): readonly T[] => props.items.slice(row * cols.value, (row + 1) * cols.value)
const measureRow = (el: Element | ComponentPublicInstance | null): void => { if (el instanceof Element) virt.value.measureElement(el) }
</script>

<template>
  <div ref="root" class="px-6">
    <div class="relative w-full" :style="{ height: `${virt.getTotalSize()}px` }">
      <div
        v-for="row in rows" :key="String(row.key)" :ref="measureRow" :data-index="row.index"
        class="absolute start-0 top-0 grid w-full items-start"
        :style="{ transform: `translateY(${row.start - virt.options.scrollMargin}px)`, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: `${gapX}px`, paddingBottom: `${gapY}px` }"
      >
        <slot v-for="item in rowItems(row.index)" :key="keyOf(item)" :item="item" />
      </div>
    </div>
  </div>
</template>

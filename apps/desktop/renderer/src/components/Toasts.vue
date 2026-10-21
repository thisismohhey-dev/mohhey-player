<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'

const { toasts } = storeToRefs(useUiStore())
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts" :key="t.id" :role="t.kind === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium shadow-float"
        :class="t.kind === 'error' ? 'bg-destructive text-white' : 'bg-foreground text-background'"
      >{{ t.text }}</div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all .22s cubic-bezier(.2,.8,.2,1); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px) scale(.97); }
</style>

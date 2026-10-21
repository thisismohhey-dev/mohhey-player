<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Copy, Minus, Square, X } from 'lucide-vue-next'
import type { WindowControl } from '@mohhey/contracts'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Custom title-bar buttons for Windows/Linux. macOS keeps its native traffic lights. */
const show = window.mohhey.platform !== 'darwin'
const maximized = ref(false)
let off: (() => void) | undefined
onMounted(() => { off = window.mohhey.onMaximizeChange((m) => { maximized.value = m }) })
onBeforeUnmount(() => off?.())

const base = 'no-drag grid place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground'
const control = (action: WindowControl) => window.mohhey.windowControl(action)
</script>

<template>
  <!-- Window buttons stay at the physical right even in RTL, like the OS ones. -->
  <div v-if="show" dir="ltr" class="flex items-center gap-0.5" role="group" :aria-label="t('Window controls')">
      <button :class="cn(base, 'h-8 w-9 hover:bg-foreground/8')" :aria-label="t('Minimize')" :title="t('Minimize')" @click="control('minimize')"><Minus class="size-4" :stroke-width="1.8" /></button>
      <button :class="cn(base, 'h-8 w-9 hover:bg-foreground/8')" :aria-label="maximized ? t('Restore') : t('Maximize')" :title="maximized ? t('Restore') : t('Maximize')" @click="control('maximize')">
        <Copy v-if="maximized" class="size-3.5 -scale-x-100" :stroke-width="1.8" /><Square v-else class="size-3.5" :stroke-width="1.8" />
      </button>
    <button
      :class="cn(base, 'h-8 w-9 hover:bg-destructive hover:text-white')"
      :aria-label="t('Close')" :title="t('Close')" @click="control('close')"
    ><X class="size-4" :stroke-width="1.8" /></button>
  </div>
</template>

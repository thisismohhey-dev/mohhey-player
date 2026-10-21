<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { digits, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'

withDefaults(defineProps<{ class?: string }>(), {})
const player = usePlayerStore()
const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]
const label = (r: number) => digits(`${r}×`)
const model = computed({ get: () => String(player.playbackRate), set: (v: string) => player.setRate(Number(v)) })
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        :class="cn('no-drag grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] font-medium tabular transition-colors hover:bg-foreground/8',
          player.playbackRate !== 1 ? 'text-brand' : 'text-muted-foreground hover:text-foreground', $props.class)"
        :aria-label="t('Playback speed')" :title="t('Playback speed')"
      >{{ label(player.playbackRate) }}</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="end" class="w-36 rounded-2xl p-1.5 shadow-float">
      <DropdownMenuLabel class="text-xs text-muted-foreground">{{ t('Playback speed') }}</DropdownMenuLabel>
      <DropdownMenuRadioGroup v-model="model">
        <DropdownMenuRadioItem v-for="r in RATES" :key="r" :value="String(r)" class="rounded-lg py-2">{{ label(r) }}<span v-if="r === 1" class="ms-2 text-muted-foreground">{{ t('Normal') }}</span></DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

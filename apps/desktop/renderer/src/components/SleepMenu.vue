<script setup lang="ts">
import { computed } from 'vue'
import { MoonStar } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { digits, nf, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player'

withDefaults(defineProps<{ class?: string }>(), {})
const player = usePlayerStore()
const active = computed(() => player.sleepMode !== 'off')
const remaining = computed(() => {
  if (player.sleepMode === 'track') return t('End of track')
  const mins = Math.ceil(player.sleepRemainingMs / 60_000)
  return digits(`${nf(mins)}${t('m')}`)
})
const model = computed({
  get: () => (player.sleepMode === 'track' ? 'track' : player.sleepMode === 'minutes' ? 'running' : 'off'),
  set: (v: string) => { if (v === 'off') player.setSleep('off'); else if (v === 'track') player.setSleep('track'); else if (v !== 'running') player.setSleep(Number(v)) },
})
const options = [15, 30, 45, 60]
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        :class="cn('no-drag flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors hover:bg-foreground/8',
          active ? 'text-brand' : 'text-muted-foreground hover:text-foreground', $props.class)"
        :aria-label="t('Sleep timer')" :title="active ? `${t('Sleep timer')}: ${remaining}` : t('Sleep timer')"
      >
        <MoonStar class="size-[18px]" /><span v-if="active" class="whitespace-nowrap tabular">{{ remaining }}</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" align="end" class="w-48 rounded-2xl p-1.5 shadow-float">
      <DropdownMenuLabel class="text-xs text-muted-foreground">{{ t('Sleep timer') }}</DropdownMenuLabel>
      <DropdownMenuRadioGroup v-model="model">
        <DropdownMenuRadioItem value="off" class="rounded-lg py-2">{{ t('Off') }}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem v-for="m in options" :key="m" :value="String(m)" class="rounded-lg py-2">{{ digits(`${m} ${t('minutes')}`) }}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="track" class="rounded-lg py-2">{{ t('End of this track') }}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

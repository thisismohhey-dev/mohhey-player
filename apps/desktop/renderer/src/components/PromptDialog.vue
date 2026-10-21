<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { activePrompt } from '@/composables/usePrompt'

const value = ref('')
const open = ref(false)
watch(activePrompt, (p) => { if (p) { value.value = p.initial; open.value = true } })

function finish(result: string | null): void {
  const p = activePrompt.value
  open.value = false
  activePrompt.value = null
  p?.resolve(result)
}
function submit(): void {
  const v = value.value.trim()
  if (v) finish(v)
}
</script>

<template>
  <Dialog :open="open" @update:open="(o: boolean) => { if (!o && activePrompt) finish(null) }">
    <DialogContent class="rounded-3xl sm:max-w-sm">
      <form @submit.prevent="submit">
        <DialogHeader><DialogTitle class="text-2xl font-medium">{{ activePrompt?.title }}</DialogTitle></DialogHeader>
        <label class="mt-4 block text-sm font-medium">
          {{ activePrompt?.label }}
          <Input v-model="value" class="mt-2 h-10 rounded-xl" maxlength="80" autofocus />
        </label>
        <DialogFooter class="mt-6">
          <Button type="button" variant="ghost" class="rounded-full" @click="finish(null)">Cancel</Button>
          <Button type="submit" class="rounded-full" :disabled="!value.trim()">{{ activePrompt?.confirmLabel }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

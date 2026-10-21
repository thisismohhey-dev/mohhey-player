<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

defineProps<{ message?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div role="alert" class="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
    <div class="mb-5 grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"><TriangleAlert class="size-6" :stroke-width="1.6" /></div>
    <p class="text-[15px] text-muted-foreground">{{ message ?? t('error.loadFailed') }}</p>
    <Button class="mt-5 rounded-full" variant="outline" @click="$emit('retry')">{{ t('error.retry') }}</Button>
  </div>
</template>

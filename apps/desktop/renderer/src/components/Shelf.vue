<script setup lang="ts">
defineProps<{ title: string; to?: object }>()
</script>

<template>
  <section class="px-8 pt-8" :aria-label="title">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="text-[26px] font-medium">{{ title }}</h2>
      <RouterLink v-if="to" :to="to" class="text-sm font-medium text-muted-foreground hover:text-foreground">See all</RouterLink>
    </div>
    <slot />
  </section>
</template>

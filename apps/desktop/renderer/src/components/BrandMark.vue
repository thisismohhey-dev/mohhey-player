<script setup lang="ts">
/** The "M." logo: bold M followed by the orange brand dot. */
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <span dir="ltr" role="img" aria-label="M. Player" class="font-display inline-block select-none font-bold leading-none tracking-tight" :style="{ fontSize: `${size}px` }">M<span class="text-brand">.</span></span>
</template>

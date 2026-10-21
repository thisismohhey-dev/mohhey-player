<script setup lang="ts">
/** The "M." logo: bold M followed by the round orange brand dot (same as the app icon). */
withDefaults(defineProps<{ size?: number }>(), { size: 32 })
</script>

<template>
  <span dir="ltr" role="img" aria-label="M. Player" class="font-display inline-block select-none whitespace-nowrap font-bold leading-none tracking-tight" :style="{ fontSize: `${size}px` }">M<span aria-hidden="true" class="ml-[0.06em] inline-block size-[0.2em] rounded-full bg-gradient-to-br from-[#ff7a4d] to-[#ff4a1a]" /></span>
</template>

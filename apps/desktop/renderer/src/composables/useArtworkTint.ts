import { computed, ref, watch, type Ref } from 'vue'
import { artUrl } from '@/lib/api'
import { hueFor } from '@/lib/format'

/** Colour (as an `hsl()` string base) derived from artwork; cached per image so it is computed once. */
const cache = new Map<string, { h: number; s: number }>()

function sample(url: string): Promise<{ h: number; s: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const size = 24
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)
      // Average in RGB, weighting each pixel by its saturation so a grey border doesn't wash out the tint.
      let r = 0, g = 0, b = 0, wsum = 0
      for (let i = 0; i < data.length; i += 4) {
        const R = data[i]!, G = data[i + 1]!, B = data[i + 2]!
        const max = Math.max(R, G, B), min = Math.min(R, G, B)
        const w = 0.05 + (max === 0 ? 0 : (max - min) / max)
        r += R * w; g += G * w; b += B * w; wsum += w
      }
      r /= wsum; g /= wsum; b /= wsum
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
      let h = 0
      if (d > 0) {
        if (max === r) h = ((g - b) / d) % 6
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h = Math.round(h * 60 + 360) % 360
      }
      resolve({ h, s: max === 0 ? 0 : d / max })
    }
    img.onerror = () => reject(new Error('artwork failed to load'))
    img.src = url
  })
}

/**
 * Tint colours for the glass player bar: taken from the current artwork, or from the same hue the cover placeholder uses.
 * Returns CSS custom properties to spread on the element's style.
 */
export function useArtworkTint(hash: Ref<string | null | undefined>, seed: Ref<string | undefined>) {
  const sampled = ref<{ h: number; s: number } | null>(null)

  watch(hash, async (hsh) => {
    sampled.value = null
    const url = artUrl(hsh)
    if (!hsh || !url) return
    const cached = cache.get(hsh)
    if (cached) { sampled.value = cached; return }
    try {
      const v = await sample(url)
      cache.set(hsh, v)
      if (hash.value === hsh) sampled.value = v
    } catch { /* keep the seed-based hue */ }
  }, { immediate: true })

  return computed(() => {
    const h = sampled.value?.h ?? hueFor(seed.value ?? '')
    // Dull artwork still gets a visible tint; vivid artwork is capped so text stays readable.
    const s = Math.round(55 + Math.min(1, sampled.value?.s ?? 0.6) * 35)
    return {
      '--glass-tint': `hsl(${h} ${s}% 58% / 0.34)`,
      '--glass-tint-2': `hsl(${(h + 48) % 360} ${s}% 62% / 0.22)`,
    } as Record<string, string>
  })
}

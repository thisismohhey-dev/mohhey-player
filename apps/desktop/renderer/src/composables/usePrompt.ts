import { ref } from 'vue'

export interface PromptRequest { title: string; label: string; initial: string; confirmLabel: string; resolve: (value: string | null) => void }

export const activePrompt = ref<PromptRequest | null>(null)

/** Opens the global text-prompt dialog. Resolves to the entered text, or null when cancelled. */
export function promptText(opts: { title: string; label: string; initial?: string; confirmLabel?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    activePrompt.value = { title: opts.title, label: opts.label, initial: opts.initial ?? '', confirmLabel: opts.confirmLabel ?? 'Save', resolve }
  })
}

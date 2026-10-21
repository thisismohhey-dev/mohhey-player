<script setup lang="ts">
import { ref, watch } from 'vue'
import { Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { trackBeingEdited } from '@/composables/useTrackEdit'
import { api, ApiClientError } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

const player = usePlayerStore()
const library = useLibraryStore()
const ui = useUiStore()
const open = ref(false)
const title = ref('')
const artist = ref('')
const album = ref('')
const busy = ref(false)

watch(trackBeingEdited, (tr) => {
  if (!tr) return
  title.value = tr.title; artist.value = tr.artist; album.value = tr.album
  open.value = true
})

function close(): void { open.value = false; trackBeingEdited.value = null }

async function apply(action: () => Promise<import('@mohhey/contracts').Track>, doneText: string): Promise<void> {
  busy.value = true
  try {
    const updated = await action()
    player.patchTrack(updated.id, updated)
    library.revision++ // lists, albums and artists refetch
    ui.toast(doneText)
    close()
  } catch (e) {
    ui.toast(e instanceof ApiClientError ? e.message : t('Couldn’t save the changes.'), 'error')
  } finally { busy.value = false }
}

const save = () => {
  const tr = trackBeingEdited.value
  if (!tr || !title.value.trim()) return Promise.resolve()
  return apply(() => api.tracks.editMetadata(tr.id, { title: title.value.trim(), artist: artist.value.trim(), album: album.value.trim() }), t('Saved'))
}
const reset = () => {
  const tr = trackBeingEdited.value
  if (!tr) return Promise.resolve()
  return apply(async () => {
    const r = await api.tracks.resetMetadata(tr.id)
    void library.rescan() // re-reads the file's own tags
    return r
  }, t('Restoring the original tags…'))
}
</script>

<template>
  <Dialog :open="open" @update:open="(o: boolean) => { if (!o) close() }">
    <DialogContent class="rounded-3xl sm:max-w-md">
      <form @submit.prevent="save">
        <DialogHeader><DialogTitle class="text-2xl font-medium">{{ t('Edit info') }}</DialogTitle></DialogHeader>
        <div class="mt-4 space-y-3">
          <label class="block text-sm font-medium">{{ t('Title') }}<Input v-model="title" dir="auto" class="mt-1.5 h-10 rounded-xl" maxlength="300" autofocus /></label>
          <label class="block text-sm font-medium">{{ t('Artist') }}<Input v-model="artist" dir="auto" class="mt-1.5 h-10 rounded-xl" maxlength="300" /></label>
          <label class="block text-sm font-medium">{{ t('Album') }}<Input v-model="album" dir="auto" class="mt-1.5 h-10 rounded-xl" maxlength="300" /></label>
        </div>
        <p class="mt-4 flex gap-2 rounded-xl bg-foreground/[0.05] p-3 text-[13px] leading-relaxed text-muted-foreground">
          <Info class="mt-0.5 size-4 shrink-0" />{{ t('Changes are saved in M. Player only. Your audio file is not modified.') }}
        </p>
        <DialogFooter class="mt-5 sm:justify-between">
          <Button v-if="trackBeingEdited?.edited" type="button" variant="ghost" class="rounded-full text-muted-foreground" :disabled="busy" @click="reset">{{ t('Restore original tags') }}</Button>
          <span v-else />
          <span class="flex gap-2">
            <Button type="button" variant="ghost" class="rounded-full" @click="close">{{ t('Cancel') }}</Button>
            <Button type="submit" class="rounded-full" :disabled="busy || !title.trim()">{{ t('Save') }}</Button>
          </span>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

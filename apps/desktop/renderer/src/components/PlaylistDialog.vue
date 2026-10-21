<script setup lang="ts">
import { ref, watch } from 'vue'
import { PLAYLIST_ICONS, type PlaylistIcon } from '@mohhey/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { activePlaylistDialog } from '@/composables/usePlaylistDialog'
import { t } from '@/lib/i18n'
import { PLAYLIST_ICON_COMPONENTS } from '@/lib/playlistIcons'
import { cn } from '@/lib/utils'

const name = ref('')
const icon = ref<PlaylistIcon>('list-music')
const open = ref(false)
watch(activePlaylistDialog, (d) => { if (d) { name.value = d.name; icon.value = d.icon; open.value = true } })

function finish(ok: boolean): void {
  const d = activePlaylistDialog.value
  open.value = false
  activePlaylistDialog.value = null
  d?.resolve(ok && name.value.trim() ? { name: name.value.trim(), icon: icon.value } : null)
}
</script>

<template>
  <Dialog :open="open" @update:open="(o: boolean) => { if (!o && activePlaylistDialog) finish(false) }">
    <DialogContent class="rounded-3xl sm:max-w-md">
      <form @submit.prevent="finish(true)">
        <DialogHeader>
          <DialogTitle class="text-2xl font-medium">{{ activePlaylistDialog?.mode === 'edit' ? t('Edit playlist') : t('New playlist') }}</DialogTitle>
        </DialogHeader>
        <label class="mt-4 block text-sm font-medium">
          {{ t('Name') }}
          <Input v-model="name" class="mt-2 h-10 rounded-xl" maxlength="80" autofocus />
        </label>
        <fieldset class="mt-5">
          <legend class="text-sm font-medium">{{ t('Icon') }}</legend>
          <div class="mt-2 grid grid-cols-5 gap-2" role="radiogroup" :aria-label="t('Icon')">
            <button
              v-for="key in PLAYLIST_ICONS" :key="key" type="button" role="radio" :aria-checked="icon === key" :aria-label="key"
              :class="cn('grid h-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground',
                icon === key && 'bg-brand/12 text-brand ring-2 ring-brand/60 hover:bg-brand/12 hover:text-brand')"
              @click="icon = key"
            ><component :is="PLAYLIST_ICON_COMPONENTS[key]" class="size-5" :stroke-width="1.7" /></button>
          </div>
        </fieldset>
        <DialogFooter class="mt-6">
          <Button type="button" variant="ghost" class="rounded-full" @click="finish(false)">{{ t('Cancel') }}</Button>
          <Button type="submit" class="rounded-full" :disabled="!name.trim()">{{ activePlaylistDialog?.mode === 'edit' ? t('Save') : t('Create') }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

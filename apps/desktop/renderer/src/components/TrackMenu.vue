<script setup lang="ts">
import { t } from '@/lib/i18n'
import { Disc3, Heart, ListEnd, ListMusic, ListPlus, PencilLine, Play, Trash2, UserRound } from 'lucide-vue-next'
import type { Track } from '@mohhey/contracts'
import {
  ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import { useTrackActions } from '@/composables/useTrackActions'
import { editTrackInfo } from '@/composables/useTrackEdit'
import { useLibraryStore } from '@/stores/library'

const props = defineProps<{ track: Track; removable?: boolean }>()
const emit = defineEmits<{ remove: [] }>()
const a = useTrackActions()
const library = useLibraryStore()
</script>

<template>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="a.play([props.track])"><Play class="size-4" />{{ t('Play') }}</ContextMenuItem>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="a.playNext([props.track])"><ListEnd class="size-4" />{{ t('Play next') }}</ContextMenuItem>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="a.addToQueue([props.track])"><ListPlus class="size-4" />{{ t('Add to queue') }}</ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuSub>
    <ContextMenuSubTrigger class="gap-2.5 rounded-lg py-2"><ListMusic class="size-4" />{{ t('Add to playlist') }}</ContextMenuSubTrigger>
    <ContextMenuSubContent class="w-52 rounded-2xl p-1.5 shadow-float">
      <ContextMenuItem class="rounded-lg py-2" @select="a.addToNewPlaylist([props.track])">{{ t('New playlist…') }}</ContextMenuItem>
      <ContextMenuSeparator v-if="library.playlists.length" />
      <ContextMenuItem v-for="p in library.playlists" :key="p.id" class="rounded-lg py-2" @select="a.addToPlaylist(p.id, [props.track])">
        <span class="truncate">{{ p.name }}</span>
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="a.toggleFavorite(props.track)">
    <Heart class="size-4" :class="props.track.favorite && 'fill-current text-brand'" />{{ t(props.track.favorite ? 'Remove from favorites' : 'Add to favorites') }}
  </ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" :disabled="!props.track.albumId" @select="a.goToAlbum(props.track)"><Disc3 class="size-4" />{{ t('Go to album') }}</ContextMenuItem>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" :disabled="!props.track.artistId" @select="a.goToArtist(props.track)"><UserRound class="size-4" />{{ t('Go to artist') }}</ContextMenuItem>
  <ContextMenuItem class="gap-2.5 rounded-lg py-2" @select="editTrackInfo(props.track)"><PencilLine class="size-4" />{{ t('Edit info…') }}</ContextMenuItem>
  <template v-if="removable">
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive" class="gap-2.5 rounded-lg py-2" @select="emit('remove')"><Trash2 class="size-4" />{{ t('Remove from playlist') }}</ContextMenuItem>
  </template>
</template>

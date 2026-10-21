<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ListMusic, Pencil, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { api, ApiClientError } from '@/lib/api'
import { formatLong, plural } from '@/lib/format'
import { t } from '@/lib/i18n'
import { iconFor } from '@/lib/playlistIcons'
import { usePlaylistActions } from '@/composables/usePlaylistActions'
import { useLoader } from '@/composables/useLoader'
import { arraySource } from '@/composables/usePagedTracks'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PageHero from '@/components/PageHero.vue'
import PlayActions from '@/components/PlayActions.vue'
import TrackList from '@/components/TrackList.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const actions = usePlaylistActions()
const library = useLibraryStore()
const ui = useUiStore()
const pid = computed(() => Number(props.id))

const { data, error, reload } = useLoader(async () => {
  const [playlist, tracks] = await Promise.all([api.playlists.get(pid.value), api.playlists.tracks(pid.value)])
  return { playlist, tracks }
}, [pid])
const source = computed(() => arraySource(data.value?.tracks ?? []))

const fail = (e: unknown, fallback: string) => ui.toast(e instanceof ApiClientError ? e.message : fallback, 'error')

async function editPlaylist(): Promise<void> {
  if (data.value && (await actions.edit(data.value.playlist))) await reload()
}

async function remove(): Promise<void> {
  if (data.value) await actions.remove(data.value.playlist, pid.value)
}

async function removeAt(index: number): Promise<void> {
  try { await api.playlists.removeAt(pid.value, index); await Promise.all([reload(), library.refreshPlaylists()]) } catch (e) { fail(e, t('Couldn’t remove that song.')) }
}

async function move(from: number, to: number): Promise<void> {
  // Optimistic reorder so the list doesn't jump while the request is in flight.
  const cur = data.value
  if (!cur) return
  const tracks = [...cur.tracks]
  const [m] = tracks.splice(from, 1)
  tracks.splice(to, 0, m!)
  data.value = { ...cur, tracks }
  try { await api.playlists.move(pid.value, from, to) } catch (e) { fail(e, t('Couldn’t reorder.')); await reload() }
}
</script>

<template>
  <ErrorState v-if="error" :message="error" @retry="reload" />
  <template v-else-if="data">
    <PageHero
      :title="data.playlist.name" :eyebrow="t('Playlist')" :icon="iconFor(data.playlist.icon)" :mosaic="data.playlist.coverHashes"
      :meta="[plural(data.playlist.trackCount, 'song'), data.playlist.durationMs ? formatLong(data.playlist.durationMs) : ''].filter(Boolean).join(' · ')"
    >
      <template #actions>
        <PlayActions :load="source.all" :disabled="!data.tracks.length" />
        <Button variant="ghost" size="icon" class="size-11 rounded-full" :aria-label="t('Edit playlist')" :title="t('Edit playlist')" @click="editPlaylist"><Pencil class="size-4" /></Button>
        <Button variant="ghost" size="icon" class="size-11 rounded-full text-destructive hover:text-destructive" :aria-label="t('Delete playlist')" :title="t('Delete')" @click="remove"><Trash2 class="size-4" /></Button>
      </template>
    </PageHero>
    <EmptyState v-if="!data.tracks.length" :icon="ListMusic" :title="t('empty.playlistTitle')" :body="t('empty.playlistBody')" />
    <div v-else class="px-4"><TrackList :source="source" numbered removable reorderable @remove="removeAt" @move="move" /></div>
  </template>
</template>

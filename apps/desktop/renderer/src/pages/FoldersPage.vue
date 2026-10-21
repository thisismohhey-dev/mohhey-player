<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Folder, FolderOpen, FolderTree } from 'lucide-vue-next'
import { api } from '@/lib/api'
import { plural } from '@/lib/format'
import { useLoader } from '@/composables/useLoader'
import { arraySource } from '@/composables/usePagedTracks'
import { useLibraryStore } from '@/stores/library'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import PlayActions from '@/components/PlayActions.vue'
import TrackList from '@/components/TrackList.vue'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const path = computed(() => (typeof route.query.path === 'string' ? route.query.path : ''))
const { data, loading, error, reload } = useLoader(() => api.library.browse(path.value), [path])
const source = computed(() => arraySource(data.value?.tracks ?? []))

const go = (p: string) => router.push(p ? { name: 'folders', query: { path: p } } : { name: 'folders' })

/** Breadcrumb: the library root it belongs to, then each sub-folder below it. */
const crumbs = computed(() => {
  const cur = data.value?.path
  if (!cur) return []
  const root = library.folders.map((f) => f.path).find((r) => cur === r || cur.startsWith(r.replace(/[\\/]$/, '') + (cur.includes('\\') ? '\\' : '/')))
  if (!root) return [{ name: cur, path: cur }]
  const sep = cur.includes('\\') ? '\\' : '/'
  const rootClean = root.replace(/[\\/]$/, '')
  const parts = cur.slice(rootClean.length).split(sep).filter(Boolean)
  const out = [{ name: rootClean.split(sep).filter(Boolean).pop() ?? rootClean, path: rootClean }]
  parts.forEach((part, i) => out.push({ name: part, path: rootClean + sep + parts.slice(0, i + 1).join(sep) }))
  return out
})
</script>

<template>
  <header class="px-8 pb-4 pt-6">
    <h1 class="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-none">Folders</h1>
    <nav v-if="crumbs.length" class="mt-4 flex flex-wrap items-center gap-1 text-[14px]" aria-label="Breadcrumb">
      <button class="rounded-full px-2 py-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" @click="go('')">All folders</button>
      <template v-for="(c, i) in crumbs" :key="c.path">
        <ChevronRight class="size-4 text-muted-foreground/60" aria-hidden="true" />
        <button
          dir="auto" class="max-w-[16rem] truncate rounded-full px-2 py-1 hover:bg-foreground/[0.06]"
          :class="i === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'"
          :aria-current="i === crumbs.length - 1 ? 'page' : undefined" @click="go(c.path)"
        >{{ c.name }}</button>
      </template>
    </nav>
    <p v-else class="mt-3 text-[15px] text-muted-foreground">Browse your music the way it’s organised on disk.</p>
  </header>

  <ErrorState v-if="error" :message="error" @retry="reload" />
  <div v-else-if="loading && !data" class="px-8 text-muted-foreground" role="status">Loading…</div>
  <template v-else-if="data">
    <EmptyState v-if="!data.folders.length && !data.tracks.length" :icon="FolderTree" title="This folder is empty" body="No songs were found here. Try rescanning from Settings." />

    <ul v-if="data.folders.length" class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 px-6" aria-label="Folders">
      <li v-for="f in data.folders" :key="f.path">
        <button
          class="group flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-start shadow-card transition-colors hover:bg-foreground/[0.04]"
          @click="go(f.path)" @dblclick.prevent
        >
          <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
            <FolderOpen class="hidden size-5 group-hover:block" :stroke-width="1.7" /><Folder class="size-5 group-hover:hidden" :stroke-width="1.7" />
          </span>
          <span class="min-w-0 flex-1">
            <span dir="auto" class="block truncate text-[15px] font-medium">{{ f.name }}</span>
            <span class="block text-[13px] text-muted-foreground">{{ plural(f.trackCount, 'song') }}</span>
          </span>
          <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <section v-if="data.tracks.length" class="mt-6" aria-label="Songs in this folder">
      <div class="flex items-center justify-between px-8 pb-2">
        <h2 class="text-[22px] font-medium">Songs <span class="text-base text-muted-foreground">· {{ data.tracks.length }}</span></h2>
        <div class="flex items-center gap-3"><PlayActions :load="source.all" /></div>
      </div>
      <div class="px-4"><TrackList :source="source" numbered /></div>
    </section>
  </template>
</template>

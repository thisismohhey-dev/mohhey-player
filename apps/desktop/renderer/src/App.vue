<script setup lang="ts">
import BrandMark from '@/components/BrandMark.vue'
import { t } from '@/lib/i18n'
import { onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { RouterView } from 'vue-router'
import MiniPlayer from '@/components/MiniPlayer.vue'
import NowPlaying from '@/components/NowPlaying.vue'
import Onboarding from '@/components/Onboarding.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import PlaylistDialog from '@/components/PlaylistDialog.vue'
import QueuePanel from '@/components/QueuePanel.vue'
import Sidebar from '@/components/Sidebar.vue'
import Toasts from '@/components/Toasts.vue'
import TopBar from '@/components/TopBar.vue'
import ErrorState from '@/components/ErrorState.vue'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { setLocale } from '@/lib/i18n'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'

const library = useLibraryStore()
const player = usePlayerStore()
const ui = useUiStore()
const mainScroll = ref<HTMLElement>()
provide('mainScroll', mainScroll)
const fatal = ref<string | null>(null)

async function boot(): Promise<void> {
  fatal.value = null
  try {
    const settings = await api.settings.get()
    setLocale(settings.locale)
    ui.setTheme(settings.theme)
    player.setRecordHistory(settings.recordHistory)
    await Promise.all([library.load(), player.init()])
  } catch (e) {
    fatal.value = e instanceof Error ? e.message : 'The library service is not available.'
  }
}

function onKey(e: KeyboardEvent): void {
  const el = e.target as HTMLElement | null
  if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return
  const mod = e.ctrlKey || e.metaKey
  if (e.code === 'Space' && !(el?.tagName === 'BUTTON')) { e.preventDefault(); void player.togglePlay() }
  else if (mod && e.key === 'ArrowRight') { e.preventDefault(); player.next() }
  else if (mod && e.key === 'ArrowLeft') { e.preventDefault(); player.previous() }
  else if (mod && e.key === 'ArrowUp') { e.preventDefault(); player.setVolume(player.volume + 0.05) }
  else if (mod && e.key === 'ArrowDown') { e.preventDefault(); player.setVolume(player.volume - 0.05) }
  else if (!mod && !e.altKey && e.key.toLowerCase() === 'm') player.toggleMute()
  else if (mod && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); ui.setMiniMode(!ui.miniMode) }
  else if (mod && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); ui.toggleSidebar() }
  else if (!mod && !e.altKey && e.key.toLowerCase() === 'q') ui.queueOpen = !ui.queueOpen
}

const offs: (() => void)[] = []
const media = matchMedia('(prefers-color-scheme: dark)')
const onScheme = () => { if (ui.theme === 'system') ui.applyTheme() }
onMounted(() => {
  // The tray (main process) can leave mini mode or issue playback commands on its own.
  offs.push(window.mohhey.onMiniChange((mini) => { ui.miniMode = mini }))
  offs.push(window.mohhey.onTrayCommand((cmd) => { if (cmd === 'play-pause') void player.togglePlay(); else if (cmd === 'next') player.next(); else player.previous() }))
  void boot(); window.addEventListener('keydown', onKey); media.addEventListener('change', onScheme) })
onBeforeUnmount(() => { offs.forEach((off) => off()); window.removeEventListener('keydown', onKey); media.removeEventListener('change', onScheme) })
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <ErrorState v-if="fatal" :message="fatal" class="h-full" @retry="boot" />
    <div v-else-if="!library.loaded" class="grid h-full place-items-center" role="status" :aria-label="t('Loading')">
      <BrandMark :size="56" />
    </div>
    <Onboarding v-else-if="!library.hasLibrary" />
    <template v-else>
    <MiniPlayer v-if="ui.miniMode" class="h-full" />
    <div v-show="!ui.miniMode" class="relative flex h-full overflow-hidden">
      <Sidebar />
      <div class="relative flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main ref="mainScroll" class="relative min-h-0 [scrollbar-gutter:stable] flex-1 overflow-y-auto overflow-x-hidden pb-[148px]" tabindex="-1">
          <RouterView v-slot="{ Component, route }">
            <Transition name="page" mode="out-in">
              <component :is="Component" :key="route.name === 'search' ? 'search' : route.fullPath" />
            </Transition>
          </RouterView>
        </main>
        <PlayerBar />
        <Transition name="slide"><QueuePanel v-if="ui.queueOpen" /></Transition>
      </div>
      <Transition name="fade"><NowPlaying v-if="ui.nowPlayingOpen" /></Transition>
    </div>
    </template>
    <PlaylistDialog />
    <Toasts />
  </TooltipProvider>
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity .16s ease, transform .16s ease; }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to { opacity: 0; }
.slide-enter-active, .slide-leave-active { transition: transform .26s cubic-bezier(.2,.8,.2,1), opacity .2s; }
.slide-enter-from, .slide-leave-to { transform: translateX(24px); opacity: 0; }
[dir='rtl'] .slide-enter-from, [dir='rtl'] .slide-leave-to { transform: translateX(-24px); }
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

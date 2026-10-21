import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  // Hash history works under both the dev server and the custom app:// protocol.
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/songs', name: 'songs', component: () => import('@/pages/SongsPage.vue') },
    { path: '/albums', name: 'albums', component: () => import('@/pages/AlbumsPage.vue') },
    { path: '/albums/:id(\\d+)', name: 'album', component: () => import('@/pages/AlbumPage.vue'), props: true },
    { path: '/artists', name: 'artists', component: () => import('@/pages/ArtistsPage.vue') },
    { path: '/artists/:id(\\d+)', name: 'artist', component: () => import('@/pages/ArtistPage.vue'), props: true },
    { path: '/folders', name: 'folders', component: () => import('@/pages/FoldersPage.vue') },
    { path: '/favorites', name: 'favorites', component: () => import('@/pages/FavoritesPage.vue') },
    { path: '/playlists', name: 'playlists', component: () => import('@/pages/PlaylistsPage.vue') },
    { path: '/playlists/:id(\\d+)', name: 'playlist', component: () => import('@/pages/PlaylistPage.vue'), props: true },
    { path: '/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

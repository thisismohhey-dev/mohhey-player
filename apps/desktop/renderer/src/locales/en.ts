/** All user-facing copy lives here so it can be translated (and RTL locales added) without touching components. */
export const en = {
  appName: 'M. Player',
  nav: {
    home: 'Home', songs: 'Songs', folders: 'Folders', albums: 'Albums', artists: 'Artists', favorites: 'Favorites',
    playlists: 'Playlists', search: 'Search', settings: 'Settings', library: 'Library', newPlaylist: 'New playlist',
  },
  player: {
    play: 'Play', pause: 'Pause', next: 'Next track', previous: 'Previous track', shuffle: 'Shuffle', repeat: 'Repeat',
    repeatOff: 'Repeat off', repeatAll: 'Repeat queue', repeatOne: 'Repeat track', mute: 'Mute', unmute: 'Unmute',
    volume: 'Volume', seek: 'Seek', queue: 'Queue', nowPlaying: 'Now playing', nothingPlaying: 'Nothing playing',
    favorite: 'Add to favorites', unfavorite: 'Remove from favorites', buffering: 'Buffering…', loading: 'Loading…',
  },
  empty: {
    libraryTitle: 'Bring your music home',
    libraryBody: 'Choose a folder and M. Player will read your tracks, artwork and albums. Nothing leaves your computer.',
    chooseFolder: 'Choose a folder',
    songsTitle: 'No songs here yet', songsBody: 'Add a music folder to fill your library.',
    favoritesTitle: 'No favorites yet', favoritesBody: 'Tap the heart on any song and it will appear here.',
    playlistsTitle: 'No playlists yet', playlistsBody: 'Create one, then add songs from anywhere in the app.',
    playlistTitle: 'This playlist is empty', playlistBody: 'Right-click any song and choose “Add to playlist”.',
    searchTitle: 'Nothing found', searchBody: 'Try a different spelling, or search by artist or album.',
    searchStart: 'Search your library',
    queueTitle: 'Your queue is empty', queueBody: 'Play something and what’s next shows up here.',
    historyTitle: 'Nothing played yet', historyBody: 'Songs you play will be listed here.',
  },
  error: { loadFailed: 'Something went wrong while loading.', retry: 'Try again' },
} as const

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Path<typeof en>

type DeepStr<T> = { [K in keyof T]: T[K] extends string ? string : DeepStr<T[K]> }
export type Messages = DeepStr<typeof en>

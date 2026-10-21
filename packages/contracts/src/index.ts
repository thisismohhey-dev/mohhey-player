export * from './library'
export * from './playlists'
export * from './settings'
export * from './bridge'
export const API_ERROR_CODES = ['validation', 'not_found', 'conflict', 'unauthorized', 'internal'] as const
export interface ApiError { code: (typeof API_ERROR_CODES)[number]; message: string }

import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Early builds ran under the package name, so their data lived in `<appData>/@mohhey/desktop`. The app now always uses
 * `<appData>/Mohhey Player` (development and installed builds alike). The first time the new folder has no library,
 * copy the old one over; the old folder is left untouched as a backup.
 * Returns true when something was copied.
 */
export function migrateLegacyUserData(legacyDir: string, currentDir: string): boolean {
  const legacyDb = join(legacyDir, 'data', 'library.db')
  const currentDb = join(currentDir, 'data', 'library.db')
  if (existsSync(currentDb) || !existsSync(legacyDb)) return false
  cpSync(join(legacyDir, 'data'), join(currentDir, 'data'), { recursive: true, errorOnExist: false, force: false })
  const state = join(legacyDir, 'window-state.json')
  if (existsSync(state)) cpSync(state, join(currentDir, 'window-state.json'), { force: false })
  return true
}

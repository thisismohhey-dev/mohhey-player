import { extname, isAbsolute } from 'node:path'

/** Same list the library scanner accepts. */
export const AUDIO_EXTENSIONS: readonly string[] = ['.mp3', '.flac', '.ogg', '.oga', '.opus', '.wav', '.m4a', '.aac', '.weba']
const MAX_FILES = 200

/**
 * Picks the audio files out of a command line (what Windows passes when a file is opened with the app).
 * Only absolute paths with a known audio extension survive; flags and everything else are ignored.
 */
export function audioPathsFromArgv(argv: readonly string[]): string[] {
  const out: string[] = []
  for (const arg of argv) {
    if (typeof arg !== 'string' || arg.startsWith('-') || arg.length > 4096) continue
    if (!isAbsolute(arg) || !AUDIO_EXTENSIONS.includes(extname(arg).toLowerCase())) continue
    if (!out.includes(arg)) out.push(arg)
    if (out.length >= MAX_FILES) break
  }
  return out
}

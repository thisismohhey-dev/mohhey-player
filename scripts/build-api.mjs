// Compiles the Elysia API into a single self-contained executable (Bun runtime included) that the installer ships.
// Output: apps/desktop/build/api/mohhey-api(.exe)
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'apps/desktop/build/api')
mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, process.platform === 'win32' ? 'mohhey-api.exe' : 'mohhey-api')

const result = await Bun.build({
  entrypoints: [join(root, 'apps/api/src/main.ts')],
  compile: { outfile },
  minify: true,
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log('API executable written to', outfile)

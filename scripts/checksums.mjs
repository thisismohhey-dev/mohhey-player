// Writes dist/SHA256SUMS.txt for the installer so a download can be verified. Run after `bun run dist`.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '../apps/desktop/dist')
const lines = readdirSync(dist).filter((f) => f.endsWith('.exe') && f.includes('Setup')).map((f) => `${createHash('sha256').update(readFileSync(join(dist, f))).digest('hex')}  ${f}`)
writeFileSync(join(dist, 'SHA256SUMS.txt'), lines.join('\n') + '\n')
console.log(lines.join('\n'))

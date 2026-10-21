// Renders apps/desktop/resources/icon.svg into icon.png (512), tray PNGs and a multi-size icon.ico.
// Run with: bun scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const dir = resolve(import.meta.dirname, '../apps/desktop/resources')
const svg = readFileSync(join(dir, 'icon.svg'))
const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

writeFileSync(join(dir, 'icon.png'), render(512))
writeFileSync(join(dir, 'tray.png'), render(32))
writeFileSync(resolve(dir, '../renderer/public/favicon.png'), render(64))
writeFileSync(join(dir, 'tray@2x.png'), render(64))
writeFileSync(join(dir, 'icon.ico'), await pngToIco([16, 24, 32, 48, 64, 128, 256].map(render)))
console.log('icons written to', dir)

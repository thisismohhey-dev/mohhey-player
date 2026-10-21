// Draws the installer's side panel and header (NSIS needs 24-bit BMPs) in the same look as the app:
// warm paper, the "M." logo, Neue Montreal type, soft vermilion / lilac glows.
// Run with: bun scripts/make-installer-art.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const root = resolve(import.meta.dirname, '..')
const outDir = join(root, 'apps/desktop/resources/installer')
const fonts = ['Montreal-Bold.otf', 'Montreal-Regular.ttf'].map((f) => join(root, 'apps/desktop/renderer/src/assets/fonts', f))
mkdirSync(outDir, { recursive: true })

/** The "M." mark (outline of PP Neue Montreal Bold "M" + brand dot), authored in a 512-unit box. */
const MARK = `<path fill="#171614" d="M151.06 373.98L151.06 227.13L151.72 227.13L195.61 373.98L237.19 373.98L281.08 227.13L281.74 227.13L281.74 373.98L337.84 373.98L337.84 138.03L265.24 138.03L216.73 288.5L216.07 288.5L167.56 138.03L94.96 138.03L94.96 373.98Z"/><circle cx="389" cy="345.9" r="28.1" fill="url(#dot)"/>`
const DEFS = `<defs>
  <linearGradient id="dot" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a4d"/><stop offset="1" stop-color="#ff4a1a"/></linearGradient>
  <radialGradient id="warm" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff5b2e" stop-opacity="0.26"/><stop offset="1" stop-color="#ff5b2e" stop-opacity="0"/></radialGradient>
  <radialGradient id="cool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7078ff" stop-opacity="0.20"/><stop offset="1" stop-color="#7078ff" stop-opacity="0"/></radialGradient>
</defs>`

const sidebar = (version) => `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314" viewBox="0 0 164 314">
  ${DEFS}
  <rect width="164" height="314" fill="#f4f2ee"/>
  <circle cx="150" cy="10" r="150" fill="url(#warm)"/>
  <circle cx="-10" cy="320" r="150" fill="url(#cool)"/>
  <g transform="translate(-2.5 -1.4) scale(0.3)">${MARK}</g>
  <text x="26" y="176" font-family="PP Neue Montreal" font-weight="700" font-size="25" fill="#171614" letter-spacing="-0.4">Mohhey</text>
  <text x="26" y="203" font-family="PP Neue Montreal" font-weight="400" font-size="19" fill="#171614">Player</text>
  <rect x="26" y="222" width="22" height="3" rx="1.5" fill="#ff5b2e"/>
  <text x="26" y="246" font-family="PP Neue Montreal" font-weight="400" font-size="11" fill="#6f6b63">Your music,</text>
  <text x="26" y="261" font-family="PP Neue Montreal" font-weight="400" font-size="11" fill="#6f6b63">beautifully offline.</text>
  <text x="26" y="296" font-family="PP Neue Montreal" font-weight="400" font-size="10" fill="#9a968d">Version ${version}</text>
</svg>`

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57" viewBox="0 0 150 57">
  ${DEFS}
  <rect width="150" height="57" fill="#f4f2ee"/>
  <circle cx="150" cy="0" r="70" fill="url(#warm)"/>
  <g transform="translate(54 -15) scale(0.17)">${MARK}</g>
</svg>`

/** Renders SVG to an opaque 24-bit BMP (bottom-up rows padded to 4 bytes), the format NSIS expects. */
function toBmp(svg) {
  const img = new Resvg(svg, { font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'PP Neue Montreal' } }).render()
  const { width, height } = img
  const px = img.pixels
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const buf = Buffer.alloc(54 + rowSize * height)
  buf.write('BM', 0); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(width, 18); buf.writeInt32LE(height, 22)
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(rowSize * height, 34)
  for (let y = 0; y < height; y++) {
    const rowStart = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = px[i + 3] / 255
      // flatten onto the paper colour in case of any transparency
      buf[rowStart + x * 3] = Math.round(px[i + 2] * a + 0xee * (1 - a))
      buf[rowStart + x * 3 + 1] = Math.round(px[i + 1] * a + 0xf2 * (1 - a))
      buf[rowStart + x * 3 + 2] = Math.round(px[i] * a + 0xf4 * (1 - a))
    }
  }
  return { bmp: buf, png: img.asPng() }
}

const version = JSON.parse((await Bun.file(join(root, 'apps/desktop/package.json')).text())).version
for (const [name, svg] of [['sidebar', sidebar(version)], ['header', header]]) {
  const { bmp, png } = toBmp(svg)
  writeFileSync(join(outDir, `${name}.bmp`), bmp)
  writeFileSync(join(outDir, `${name}.preview.png`), png) // handy for README / review, not used by the build
  console.log('wrote', name)
}

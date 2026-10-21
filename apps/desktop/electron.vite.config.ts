import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'electron-vite'
import pkg from './package.json'

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve(__dirname, 'electron/main/index.ts') } } },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload/index.ts') },
        // Sandboxed preload scripts must be CommonJS.
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'renderer'),
    build: { rollupOptions: { input: { index: resolve(__dirname, 'renderer/index.html') } } },
    resolve: { alias: { '@': resolve(__dirname, 'renderer/src') } },
    // The app version shown in Settings > About comes from package.json (see scripts/bump-version.mjs).
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [vue(), tailwindcss()],
  },
})

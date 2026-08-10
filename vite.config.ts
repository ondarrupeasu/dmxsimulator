import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Human version (bump on each release) + exact git commit injected at build time,
// so the corner badge always tells us precisely what is running.
const appVersion: string = JSON.parse(readFileSync('./package.json', 'utf8')).version
const buildCommit: string = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
})()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  // Served from the root of a custom domain (dmxsimulator.cinemafilmak.com),
  // matching the house pattern (QRClapper, AVHandbook, SoundLab).
  base: '/',
  // Honour the PORT assigned by the harness/host, fall back to Vite's default.
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DMXSimulatoR',
        short_name: 'DMXSim',
        description: 'Learn DMX lighting by doing — patch, program, and see the result.',
        theme_color: '#0e0e12',
        background_color: '#0e0e12',
        display: 'standalone',
        icons: [
          { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

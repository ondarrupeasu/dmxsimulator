import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built app works under a GitHub Pages subpath.
  base: './',
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
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})

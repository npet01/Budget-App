/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relativer Pfad, damit die App auch unter GitHub Pages (/repo-name/) läuft
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Was kostet mich das wirklich?',
        short_name: 'Arbeitszeit',
        description: 'Preise in Arbeitszeit umrechnen und sehen, wann du dir etwas leisten kannst.',
        lang: 'de',
        start_url: '.',
        display: 'standalone',
        background_color: '#f6f5f1',
        theme_color: '#1f6f5c',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
        // Produkte aus Shop-Apps über das Teilen-Menü empfangen (Android)
        share_target: {
          action: './?share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})

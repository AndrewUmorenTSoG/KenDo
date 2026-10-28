import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      devOptions: { enabled: false, type: 'module' },
      manifest: {
        name: 'KenDo',
        short_name: 'KenDo',
        description: 'A little more intentional. Tasks, notes and focus for Kenny.',
        theme_color: '#482b42',
        background_color: '#f8f6f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Quick add', url: '/tasks?new=1' },
          { name: 'Today', url: '/' },
        ],
      },
    }),
  ],
})

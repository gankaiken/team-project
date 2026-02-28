import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      'use-sync-external-store/shim/with-selector.js': '/src/shims/useSyncExternalStoreWithSelectorShim.js',
      'stats.js': '/node_modules/stats.js/src/Stats.js',
      'stats.js/build/stats.min.js': '/node_modules/stats.js/src/Stats.js'
    }
  },
  optimizeDeps: {
    // Avoid stale pre-bundled chunks for react-three stack in this environment.
    exclude: ['@react-three/drei', '@react-three/fiber', 'three', 'stats.js']
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})

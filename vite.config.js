import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet:  ['leaflet', 'react-leaflet'],
          recharts: ['recharts'],
          xlsx:     ['xlsx'],
        },
      },
    },
  },
})

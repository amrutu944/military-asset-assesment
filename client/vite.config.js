import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // The demo build is hosted as a static page under an arbitrary path
  base: mode === 'demo' ? './' : '/',
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
}))

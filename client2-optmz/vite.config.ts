import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Stable vendor chunks cache across deploys and keep page chunks small.
        codeSplitting: {
          groups: [
            { name: 'vendor-charts', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|es-toolkit)[\\/]/, priority: 30 },
            { name: 'vendor-motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 25 },
            { name: 'vendor-realtime', test: /node_modules[\\/]@microsoft[\\/]signalr[\\/]/, priority: 20 },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 15 },
            { name: 'vendor-icons', test: /node_modules[\\/]react-icons[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    // Pinned rather than left to Vite's default so the API's CORS allowlist and the
    // docs can name a stable port. strictPort fails fast instead of silently
    // incrementing to 5176 and leaving the browser pointed at a dead API.
    port: 5175,
    strictPort: true,
  },
})

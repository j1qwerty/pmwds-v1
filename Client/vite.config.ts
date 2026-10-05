import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pinned rather than left to Vite's default so the API's CORS allowlist and the
    // docs can name a stable port. strictPort fails fast instead of silently
    // incrementing to 5176 and leaving the browser pointed at a dead API.
    port: 5175,
    strictPort: true,
  },
})

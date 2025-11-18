import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { apiPlugin } from './vite-plugin-api'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  base: '/migration-hub-ui/',
  server: {
    port: 5173,
  },
})

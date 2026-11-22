import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load .env files from the repo root (one level up from Frontend/)
  envDir: '..',
})

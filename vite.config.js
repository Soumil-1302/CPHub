import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: 'Frontend',
  plugins: [react()],
  // Keep the repository root as the shared environment-file location.
  envDir: '..',
})

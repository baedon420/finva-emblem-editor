import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works when hosted under a sub-path
  // (e.g. GitHub Pages at username.github.io/mgo2-emblem-studio/).
  base: './',
  plugins: [react()],
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves project sites from /<repo>/ — override with BASE_PATH
// if you deploy to a custom domain or a user/org page instead.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/xproeditor/',
  plugins: [react()],
  server: {
    host: true,
    port: 5175,
    strictPort: true,
  },
})

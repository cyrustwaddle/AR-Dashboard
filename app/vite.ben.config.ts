import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ben-facing dashboard build.
// Second Vercel project settings:
//   Root directory:    app
//   Build command:     npm run build:ben
//   Output directory:  dist-ben
//   Env vars:          VITE_SUPABASE_URL, VITE_BEN_SUPABASE_ANON_KEY
export default defineConfig({
  root: 'ben',
  plugins: [react()],
  build: {
    outDir: '../dist-ben',
    emptyOutDir: true,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ben-facing dashboard build.
// Second Vercel project settings:
//   Root directory:    app
//   Build command:     npm run build:ben
//   Output directory:  dist-ben
//   Env vars:
//     VITE_SUPABASE_URL         — same as main project
//     VITE_BEN_SUPABASE_ANON_KEY — MUST be a custom JWT with role:"ben_viewer"
//                                  (not the standard anon key — anon reads raw tables)
//                                  Generate: node scripts/gen_ben_jwt.mjs <JWT_SECRET>
//                                  JWT secret: Supabase dashboard → Settings → API
export default defineConfig({
  root: 'ben',
  plugins: [react()],
  build: {
    outDir: '../dist-ben',
    emptyOutDir: true,
  },
})

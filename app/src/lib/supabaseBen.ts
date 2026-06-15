import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
// Supabase's Kong gateway validates `apikey` against registered keys only —
// a custom JWT is rejected there even if the signature is valid. So we always
// pass the standard anon key as apikey, but override the Authorization header
// with the ben_viewer JWT. PostgREST reads the role from Authorization, switches
// to ben_viewer, and the DB blocks direct access to artists/onboarding tables.
//
// VITE_BEN_SUPABASE_ANON_KEY = ben_viewer JWT (generate: node scripts/gen_ben_jwt.mjs <SECRET>)
// Falls back to anon key for local dev (views still filter correctly, base tables accessible).
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const benViewerJwt = (import.meta.env.VITE_BEN_SUPABASE_ANON_KEY || anonKey) as string

export const supabaseBen = createClient(supabaseUrl, anonKey, {
  global: {
    headers: { Authorization: `Bearer ${benViewerJwt}` },
  },
})

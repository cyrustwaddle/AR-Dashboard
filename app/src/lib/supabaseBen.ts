import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
// VITE_BEN_SUPABASE_ANON_KEY must be a custom JWT signed with role:"ben_viewer"
// (NOT the standard anon key — that key can read the raw artists table directly).
// Generate it with: node scripts/gen_ben_jwt.mjs <SUPABASE_JWT_SECRET>
// Falls back to the regular anon key for local dev only (less secure, views still filter correctly).
const supabaseAnonKey = (
  import.meta.env.VITE_BEN_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
) as string

export const supabaseBen = createClient(supabaseUrl, supabaseAnonKey)

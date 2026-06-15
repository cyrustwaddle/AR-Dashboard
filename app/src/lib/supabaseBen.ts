import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
// Set VITE_BEN_SUPABASE_ANON_KEY in the Ben Vercel project's env vars.
// Falls back to the main key for local development.
const supabaseAnonKey = (
  import.meta.env.VITE_BEN_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
) as string

export const supabaseBen = createClient(supabaseUrl, supabaseAnonKey)

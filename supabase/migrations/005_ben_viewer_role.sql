-- Secure the Ben-facing dashboard.
--
-- Problem: The existing "allow all artists" RLS policy lets the anon role SELECT
-- the raw artists table directly — bypassing ben_pipeline_view and exposing
-- notes, next_action, last_contact, etc. to anyone with the anon key.
--
-- Fix: Create a dedicated ben_viewer PostgreSQL role that can ONLY read the two
-- Ben views. Ben's client uses a custom-signed JWT with role:"ben_viewer" instead
-- of the standard anon JWT. Direct queries to artists/onboarding return empty
-- (no RLS policy for ben_viewer on those tables).
--
-- How the views still work:
--   PostgreSQL views are SECURITY DEFINER by default (security_invoker = off),
--   meaning they execute as their owner (postgres/supabase_admin). That owner
--   is a superuser who bypasses RLS, so the view can read artists even though
--   ben_viewer itself has no policy on artists.
--
-- Run this in the Supabase SQL editor AFTER running 004_ben_views.sql.

-- 1. Create the role (idempotent)
DO $$ BEGIN
  CREATE ROLE ben_viewer NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow PostgREST to switch to ben_viewer when a JWT with role:"ben_viewer" arrives.
--    Without this, PostgREST rejects the JWT with "role not found".
GRANT ben_viewer TO authenticator;

-- 3. Allow ben_viewer to use the public schema
GRANT USAGE ON SCHEMA public TO ben_viewer;

-- 4. Grant read access to only the two Ben views — nothing else
GRANT SELECT ON ben_pipeline_view  TO ben_viewer;
GRANT SELECT ON ben_onboarding_view TO ben_viewer;

-- 5. Explicitly confirm views use owner-level execution (security_invoker = off).
--    This is the PostgreSQL default but being explicit guards against accidental
--    ALTER VIEW ... SET (security_invoker = on) in the future.
ALTER VIEW ben_pipeline_view  SET (security_invoker = off);
ALTER VIEW ben_onboarding_view SET (security_invoker = off);

-- Verify: after running this migration, test with curl:
--
--   # Should return [] or {} (no policy for ben_viewer on raw artists table)
--   curl "${SUPABASE_URL}/rest/v1/artists?select=id,artist_name,notes&limit=2" \
--     -H "apikey: ${BEN_JWT}" -H "Authorization: Bearer ${BEN_JWT}"
--
--   # Should return filtered artist rows (only ben_sendable=true, no internal fields)
--   curl "${SUPABASE_URL}/rest/v1/ben_pipeline_view?select=id,artist_name&limit=2" \
--     -H "apikey: ${BEN_JWT}" -H "Authorization: Bearer ${BEN_JWT}"

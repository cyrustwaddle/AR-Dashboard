-- Ben-facing read-only views.
-- Filters to ben_sendable = true. Excludes internal fields:
--   notes, last_contact, next_action, next_action_date,
--   tiktok_followers_prev, spotify_mls_prev, ben_sendable, created_at, updated_at.

CREATE OR REPLACE VIEW ben_pipeline_view AS
SELECT
  id,
  artist_name,
  genre_lane,
  location,
  tiktok_url,
  spotify_url,
  instagram_url,
  source,
  date_added,
  month,
  tiktok_followers,
  tiktok_avg_views,
  tiktok_ugc_count,
  spotify_monthly_listeners,
  spotify_top_track_streams,
  spotify_playlist_presence,
  instagram_followers,
  stage,
  manager_team
FROM artists
WHERE ben_sendable = true;

CREATE OR REPLACE VIEW ben_onboarding_view AS
SELECT
  o.id,
  o.artist_id,
  a.artist_name,
  a.month,
  o.spotify_discovered_on,
  o.spotify_similar_artists,
  o.spotify_radio,
  o.tiktok_follow,
  o.interact_3_posts,
  o.soundcloud_radio
FROM onboarding o
JOIN artists a ON a.id = o.artist_id
WHERE a.ben_sendable = true;

-- Grant SELECT on views to the anon role used by Ben's client.
GRANT SELECT ON ben_pipeline_view  TO anon;
GRANT SELECT ON ben_onboarding_view TO anon;

-- ----------------------------------------------------------------
-- Stricter isolation (optional, run manually if needed):
-- Creates a dedicated DB role that can ONLY read the two views.
-- Pair with a custom-signed JWT (role: "ben_viewer") as Ben's key.
-- ----------------------------------------------------------------
-- CREATE ROLE ben_viewer NOLOGIN;
-- GRANT USAGE ON SCHEMA public TO ben_viewer;
-- GRANT SELECT ON ben_pipeline_view  TO ben_viewer;
-- GRANT SELECT ON ben_onboarding_view TO ben_viewer;
-- REVOKE SELECT ON artists    FROM anon;
-- REVOKE SELECT ON onboarding FROM anon;

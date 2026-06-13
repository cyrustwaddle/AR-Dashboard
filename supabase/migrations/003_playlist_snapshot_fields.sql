-- Add snapshot-based diff fields to tracked_playlists.
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE tracked_playlists
  ADD COLUMN IF NOT EXISTS last_snapshot_track_ids  text[],
  ADD COLUMN IF NOT EXISTS new_tracks_since_last_check integer;

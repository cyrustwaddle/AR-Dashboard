export interface Playlist {
  id: string
  playlist_id: string
  name: string
  last_checked_at: string | null
  total_tracks: number
  last_snapshot_offset: number
  last_snapshot_track_ids: string[] | null
  new_tracks_since_last_check: number | null
}

export interface PlaylistTrack {
  id: string
  playlist_id: string
  track_id: string
  track_name: string
  artist_name: string
  added_at: string
}

export interface Contact {
  id: string
  name: string
  company: string | null
  spotify_url: string | null
  checked: boolean
}

export interface Playlist {
  id: string
  playlist_id: string
  name: string
  last_checked_at: string | null
  total_tracks: number
  last_snapshot_offset: number
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

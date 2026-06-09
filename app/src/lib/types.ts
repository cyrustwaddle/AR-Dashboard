export type Source = 'TikTok FYP' | 'Referral' | 'Instagram' | 'Other'
export type PlaylistPresence = 'None' | 'Algorithmic' | 'Editorial' | 'Both'
export type Stage = 'Radar' | 'Contacted' | 'In Conversation' | 'Passed to Ben' | 'Passed' | 'Signed'

export interface Artist {
  id: string
  created_at: string
  updated_at: string
  month: string

  artist_name: string
  genre_lane: string | null
  location: string | null
  tiktok_url: string | null
  spotify_url: string | null
  instagram_url: string | null
  source: Source | null
  date_added: string | null

  tiktok_followers: number | null
  tiktok_followers_prev: number | null
  tiktok_avg_views: number | null
  tiktok_ugc_count: number | null

  spotify_monthly_listeners: number | null
  spotify_mls_prev: number | null
  spotify_top_track_streams: number | null
  spotify_playlist_presence: PlaylistPresence | null

  instagram_followers: number | null

  stage: Stage | null
  ben_sendable: boolean | null
  last_contact: string | null
  next_action: string | null
  next_action_date: string | null
  manager_team: string | null
  notes: string | null
}

export interface Onboarding {
  id: string
  artist_id: string
  spotify_discovered_on: boolean
  spotify_similar_artists: boolean
  spotify_radio: boolean
  tiktok_follow: boolean
  interact_3_posts: boolean
  soundcloud_radio: boolean
}

// month omitted from required insert fields — DB defaults to current month; override explicitly when needed
export type ArtistInsert = Omit<Artist, 'id' | 'created_at' | 'updated_at' | 'month'> & { month?: string }
export type ArtistUpdate = Partial<ArtistInsert>

export interface Database {
  public: {
    Tables: {
      artists: {
        Row: Artist
        Insert: ArtistInsert
        Update: ArtistUpdate
        Relationships: []
      }
      onboarding: {
        Row: Onboarding
        Insert: Omit<Onboarding, 'id'>
        Update: Partial<Omit<Onboarding, 'id' | 'artist_id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export interface ArtistWithGrowth extends Artist {
  tiktok_growth_pct: number | null
  spotify_growth_pct: number | null
}

export function computeGrowth(artist: Artist): ArtistWithGrowth {
  const tiktok_growth_pct =
    artist.tiktok_followers != null && artist.tiktok_followers_prev != null && artist.tiktok_followers_prev !== 0
      ? ((artist.tiktok_followers - artist.tiktok_followers_prev) / artist.tiktok_followers_prev) * 100
      : null

  const spotify_growth_pct =
    artist.spotify_monthly_listeners != null && artist.spotify_mls_prev != null && artist.spotify_mls_prev !== 0
      ? ((artist.spotify_monthly_listeners - artist.spotify_mls_prev) / artist.spotify_mls_prev) * 100
      : null

  return { ...artist, tiktok_growth_pct, spotify_growth_pct }
}

export const SOURCES: Source[] = ['TikTok FYP', 'Referral', 'Instagram', 'Other']
export const PLAYLIST_PRESENCES: PlaylistPresence[] = ['None', 'Algorithmic', 'Editorial', 'Both']
export const STAGES: Stage[] = ['Radar', 'Contacted', 'In Conversation', 'Passed to Ben', 'Passed', 'Signed']

export const STAGE_COLORS: Record<Stage, string> = {
  Radar: '#6b7280',
  Contacted: '#3b82f6',
  'In Conversation': '#eab308',
  'Passed to Ben': '#ef4444',
  Passed: '#374151',
  Signed: '#22c55e',
}

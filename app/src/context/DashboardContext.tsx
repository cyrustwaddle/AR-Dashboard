import { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface TrackedPlaylist {
  id: string
  name: string
  playlist_id: string
  last_checked_at: string | null
  total_tracks: number
  last_snapshot_offset: number
  created_at: string
}

export interface PlaylistTrack {
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
  created_at: string
}

interface SpotifyToken {
  token: string
  expiresAt: number
}

interface DashboardContextValue {
  playlists: TrackedPlaylist[]
  setPlaylists: React.Dispatch<React.SetStateAction<TrackedPlaylist[]>>
  contacts: Contact[]
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>
  newCounts: Record<string, number | undefined>
  setNewCounts: React.Dispatch<React.SetStateAction<Record<string, number | undefined>>>
  refreshing: Record<string, boolean>
  rowErrors: Record<string, string>
  loaded: boolean
  loadAll: () => Promise<void>
  loadCount: (playlist: TrackedPlaylist) => Promise<void>
  getSpotifyToken: () => Promise<string>
  refreshPlaylist: (playlist: TrackedPlaylist, token: string) => Promise<void>
  refreshAll: () => Promise<void>
  markChecked: (playlist: TrackedPlaylist) => Promise<void>
  toggleContactChecked: (contact: Contact) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<TrackedPlaylist[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [newCounts, setNewCounts] = useState<Record<string, number | undefined>>({})
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const tokenRef = useRef<SpotifyToken | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [plRes, coRes] = await Promise.all([
      supabase.from('tracked_playlists').select('*').order('created_at', { ascending: true }),
      supabase.from('contacts').select('*').order('name'),
    ])
    const pls = (plRes.data ?? []) as TrackedPlaylist[]
    const cos = (coRes.data ?? []) as Contact[]
    setPlaylists(pls)
    setContacts(cos)
    setLoaded(true)
    await Promise.all(pls.map(loadCount))
  }

  async function loadCount(playlist: TrackedPlaylist) {
    const { count } = playlist.last_checked_at
      ? await supabase.from('playlist_tracks').select('*', { count: 'exact', head: true })
          .eq('playlist_id', playlist.playlist_id).gt('added_at', playlist.last_checked_at)
      : await supabase.from('playlist_tracks').select('*', { count: 'exact', head: true })
          .eq('playlist_id', playlist.playlist_id)
    setNewCounts(c => ({ ...c, [playlist.id]: count ?? 0 }))
  }

  async function getSpotifyToken(): Promise<string> {
    const now = Date.now()
    if (tokenRef.current && tokenRef.current.expiresAt > now) return tokenRef.current.token
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
    const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET as string
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`)
    const data = await res.json() as { access_token: string; expires_in: number }
    const tok: SpotifyToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 }
    tokenRef.current = tok
    return tok.token
  }

  async function refreshPlaylist(playlist: TrackedPlaylist, token: string) {
    setRefreshing(r => ({ ...r, [playlist.id]: true }))
    setRowErrors(e => { const n = { ...e }; delete n[playlist.id]; return n })
    try {
      const infoRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.playlist_id}?fields=tracks.total`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!infoRes.ok) {
        const s = infoRes.status
        throw new Error(s === 401 ? 'Spotify auth expired (401)' : s === 404 ? 'Playlist not found (404)' : s === 429 ? 'Rate limited by Spotify (429)' : `Spotify error ${s}`)
      }
      const info = await infoRes.json() as { tracks: { total: number } }
      const currentTotal = info.tracks.total

      if (currentTotal <= playlist.total_tracks) return

      let offset = playlist.last_snapshot_offset
      type SpotifyItem = { added_at: string; track: { id: string; name: string; artists: { name: string }[] } | null }
      const newTracks: { playlist_id: string; track_id: string; track_name: string; artist_name: string; added_at: string }[] = []

      while (offset < currentTotal) {
        const tracksRes = await fetch(
          `https://api.spotify.com/v1/playlists/${playlist.playlist_id}/tracks?offset=${offset}&limit=50&fields=items(added_at,track(id,name,artists(name))),next`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (!tracksRes.ok) {
          const s = tracksRes.status
          throw new Error(s === 401 ? 'Spotify auth expired (401)' : s === 429 ? 'Rate limited by Spotify (429)' : `Spotify error ${s}`)
        }
        const td = await tracksRes.json() as { items: SpotifyItem[]; next: string | null }
        for (const item of td.items) {
          if (!item.track) continue
          newTracks.push({
            playlist_id: playlist.playlist_id,
            track_id: item.track.id,
            track_name: item.track.name,
            artist_name: item.track.artists.map(a => a.name).join(', '),
            added_at: item.added_at,
          })
        }
        offset += 50
        if (!td.next) break
      }

      if (newTracks.length > 0) {
        const { error: upsertErr } = await supabase
          .from('playlist_tracks')
          .upsert(newTracks, { onConflict: 'playlist_id,track_id' })
        if (upsertErr) throw new Error(`DB error: ${upsertErr.message}`)
      }

      const { error: updateErr } = await supabase
        .from('tracked_playlists')
        .update({ total_tracks: currentTotal, last_snapshot_offset: currentTotal })
        .eq('id', playlist.id)
      if (updateErr) throw new Error(`DB error: ${updateErr.message}`)

      const updated = { ...playlist, total_tracks: currentTotal, last_snapshot_offset: currentTotal }
      setPlaylists(prev => prev.map(p => p.id === playlist.id ? updated : p))
      await loadCount(updated)
    } catch (err) {
      setRowErrors(e => ({ ...e, [playlist.id]: err instanceof Error ? err.message : 'Refresh failed' }))
    } finally {
      setRefreshing(r => { const n = { ...r }; delete n[playlist.id]; return n })
    }
  }

  async function refreshAll() {
    try {
      const token = await getSpotifyToken()
      await Promise.all(playlists.map(p => refreshPlaylist(p, token)))
    } catch (err) {
      alert(`Spotify auth failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function markChecked(playlist: TrackedPlaylist) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('tracked_playlists').update({ last_checked_at: now }).eq('id', playlist.id)
    if (error) { alert(`Failed: ${error.message}`); return }
    setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, last_checked_at: now } : p))
    setNewCounts(c => ({ ...c, [playlist.id]: 0 }))
  }

  async function toggleContactChecked(contact: Contact) {
    const newVal = !contact.checked
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, checked: newVal } : c))
    const { error } = await supabase.from('contacts').update({ checked: newVal }).eq('id', contact.id)
    if (error) {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, checked: contact.checked } : c))
      alert(`Failed to update: ${error.message}`)
    }
  }

  return (
    <DashboardContext.Provider value={{
      playlists, setPlaylists,
      contacts, setContacts,
      newCounts, setNewCounts,
      refreshing, rowErrors,
      loaded,
      loadAll, loadCount,
      getSpotifyToken,
      refreshPlaylist, refreshAll,
      markChecked,
      toggleContactChecked,
    }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}

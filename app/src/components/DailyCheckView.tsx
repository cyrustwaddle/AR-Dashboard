import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Playlist, PlaylistTrack, Contact } from '../types'

export default function DailyCheckView() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tracks, setTracks] = useState<Record<string, PlaylistTrack[]>>({})
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeDay, setActiveDay] = useState<'M' | 'T' | 'W' | 'Th' | 'F'>(() => {
    const d = new Date().getDay()
    const map: Record<number, 'M' | 'T' | 'W' | 'Th' | 'F'> = { 1: 'M', 2: 'T', 3: 'W', 4: 'Th', 5: 'F' }
    return map[d] || 'M'
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({})
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null)
  const [tokenExpiry, setTokenExpiry] = useState(0)

  useEffect(() => {
    loadPlaylists()
    loadContacts()
  }, [])

  async function loadPlaylists() {
    const { data } = await supabase.from('tracked_playlists').select('*').order('created_at', { ascending: true })
    if (data) {
      setPlaylists(data)
      await loadTrackCounts(data)
    }
  }

  async function loadTrackCounts(pls: Playlist[]) {
    const results: Record<string, PlaylistTrack[]> = {}
    for (const pl of pls) {
      if (!pl.last_checked_at) {
        results[pl.playlist_id] = []
        continue
      }
      const { data } = await supabase
        .from('playlist_tracks')
        .select('*')
        .eq('playlist_id', pl.playlist_id)
        .gt('added_at', pl.last_checked_at)
        .order('added_at', { ascending: false })
      results[pl.playlist_id] = data || []
    }
    setTracks(results)
  }

  async function loadContacts() {
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: true })
    if (data) setContacts(data)
  }

  async function markChecked(playlist_id: string) {
    const now = new Date().toISOString()
    console.log('[markChecked] firing for', playlist_id)
    const { data, error } = await supabase
      .from('tracked_playlists')
      .update({ last_checked_at: now })
      .eq('playlist_id', playlist_id)
      .select()
    console.log('[markChecked] result', data, error)
    await loadPlaylists()
  }

  async function toggleContact(id: string, current: boolean) {
    const { error } = await supabase
      .from('contacts')
      .update({ checked: !current })
      .eq('id', id)
    if (error) { console.error('toggleContact error:', error); return }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, checked: !current } : c))
  }

  async function refreshAll() {
    let token = spotifyToken
    if (!token || Date.now() >= tokenExpiry) {
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
      const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET as string
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + btoa(clientId + ':' + clientSecret),
        },
        body: 'grant_type=client_credentials',
      })
      const data = await res.json()
      token = data.access_token
      setSpotifyToken(token)
      setTokenExpiry(Date.now() + (data.expires_in - 60) * 1000)
    }

    for (const pl of playlists) {
      setRefreshing(prev => ({ ...prev, [pl.playlist_id]: true }))
      try {
        const metaRes = await fetch(
          `https://api.spotify.com/v1/playlists/${pl.playlist_id}?fields=tracks.total`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const meta = await metaRes.json()
        const total = meta?.tracks?.total ?? 0
        if (total <= pl.total_tracks) {
          setRefreshing(prev => ({ ...prev, [pl.playlist_id]: false }))
          continue
        }
        let offset = pl.last_snapshot_offset
        let next: string | null = 'start'
        const newTracks: {
          playlist_id: string
          track_id: string
          track_name: string
          artist_name: string
          added_at: string
        }[] = []
        while (next) {
          const url = `https://api.spotify.com/v1/playlists/${pl.playlist_id}/tracks?offset=${offset}&limit=50&fields=items(added_at,track(id,name,artists(name))),next`
          const r = await fetch(next === 'start' ? url : next, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const d = await r.json()
          for (const item of d.items || []) {
            if (item?.track?.id) {
              newTracks.push({
                playlist_id: pl.playlist_id,
                track_id: item.track.id,
                track_name: item.track.name,
                artist_name: item.track.artists?.[0]?.name || '',
                added_at: item.added_at,
              })
            }
          }
          next = d.next || null
          offset += 50
        }
        if (newTracks.length > 0) {
          await supabase.from('playlist_tracks').upsert(newTracks, { onConflict: 'playlist_id,track_id', ignoreDuplicates: true })
        }
        await supabase.from('tracked_playlists').update({
          total_tracks: total,
          last_snapshot_offset: total,
        }).eq('playlist_id', pl.playlist_id)
        setPlaylists(prev => prev.map(p =>
          p.playlist_id === pl.playlist_id
            ? { ...p, total_tracks: total, last_snapshot_offset: total }
            : p
        ))
      } catch (e) {
        console.error('refresh error for', pl.playlist_id, e)
      }
      setRefreshing(prev => ({ ...prev, [pl.playlist_id]: false }))
    }
    await loadTrackCounts(playlists)
  }

  return (
    <div style={{ padding: '24px 20px' }}>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {(['M', 'T', 'W', 'Th', 'F'] as const).map(day => (
          <button key={day} onClick={() => setActiveDay(day)} style={{
            background: activeDay === day ? '#E0142A' : '#1A1A1A',
            color: activeDay === day ? '#FFFFFF' : '#888888',
            border: '1px solid ' + (activeDay === day ? '#E0142A' : '#2A2A2A'),
            borderRadius: 6,
            padding: '6px 18px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}>{day}</button>
        ))}
      </div>

      {/* Playlists section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#888888', textTransform: 'uppercase' }}>Playlists</span>
          <button onClick={refreshAll} style={{
            background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0',
            borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 500,
            letterSpacing: '0.04em', cursor: 'pointer',
          }}>Refresh All</button>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', borderBottom: '1px solid #1E1E1E', marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</span>
          <span style={{ width: 140, textAlign: 'center', fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>New Since Last Check</span>
          <span style={{ width: 110 }} />
        </div>

        {playlists.map(pl => {
          const newTracks = tracks[pl.playlist_id] || []
          const count = newTracks.length
          const isExpanded = expanded[pl.playlist_id]
          const isRefreshing = refreshing[pl.playlist_id]
          return (
            <div key={pl.playlist_id}>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid #1E1E1E',
                background: '#111111',
              }}>
                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a
                    href={`spotify:playlist:${pl.playlist_id}`}
                    style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >{pl.name}</a>
                </div>
                {/* Count */}
                <div style={{ width: 140, textAlign: 'center' }}>
                  {isRefreshing ? (
                    <span style={{ fontSize: 11, color: '#888' }}>Refreshing…</span>
                  ) : count > 0 ? (
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [pl.playlist_id]: !isExpanded }))}
                      style={{ background: '#E0142A', color: '#fff', border: 'none', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {count} new
                    </button>
                  ) : (
                    <span style={{ color: '#444', fontSize: 13 }}>—</span>
                  )}
                </div>
                {/* Checked button */}
                <div style={{ width: 110, textAlign: 'right' }}>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      await markChecked(pl.playlist_id)
                    }}
                    style={{
                      background: '#1A1A1A', border: '1px solid #2A2A2A',
                      color: '#F0F0F0', borderRadius: 6,
                      padding: '4px 12px', fontSize: 11, fontWeight: 500,
                      cursor: 'pointer', letterSpacing: '0.04em'
                    }}
                  >✓ Checked</button>
                </div>
              </div>
              {/* Expanded track list */}
              {isExpanded && (
                <div style={{ background: '#0D0D0D', borderBottom: '1px solid #1E1E1E', padding: '8px 24px' }}>
                  {newTracks.map(t => (
                    <div key={t.track_id} style={{ padding: '5px 0', fontSize: 12, color: '#BBBBBB', borderBottom: '1px solid #181818' }}>
                      <span style={{ color: '#F0F0F0', fontWeight: 500 }}>{t.track_name}</span>
                      <span style={{ color: '#666', marginLeft: 8 }}>{t.artist_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Contacts section */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#888888', textTransform: 'uppercase' }}>Contacts</span>
        </div>
        {contacts.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center',
            padding: '10px 12px',
            borderBottom: '1px solid #1E1E1E',
            background: '#111111',
          }}>
            {/* Name + company */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 500 }}>{c.name}</span>
              {c.company && <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{c.company}</span>}
            </div>
            {/* Spotify button */}
            {c.spotify_url && (
              <a
                href={`spotify:user:${c.spotify_url.split('/').pop()?.split('?')[0]}`}
                style={{
                  background: '#1DB954', color: '#000', borderRadius: 20,
                  padding: '4px 14px', fontSize: 11, fontWeight: 600,
                  textDecoration: 'none', marginRight: 12, letterSpacing: '0.04em',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >Spotify ↗</a>
            )}
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={c.checked}
              onChange={() => toggleContact(c.id, c.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#E0142A' }}
            />
          </div>
        ))}
      </div>

    </div>
  )
}

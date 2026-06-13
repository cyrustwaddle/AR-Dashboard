import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { initiateAuth, getValidToken } from '../lib/spotifyAuth'
import type { Playlist, PlaylistTrack, Contact } from '../types'

interface TrackDetail {
  name: string
  artists: string
}

interface CheckResult {
  count: number
  tracks: TrackDetail[]
}

interface Props {
  spotifyConnected: boolean
}

export default function DailyCheckView({ spotifyConnected }: Props) {
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
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [markedDone, setMarkedDone] = useState<Record<string, boolean>>({})
  const [checkAllRunning, setCheckAllRunning] = useState(false)
  const [checkAllResults, setCheckAllResults] = useState<Record<string, CheckResult>>({})
  const [checkAllErrors, setCheckAllErrors] = useState<Record<string, string>>({})
  const [detailsExpanded, setDetailsExpanded] = useState<Record<string, boolean>>({})
  const orderRef = useRef<string[]>([])

  useEffect(() => {
    loadPlaylists()
    loadContacts()
  }, [])

  async function loadPlaylists() {
    const { data } = await supabase.from('tracked_playlists').select('*').order('created_at', { ascending: true })
    if (data) {
      if (orderRef.current.length === 0) {
        orderRef.current = data.map(p => p.playlist_id)
      }
      const sorted = [...data].sort((a, b) =>
        orderRef.current.indexOf(a.playlist_id) - orderRef.current.indexOf(b.playlist_id)
      )
      setPlaylists(sorted)
      await loadTrackCounts(sorted)
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

  // Writes last_checked_at only — track analysis is handled by "Check Playlists".
  async function markChecked(playlist_id: string) {
    setChecking(prev => ({ ...prev, [playlist_id]: true }))
    setRowErrors(prev => { const n = { ...prev }; delete n[playlist_id]; return n })
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('tracked_playlists')
        .update({ last_checked_at: now })
        .eq('playlist_id', playlist_id)
      if (error) throw new Error(`DB error: ${error.message}`)
      setPlaylists(prev => prev.map(p =>
        p.playlist_id === playlist_id ? { ...p, last_checked_at: now } : p
      ))
      setMarkedDone(prev => ({ ...prev, [playlist_id]: true }))
    } catch (err) {
      setRowErrors(prev => ({ ...prev, [playlist_id]: err instanceof Error ? err.message : 'Check failed' }))
    } finally {
      setChecking(prev => { const n = { ...prev }; delete n[playlist_id]; return n })
    }
  }

  async function checkAllPlaylists() {
    if (!spotifyConnected) {
      alert('Connect Spotify first to check playlists.')
      return
    }
    setCheckAllRunning(true)
    setCheckAllResults({})
    setCheckAllErrors({})

    const currentPlaylists = playlists

    await Promise.all(currentPlaylists.map(async pl => {
      try {
        const token = await getValidToken()

        type SpotifyItem = {
          added_at: string
          track: { id: string; name: string; artists: Array<{ name: string }> } | null
        }
        const allItems: Array<{ added_at: string; name: string; artists: string }> = []
        let offset = 0
        let total = Infinity
        while (offset < total) {
          const res = await fetch(
            `https://api.spotify.com/v1/playlists/${pl.playlist_id}/tracks?limit=50&offset=${offset}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (!res.ok) {
            const body = await res.text()
            console.error(`Spotify ${res.status} for "${pl.name}":`, body)
            throw new Error(`Spotify ${res.status}: ${body}`)
          }
          const page = await res.json() as { items: SpotifyItem[]; total: number }
          total = page.total
          for (const it of page.items) {
            const obj = it.track
            if (obj) {
              allItems.push({
                added_at: it.added_at,
                name: obj.name,
                artists: obj.artists.map(a => a.name).join(', '),
              })
            }
          }
          offset += 50
        }

        // Count tracks added after last_checked_at. If never checked, count all.
        const lastChecked = pl.last_checked_at ? new Date(pl.last_checked_at) : null
        const newItems = lastChecked
          ? allItems.filter(t => new Date(t.added_at) > lastChecked)
          : allItems

        const { error } = await supabase
          .from('tracked_playlists')
          .update({
            new_tracks_since_last_check: newItems.length,
            total_tracks: total,
          })
          .eq('playlist_id', pl.playlist_id)
        if (error) throw new Error(`DB write failed: ${error.message}`)

        setPlaylists(prev => prev.map(p =>
          p.playlist_id === pl.playlist_id
            ? { ...p, new_tracks_since_last_check: newItems.length, total_tracks: total }
            : p
        ))
        setCheckAllResults(prev => ({
          ...prev,
          [pl.playlist_id]: {
            count: newItems.length,
            tracks: newItems.map(t => ({ name: t.name, artists: t.artists })),
          },
        }))
      } catch (err) {
        setCheckAllErrors(prev => ({
          ...prev,
          [pl.playlist_id]: err instanceof Error ? err.message : 'Check failed',
        }))
      }
    }))

    setCheckAllRunning(false)
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
    let token: string
    try {
      token = await getValidToken()
    } catch (err) {
      alert(`Spotify auth failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      return
    }

    for (const pl of playlists) {
      setRefreshing(prev => ({ ...prev, [pl.playlist_id]: true }))
      try {
        const metaRes = await fetch(
          `https://api.spotify.com/v1/playlists/${pl.playlist_id}?fields=tracks.total`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const meta = await metaRes.json() as { tracks?: { total: number } }
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
          const url = `https://api.spotify.com/v1/playlists/${pl.playlist_id}/tracks?offset=${offset}&limit=50`
          const r = await fetch(next === 'start' ? url : next, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const d = await r.json() as {
            items?: Array<{
              added_at: string
              track?: { id?: string; name?: string; artists?: Array<{ name: string }> } | null
            }>
            next?: string
          }
          for (const entry of d.items || []) {
            const obj = entry?.track
            if (obj?.id) {
              newTracks.push({
                playlist_id: pl.playlist_id,
                track_id: obj.id,
                track_name: obj.name ?? '',
                artist_name: obj.artists?.[0]?.name || '',
                added_at: entry.added_at,
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

  function daysSinceChecked(last_checked_at: string | null): string {
    if (!last_checked_at) return 'Never'
    const days = Math.floor((Date.now() - new Date(last_checked_at).getTime()) / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return '1 day'
    return `${days} days`
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#888888', textTransform: 'uppercase' }}>Playlists</span>
            {spotifyConnected && (
              <span style={{ fontSize: 10, color: '#1DB954', fontWeight: 500, letterSpacing: '0.04em' }}>● Connected</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!spotifyConnected && (
              <button
                onClick={() => initiateAuth()}
                style={{
                  background: '#1DB954', border: 'none', color: '#000',
                  borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.04em', cursor: 'pointer',
                }}
              >Connect Spotify</button>
            )}
            {spotifyConnected && (
              <button
                onClick={checkAllPlaylists}
                disabled={checkAllRunning}
                style={{
                  background: checkAllRunning ? '#1A1A1A' : '#E0142A',
                  border: checkAllRunning ? '1px solid #2A2A2A' : '1px solid #E0142A',
                  color: checkAllRunning ? '#666' : '#fff',
                  borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.04em', cursor: checkAllRunning ? 'default' : 'pointer',
                }}
              >{checkAllRunning ? 'Checking…' : 'Check Playlists'}</button>
            )}
            <button onClick={refreshAll} style={{
              background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0',
              borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.04em', cursor: 'pointer',
            }}>Refresh All</button>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', borderBottom: '1px solid #1E1E1E', marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</span>
          <span style={{ width: 200, textAlign: 'center', fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>New Since Last Check</span>
          <span style={{ width: 130, textAlign: 'center', fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Days Since Checked</span>
          <span style={{ width: 110 }} />
        </div>

        {playlists.map(pl => {
          const dbTracks = tracks[pl.playlist_id] || []
          const dbCount = dbTracks.length
          const isExpanded = expanded[pl.playlist_id]
          const isRefreshing = refreshing[pl.playlist_id]
          const isChecking = checking[pl.playlist_id]
          const rowError = rowErrors[pl.playlist_id]
          const checkResult = checkAllResults[pl.playlist_id]
          const checkError = checkAllErrors[pl.playlist_id]
          const isDetailExpanded = detailsExpanded[pl.playlist_id]

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

                {/* New since last check */}
                <div style={{ width: 200, textAlign: 'center' }}>
                  {checkError ? (
                    <span style={{ fontSize: 10, color: '#E0142A' }} title={checkError}>Error</span>
                  ) : checkResult != null ? (
                    checkResult.count > 0 ? (
                      <button
                        onClick={() => setDetailsExpanded(prev => ({ ...prev, [pl.playlist_id]: !isDetailExpanded }))}
                        style={{ background: '#E0142A', color: '#fff', border: 'none', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >+{checkResult.count} new</button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#444' }}>No new tracks since last check</span>
                    )
                  ) : isRefreshing ? (
                    <span style={{ fontSize: 11, color: '#888' }}>Refreshing…</span>
                  ) : dbCount > 0 ? (
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [pl.playlist_id]: !isExpanded }))}
                      style={{ background: '#E0142A', color: '#fff', border: 'none', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >{dbCount} new</button>
                  ) : (
                    <span style={{ color: '#444', fontSize: 13 }}>—</span>
                  )}
                </div>

                {/* Days since checked */}
                <div style={{ width: 130, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    {daysSinceChecked(pl.last_checked_at)}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ width: 110, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  {rowError && (
                    <span style={{ fontSize: 10, color: '#E0142A', maxWidth: 120, lineHeight: 1.3 }} title={rowError}>
                      Error
                    </span>
                  )}
                  {isChecking ? (
                    <button style={{
                      background: 'transparent', border: '1px solid #444', color: '#444',
                      borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.06em', cursor: 'default',
                    }}>Checking…</button>
                  ) : markedDone[pl.playlist_id] ? (
                    <button style={{
                      background: 'transparent', border: '1px solid #444', color: '#444',
                      borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.06em', cursor: 'default',
                    }}>✓ Done</button>
                  ) : (
                    <button
                      onClick={() => markChecked(pl.playlist_id)}
                      style={{
                        background: 'transparent', border: '1px solid #E0142A', color: '#E0142A',
                        borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                        letterSpacing: '0.06em', cursor: 'pointer',
                        boxShadow: '0 0 6px rgba(224, 20, 42, 0.4)', transition: 'all 0.15s ease',
                      }}
                    >Checked?</button>
                  )}
                </div>
              </div>

              {/* Check Playlists expandable track list */}
              {isDetailExpanded && checkResult && checkResult.tracks.length > 0 && (
                <div style={{ background: '#0D0D0D', borderBottom: '1px solid #1E1E1E', padding: '8px 24px' }}>
                  {checkResult.tracks.map((t, i) => (
                    <div key={i} style={{ padding: '5px 0', fontSize: 12, color: '#BBBBBB', borderBottom: '1px solid #181818' }}>
                      <span style={{ color: '#F0F0F0', fontWeight: 500 }}>{t.name}</span>
                      <span style={{ color: '#666', marginLeft: 8 }}>{t.artists}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* DB-based expandable track list (shown when no check-all results) */}
              {isExpanded && !checkResult && (
                <div style={{ background: '#0D0D0D', borderBottom: '1px solid #1E1E1E', padding: '8px 24px' }}>
                  {dbTracks.map(t => (
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
            {/* Checked button */}
            {c.checked ? (
              <button
                onClick={() => toggleContact(c.id, c.checked)}
                style={{
                  background: 'transparent', border: '1px solid #444', color: '#444',
                  borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', cursor: 'default', boxShadow: 'none',
                  transition: 'all 0.15s ease',
                }}>✓ Done</button>
            ) : (
              <button
                onClick={() => toggleContact(c.id, c.checked)}
                style={{
                  background: 'transparent', border: '1px solid #E0142A', color: '#E0142A',
                  borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', cursor: 'pointer',
                  boxShadow: '0 0 6px rgba(224, 20, 42, 0.4)', transition: 'all 0.15s ease',
                }}>Checked?</button>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}

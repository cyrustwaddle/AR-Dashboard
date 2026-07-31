import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Playlist, Contact } from '../types'

export default function DailyCheckView() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeDay, setActiveDay] = useState<'M' | 'T' | 'W' | 'Th' | 'F'>(() => {
    const d = new Date().getDay()
    const map: Record<number, 'M' | 'T' | 'W' | 'Th' | 'F'> = { 1: 'M', 2: 'T', 3: 'W', 4: 'Th', 5: 'F' }
    return map[d] || 'M'
  })
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [markedDone, setMarkedDone] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const orderRef = useRef<string[]>([])

  useEffect(() => {
    loadPlaylists()
    loadContacts()
  }, [])

  async function loadPlaylists() {
    const { data } = await supabase.from('tracked_playlists').select('*').order('created_at', { ascending: true })
    if (data) {
      const known = new Set(orderRef.current)
      for (const p of data) {
        if (!known.has(p.playlist_id)) orderRef.current.push(p.playlist_id)
      }
      const live = new Set(data.map(p => p.playlist_id))
      orderRef.current = orderRef.current.filter(id => live.has(id))
      const sorted = [...data].sort((a, b) =>
        orderRef.current.indexOf(a.playlist_id) - orderRef.current.indexOf(b.playlist_id)
      )
      setPlaylists(sorted)
    }
  }

  async function loadContacts() {
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: true })
    if (data) setContacts(data)
  }

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

  function parsePlaylistId(input: string): string | null {
    const s = input.trim()
    if (!s) return null
    // spotify:playlist:<id>
    const uri = s.match(/^spotify:playlist:([A-Za-z0-9]+)$/)
    if (uri) return uri[1]
    // https://open.spotify.com/playlist/<id>?si=...  (also /intl-xx/playlist/<id>)
    const url = s.match(/playlist\/([A-Za-z0-9]+)/)
    if (url) return url[1]
    // bare id
    if (/^[A-Za-z0-9]{16,}$/.test(s)) return s
    return null
  }

  async function addPlaylist() {
    setAddError(null)
    const name = newName.trim()
    const playlist_id = parsePlaylistId(newUrl)
    if (!name) { setAddError('Name is required'); return }
    if (!playlist_id) { setAddError('Could not read a playlist ID from that URL'); return }
    if (playlists.some(p => p.playlist_id === playlist_id)) {
      setAddError('That playlist is already being tracked'); return
    }
    const { error } = await supabase.from('tracked_playlists').insert({
      name,
      playlist_id,
      last_checked_at: new Date().toISOString(),
      total_tracks: 0,
      last_snapshot_offset: 0,
    })
    if (error) { setAddError(error.message); return }
    setNewName('')
    setNewUrl('')
    setAdding(false)
    await loadPlaylists()
  }

  async function deletePlaylist(playlist_id: string, name: string) {
    if (!confirm(`Remove "${name}" from Daily Check? Its tracked history will be deleted too.`)) return
    await supabase.from('playlist_tracks').delete().eq('playlist_id', playlist_id)
    const { error } = await supabase.from('tracked_playlists').delete().eq('playlist_id', playlist_id)
    if (error) {
      setRowErrors(prev => ({ ...prev, [playlist_id]: `Delete failed: ${error.message}` }))
      return
    }
    setMarkedDone(prev => { const n = { ...prev }; delete n[playlist_id]; return n })
    setRowErrors(prev => { const n = { ...prev }; delete n[playlist_id]; return n })
    await loadPlaylists()
  }

  async function toggleContact(id: string, current: boolean) {
    const { error } = await supabase.from('contacts').update({ checked: !current }).eq('id', id)
    if (error) { console.error('toggleContact error:', error); return }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, checked: !current } : c))
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
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#888888', textTransform: 'uppercase' }}>Playlists</span>
          <button onClick={() => { setAdding(a => !a); setAddError(null) }} style={{
            background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0',
            borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 500,
            letterSpacing: '0.04em', cursor: 'pointer',
          }}>{adding ? 'Cancel' : '+ Add Playlist'}</button>
        </div>

        {/* Add playlist form */}
        {adding && (
          <div style={{
            background: '#0D0D0D', border: '1px solid #2A2A2A', borderRadius: 6,
            padding: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addPlaylist() }}
              placeholder="Name"
              autoFocus
              style={{
                background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, width: 200, outline: 'none',
              }}
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addPlaylist() }}
              placeholder="https://open.spotify.com/playlist/..."
              style={{
                background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#F0F0F0',
                borderRadius: 6, padding: '6px 10px', fontSize: 12, flex: 1, minWidth: 260, outline: 'none',
              }}
            />
            <button onClick={addPlaylist} style={{
              background: '#E0142A', border: '1px solid #E0142A', color: '#FFFFFF',
              borderRadius: 6, padding: '6px 16px', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.06em', cursor: 'pointer',
            }}>Add</button>
            {addError && <span style={{ fontSize: 11, color: '#E0142A', width: '100%' }}>{addError}</span>}
          </div>
        )}

        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 8px', borderBottom: '1px solid #1E1E1E', marginBottom: 4 }}>
          <span style={{ flex: 1, fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Name</span>
          <span style={{ width: 160, textAlign: 'center', fontSize: 10, color: '#444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Days Since Checked</span>
          <span style={{ width: 110 }} />
          <span style={{ width: 32 }} />
        </div>

        {playlists.map(pl => {
          const isChecking = checking[pl.playlist_id]
          const rowError = rowErrors[pl.playlist_id]

          return (
            <div key={pl.playlist_id} style={{
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

              {/* Days since checked */}
              <div style={{ width: 160, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#666' }}>
                  {daysSinceChecked(pl.last_checked_at)}
                </span>
              </div>

              {/* Actions */}
              <div style={{ width: 110, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {rowError && (
                  <span style={{ fontSize: 10, color: '#E0142A', maxWidth: 120, lineHeight: 1.3 }} title={rowError}>Error</span>
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

              {/* Delete */}
              <div style={{ width: 32, textAlign: 'right' }}>
                <button
                  onClick={() => deletePlaylist(pl.playlist_id, pl.name)}
                  title="Remove playlist"
                  style={{
                    background: 'transparent', border: 'none', color: '#444',
                    fontSize: 16, lineHeight: 1, padding: '2px 6px', cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E0142A')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                >×</button>
              </div>
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 500 }}>{c.name}</span>
              {c.company && <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{c.company}</span>}
            </div>
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

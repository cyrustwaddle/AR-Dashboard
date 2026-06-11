import { useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../context/DashboardContext'
import type { TrackedPlaylist, PlaylistTrack } from '../context/DashboardContext'

const TH: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#141414',
  padding: '10px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: '#555555', borderBottom: '1px solid #2A2A2A', whiteSpace: 'nowrap', zIndex: 2,
}
const TD: React.CSSProperties = {
  padding: '14px 12px', verticalAlign: 'middle', fontSize: 13,
  borderBottom: '1px solid #1A1A1A', color: '#AAAAAA', whiteSpace: 'nowrap',
}

function formatDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function extractPlaylistId(url: string): string | null {
  return url.match(/\/playlist\/([^?/#]+)/)?.[1] ?? null
}

export default function PlaylistTrackerView() {
  const {
    playlists, setPlaylists,
    newCounts, setNewCounts,
    refreshing, rowErrors,
    loaded, loadCount,
    refreshAll, markChecked,
  } = useDashboard()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTracks, setExpandedTracks] = useState<PlaylistTrack[]>([])
  const [loadingExpand, setLoadingExpand] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  async function handleMarkChecked(p: TrackedPlaylist) {
    await markChecked(p)
    if (expandedId === p.id) { setExpandedId(null); setExpandedTracks([]) }
  }

  async function toggleExpand(playlist: TrackedPlaylist) {
    if (expandedId === playlist.id) {
      setExpandedId(null); setExpandedTracks([]); return
    }
    setExpandedId(playlist.id)
    setExpandedTracks([])
    setLoadingExpand(true)
    const { data } = playlist.last_checked_at
      ? await supabase.from('playlist_tracks').select('*')
          .eq('playlist_id', playlist.playlist_id).gt('added_at', playlist.last_checked_at)
          .order('added_at', { ascending: false })
      : await supabase.from('playlist_tracks').select('*')
          .eq('playlist_id', playlist.playlist_id)
          .order('added_at', { ascending: false })
    setExpandedTracks((data ?? []) as PlaylistTrack[])
    setLoadingExpand(false)
  }

  async function deletePlaylist(id: string) {
    if (!window.confirm('Delete this playlist? This cannot be undone.')) return
    const { error } = await supabase.from('tracked_playlists').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setPlaylists(prev => prev.filter(p => p.id !== id))
    setNewCounts(c => { const n = { ...c }; delete n[id]; return n })
    if (expandedId === id) { setExpandedId(null); setExpandedTracks([]) }
  }

  async function addPlaylist(name: string, url: string) {
    const playlistId = extractPlaylistId(url)
    if (!playlistId) throw new Error('Could not extract playlist ID from URL. Paste a full Spotify playlist link.')
    const { data, error } = await supabase
      .from('tracked_playlists')
      .insert({ name, playlist_id: playlistId, total_tracks: 0, last_snapshot_offset: 0 })
      .select().single()
    if (error) throw new Error(error.message)
    const newPl = data as TrackedPlaylist
    setPlaylists(prev => [...prev, newPl])
    setNewCounts(c => ({ ...c, [newPl.id]: 0 }))
    await loadCount(newPl)
  }

  const isRefreshingAny = Object.values(refreshing).some(Boolean)

  if (!loaded) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid #2A2A2A',
      }}>
        <span style={{ fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#444444' }}>
          Playlist Tracker
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            className="btn-ghost"
            onClick={refreshAll}
            disabled={isRefreshingAny || playlists.length === 0}
          >
            {isRefreshingAny ? 'Refreshing…' : 'Refresh All'}
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Playlist</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH}>Name</th>
              <th style={TH}>New Since Last Check</th>
              <th style={TH}>Last Checked</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {playlists.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#444444', padding: 40 }}>
                  No playlists tracked yet. Click "+ Add Playlist" to get started.
                </td>
              </tr>
            )}
            {playlists.map(p => (
              <Fragment key={p.id}>
                <tr className="pipeline-row" style={{ background: expandedId === p.id ? '#191919' : 'transparent' }}>
                  <td style={{ ...TD, color: '#F0F0F0', fontWeight: 500 }}>
                    <a
                      href={`https://open.spotify.com/playlist/${p.playlist_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#F0F0F0', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {p.name}
                    </a>
                  </td>
                  <td style={TD}>
                    {newCounts[p.id] == null ? (
                      <span style={{ color: '#333333' }}>…</span>
                    ) : newCounts[p.id]! > 0 ? (
                      <span
                        onClick={() => toggleExpand(p)}
                        style={{ color: '#E0142A', fontWeight: 600, cursor: 'pointer' }}
                        title="Click to expand"
                      >
                        {newCounts[p.id]}
                      </span>
                    ) : (
                      <span style={{ color: '#444444' }}>—</span>
                    )}
                  </td>
                  <td style={TD}>{formatDate(p.last_checked_at)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                      {rowErrors[p.id] && (
                        <span style={{ color: '#E0142A', fontSize: 11, fontWeight: 400 }}>{rowErrors[p.id]}</span>
                      )}
                      {refreshing[p.id] ? (
                        <span style={{ color: '#444444', fontSize: 11 }}>Refreshing…</span>
                      ) : (
                        <button
                          className="btn-ghost"
                          onClick={() => handleMarkChecked(p)}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          ✓ Checked
                        </button>
                      )}
                      <button
                        className="row-delete-btn"
                        onClick={() => deletePlaylist(p.id)}
                        style={{ visibility: 'visible' }}
                        title="Delete playlist"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === p.id && (
                  <tr style={{ background: '#161616' }}>
                    <td colSpan={4} style={{ padding: '10px 12px 14px 32px', borderBottom: '1px solid #2A2A2A' }}>
                      {loadingExpand ? (
                        <span style={{ color: '#444444', fontSize: 12 }}>Loading tracks…</span>
                      ) : expandedTracks.length === 0 ? (
                        <span style={{ color: '#444444', fontSize: 12 }}>No new tracks</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {expandedTracks.map(t => (
                            <div key={t.track_id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12 }}>
                              <span style={{ color: '#F0F0F0', fontWeight: 500 }}>{t.track_name}</span>
                              <span style={{ color: '#666666' }}>{t.artist_name}</span>
                              <span style={{ color: '#333333', marginLeft: 'auto', fontSize: 11, flexShrink: 0 }}>
                                {new Date(t.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <AddPlaylistModal onClose={() => setShowAddModal(false)} onSubmit={addPlaylist} />
      )}
    </div>
  )
}

function AddPlaylistModal({ onClose, onSubmit }: {
  onClose: () => void
  onSubmit: (name: string, url: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!url.trim()) { setError('Spotify Playlist URL is required'); return }
    setSaving(true); setError(null)
    try {
      await onSubmit(name.trim(), url.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const IS: React.CSSProperties = { width: '100%', boxSizing: 'border-box' }
  const LS: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, marginBottom: 4,
    color: '#888888', letterSpacing: '0.06em', textTransform: 'uppercase',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#1C1C1C', border: '1px solid #2A2A2A', borderRadius: 4,
        padding: 24, width: 440, maxWidth: '95vw', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#F0F0F0' }}>
            Add Playlist
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444444', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444444')}>×</button>
        </div>
        {error && <p style={{ color: '#E0142A', margin: '0 0 12px', fontSize: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. A&R Radar" style={IS} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={LS}>Spotify Playlist URL *</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/…" style={IS} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Playlist'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../context/DashboardContext'
import type { TrackedPlaylist, PlaylistTrack } from '../context/DashboardContext'

type Day = 'M' | 'T' | 'W' | 'Th' | 'F'
const DAYS: Day[] = ['M', 'T', 'W', 'Th', 'F']

function getCurrentDay(): Day {
  const d = new Date().getDay()
  if (d === 0 || d === 6) return 'M'
  return DAYS[d - 1]
}

export default function DailyCheckView() {
  const {
    playlists, contacts,
    newCounts, refreshing, rowErrors,
    loaded, loadAll,
    refreshAll, markChecked,
    toggleContactChecked,
  } = useDashboard()

  const [activeDay, setActiveDay] = useState<Day>(getCurrentDay)
  const [fade, setFade] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTracks, setExpandedTracks] = useState<PlaylistTrack[]>([])
  const [loadingExpand, setLoadingExpand] = useState(false)

  useEffect(() => { loadAll() }, [])

  function switchDay(d: Day) {
    if (d === activeDay) return
    setFade(false)
    setTimeout(() => { setActiveDay(d); setFade(true) }, 100)
  }

  async function handleMarkChecked(playlist: TrackedPlaylist) {
    await markChecked(playlist)
    if (expandedId === playlist.id) { setExpandedId(null); setExpandedTracks([]) }
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

  const isRefreshingAny = Object.values(refreshing).some(Boolean)

  if (!loaded) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {DAYS.map(d => (
          <button
            key={d}
            onClick={() => switchDay(d)}
            style={{
              background: activeDay === d ? '#1A1A1A' : 'none',
              border: `1px solid ${activeDay === d ? '#E0142A' : '#2A2A2A'}`,
              color: activeDay === d ? '#F0F0F0' : '#555555',
              padding: '6px 0',
              width: 42,
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
              transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { if (activeDay !== d) e.currentTarget.style.borderColor = '#444444' }}
            onMouseLeave={e => { if (activeDay !== d) e.currentTarget.style.borderColor = '#2A2A2A' }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Main content — fades on day switch */}
      <div style={{ transition: 'opacity 0.1s ease', opacity: fade ? 1 : 0 }}>

        {/* ── Playlists section ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#444444',
            }}>
              Playlists
            </span>
            <button
              className="btn-ghost"
              onClick={refreshAll}
              disabled={isRefreshingAny || playlists.length === 0}
              style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px' }}
            >
              {isRefreshingAny ? 'Refreshing…' : 'Refresh All'}
            </button>
          </div>

          {/* Column label */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 12px 6px' }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#333333' }}>
              New Since Last Check
            </span>
          </div>

          {playlists.length === 0 ? (
            <p style={{ color: '#333333', fontSize: 13 }}>No playlists tracked yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {playlists.map(p => {
                const count = newCounts[p.id]
                const isChecked = count != null && count === 0
                return (
                  <div key={p.id}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px',
                      background: '#181818',
                      borderRadius: expandedId === p.id ? '2px 2px 0 0' : 2,
                      opacity: isChecked ? 0.35 : 1,
                      transition: 'opacity 0.15s ease',
                    }}>
                      <a
                        href={`spotify:playlist:${p.playlist_id}`}
                        style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 500, textDecoration: 'none', flex: 1, minWidth: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {p.name}
                      </a>

                      {rowErrors[p.id] && (
                        <span style={{ color: '#E0142A', fontSize: 11 }}>{rowErrors[p.id]}</span>
                      )}

                      {refreshing[p.id] ? (
                        <span style={{ color: '#444444', fontSize: 11, flexShrink: 0 }}>Refreshing…</span>
                      ) : (
                        <>
                          {count == null ? (
                            <span style={{ color: '#444444', fontSize: 12, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>…</span>
                          ) : count > 0 ? (
                            <span
                              onClick={() => toggleExpand(p)}
                              style={{
                                background: '#2A0A0E', color: '#E0142A',
                                fontSize: 11, fontWeight: 700,
                                padding: '2px 7px', borderRadius: 10,
                                cursor: 'pointer', flexShrink: 0, letterSpacing: '0.02em',
                              }}
                              title="Click to see new tracks"
                            >
                              {count} new
                            </span>
                          ) : (
                            <span style={{ color: '#444444', fontSize: 13, flexShrink: 0, minWidth: 28, textAlign: 'center' }}>—</span>
                          )}
                          <button
                            className="btn-ghost"
                            onClick={() => handleMarkChecked(p)}
                            style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }}
                          >
                            ✓ Checked
                          </button>
                        </>
                      )}
                    </div>

                    {/* Inline track expansion */}
                    {expandedId === p.id && (
                      <div style={{
                        background: '#141414', borderRadius: '0 0 2px 2px',
                        padding: '8px 12px 12px 20px',
                        borderTop: '1px solid #1E1E1E',
                      }}>
                        {loadingExpand ? (
                          <span style={{ color: '#444444', fontSize: 12 }}>Loading tracks…</span>
                        ) : expandedTracks.length === 0 ? (
                          <span style={{ color: '#444444', fontSize: 12 }}>No new tracks</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {expandedTracks.map(t => (
                              <div key={t.track_id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12 }}>
                                <span style={{ color: '#E0E0E0', fontWeight: 500 }}>{t.track_name}</span>
                                <span style={{ color: '#555555' }}>{t.artist_name}</span>
                                <span style={{ color: '#333333', marginLeft: 'auto', fontSize: 11, flexShrink: 0 }}>
                                  {new Date(t.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Contacts section ── */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#444444',
            }}>
              Contacts
            </span>
          </div>

          {contacts.length === 0 ? (
            <p style={{ color: '#333333', fontSize: 13 }}>No contacts yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {contacts.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: '#181818', borderRadius: 2,
                    opacity: c.checked ? 0.35 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      color: '#F0F0F0', fontSize: 13, fontWeight: 500,
                      textDecoration: c.checked ? 'line-through' : 'none',
                    }}>
                      {c.name}
                    </span>
                    {c.company && (
                      <span style={{ color: '#444444', fontSize: 12, marginLeft: 8 }}>
                        {c.company}
                      </span>
                    )}
                  </div>

                  {c.spotify_url && (
                    <a
                      href={`spotify:user:${c.spotify_url.split('/').pop()?.split('?')[0] ?? ''}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        height: 32, padding: '0 12px',
                        background: '#1A1A1A', border: '1px solid #2A2A2A',
                        borderRadius: 16, color: '#1DB954',
                        fontSize: 12, fontWeight: 500, textDecoration: 'none',
                        flexShrink: 0, letterSpacing: '0.02em', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#1DB954')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
                      title="Open Spotify profile"
                    >
                      Spotify ↗
                    </a>
                  )}

                  <input
                    type="checkbox"
                    className="ben-check"
                    checked={c.checked}
                    onChange={() => toggleContactChecked(c)}
                    style={{ flexShrink: 0 }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Onboarding, Artist } from '../lib/types'

interface Props {
  month: string
}

interface Row extends Onboarding {
  artist_name: string
}

const CHECKBOX_FIELDS: Array<{ key: keyof Omit<Onboarding, 'id' | 'artist_id'>; label: string }> = [
  { key: 'spotify_discovered_on', label: 'Spotify Discovered On' },
  { key: 'spotify_similar_artists', label: 'Spotify Similar Artists' },
  { key: 'spotify_radio', label: 'Spotify Radio' },
  { key: 'tiktok_follow', label: 'TikTok Follow' },
  { key: 'interact_3_posts', label: 'Interact (3 Posts)' },
  { key: 'soundcloud_radio', label: 'SoundCloud Radio' },
]

const TH: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#f8fafc',
  padding: '6px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', zIndex: 2,
}
const TD: React.CSSProperties = {
  padding: '6px 12px', verticalAlign: 'middle', fontSize: 13,
  borderBottom: '1px solid #f1f5f9', textAlign: 'center',
}

function isFullyOnboarded(row: Row): boolean {
  return CHECKBOX_FIELDS.every(f => row[f.key])
}

export default function OnboardingView({ month }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // Get artist IDs for this month first
    const { data: monthArtists, error: artistsErr } = await supabase
      .from('artists')
      .select('id')
      .eq('month', month)

    if (artistsErr) { setError(artistsErr.message); setLoading(false); return }

    const artistIds = (monthArtists ?? []).map((a: { id: string }) => a.id)

    if (artistIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('onboarding')
      .select('*, artists(artist_name)')
      .in('artist_id', artistIds)

    if (error) { setError(error.message); setLoading(false); return }

    const mapped: Row[] = (data ?? [])
      .map((d: Onboarding & { artists: Pick<Artist, 'artist_name'> | null }) => ({
        id: d.id,
        artist_id: d.artist_id,
        artist_name: d.artists?.artist_name ?? 'Unknown',
        spotify_discovered_on: d.spotify_discovered_on,
        spotify_similar_artists: d.spotify_similar_artists,
        spotify_radio: d.spotify_radio,
        tiktok_follow: d.tiktok_follow,
        interact_3_posts: d.interact_3_posts,
        soundcloud_radio: d.soundcloud_radio,
      }))
      .sort((a: Row, b: Row) => a.artist_name.localeCompare(b.artist_name))

    setRows(mapped)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function toggle(row: Row, field: keyof Omit<Onboarding, 'id' | 'artist_id'>) {
    const newVal = !row[field]
    const { error } = await supabase
      .from('onboarding')
      .update({ [field]: newVal })
      .eq('id', row.id)
    if (error) { alert(`Save failed: ${error.message}`); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: newVal } : r))
  }

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          Onboarding Checklist — {rows.length} artists
        </span>
        <span style={{ marginLeft: 12, fontSize: 13, color: '#6b7280' }}>
          ({rows.filter(isFullyOnboarded).length} fully onboarded)
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>Artist Name</th>
              {CHECKBOX_FIELDS.map(f => (
                <th key={f.key} style={TH}>{f.label}</th>
              ))}
              <th style={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...TD, color: '#aaa', padding: 32 }}>
                  No artists for this month. Add artists in the Pipeline view.
                </td>
              </tr>
            )}
            {rows.map(row => {
              const done = isFullyOnboarded(row)
              return (
                <tr key={row.id} style={{ background: done ? '#f0fdf4' : undefined }}>
                  <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>{row.artist_name}</td>
                  {CHECKBOX_FIELDS.map(f => (
                    <td key={f.key} style={TD}>
                      <input
                        type="checkbox"
                        checked={row[f.key]}
                        onChange={() => toggle(row, f.key)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                  ))}
                  <td style={TD}>
                    {done
                      ? <span style={{
                          background: '#22c55e', color: '#fff', borderRadius: 12,
                          padding: '2px 10px', fontSize: 12, fontWeight: 600,
                        }}>Onboarded ✓</span>
                      : <span style={{ color: '#9ca3af', fontSize: 12 }}>
                          {CHECKBOX_FIELDS.filter(f => row[f.key]).length}/{CHECKBOX_FIELDS.length}
                        </span>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

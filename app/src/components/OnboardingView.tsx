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

function isFullyOnboarded(row: Row): boolean {
  return CHECKBOX_FIELDS.every(f => row[f.key])
}

export default function OnboardingView({ month }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

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

  if (loading) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>
  if (error) return <p style={{ padding: 24, color: '#E0142A' }}>Error: {error}</p>

  const onboardedCount = rows.filter(isFullyOnboarded).length

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#444444' }}>
          {rows.length} <span style={{ color: '#2A2A2A' }}>artists</span>
        </span>
        {rows.length > 0 && (
          <span style={{ fontSize: 11, color: '#333333', letterSpacing: '0.04em' }}>
            {onboardedCount}/{rows.length} fully onboarded
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ color: '#444444', fontSize: 13 }}>No artists for this month. Add artists in the Pipeline view.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {rows.map(row => {
            const done = isFullyOnboarded(row)
            const checkedCount = CHECKBOX_FIELDS.filter(f => row[f.key]).length
            const progress = checkedCount / CHECKBOX_FIELDS.length

            return (
              <div
                key={row.id}
                style={{
                  background: '#111111',
                  border: `1px solid ${done ? '#2A1A1A' : '#1E1E1E'}`,
                  borderRadius: 4,
                  padding: 16,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = '#2A2A2A' }}
                onMouseLeave={e => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = '#1E1E1E' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F0F0' }}>{row.artist_name}</span>
                  {done && (
                    <span style={{
                      background: '#1A0D0D', color: '#E0142A',
                      fontSize: 11, letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: 2,
                      border: '1px solid #3A1A1A', fontWeight: 500,
                    }}>
                      Onboarded ✓
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#444444', marginBottom: 8 }}>
                  {checkedCount} / {CHECKBOX_FIELDS.length} complete
                </div>

                <div style={{ width: '100%', height: 2, background: '#1E1E1E', borderRadius: 1, marginBottom: 12 }}>
                  <div style={{ width: `${progress * 100}%`, height: 2, background: '#E0142A', borderRadius: 1, transition: 'width 0.2s ease' }} />
                </div>

                <div>
                  {CHECKBOX_FIELDS.map((f, i) => {
                    const checked = row[f.key]
                    return (
                      <label
                        key={f.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0',
                          borderBottom: i < CHECKBOX_FIELDS.length - 1 ? '1px solid #0F0F0F' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="onboarding-check"
                          checked={checked}
                          onChange={() => toggle(row, f.key)}
                        />
                        <span style={{
                          fontSize: 12,
                          color: checked ? '#444444' : '#888888',
                          textDecoration: checked ? 'line-through' : 'none',
                        }}>
                          {f.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

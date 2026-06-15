import { useEffect, useState, useCallback } from 'react'
import { supabaseBen } from '../lib/supabaseBen'

interface Props {
  month: string
}

interface BenOnboarding {
  id: string
  artist_id: string
  artist_name: string
  month: string
  spotify_discovered_on: boolean
  spotify_similar_artists: boolean
  spotify_radio: boolean
  tiktok_follow: boolean
  interact_3_posts: boolean
  soundcloud_radio: boolean
}

const CHECKBOX_FIELDS: Array<{
  key: keyof Omit<BenOnboarding, 'id' | 'artist_id' | 'artist_name' | 'month'>
  label: string
}> = [
  { key: 'spotify_discovered_on',   label: 'Spotify Discovered On' },
  { key: 'spotify_similar_artists', label: 'Spotify Similar Artists' },
  { key: 'spotify_radio',           label: 'Spotify Radio' },
  { key: 'tiktok_follow',           label: 'TikTok Follow' },
  { key: 'interact_3_posts',        label: 'Interact (3 Posts)' },
  { key: 'soundcloud_radio',        label: 'SoundCloud Radio' },
]

function isFullyOnboarded(row: BenOnboarding): boolean {
  return CHECKBOX_FIELDS.every(f => row[f.key])
}

export default function BenOnboardingView({ month }: Props) {
  const [rows, setRows] = useState<BenOnboarding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseBen
      .from('ben_onboarding_view')
      .select('*')
      .eq('month', month)
      .order('artist_name', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    setRows(data ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

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
        <p style={{ color: '#444444', fontSize: 13 }}>No artists for this month.</p>
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
                  background: '#1C1C1C',
                  border: `1px solid ${done ? '#2A1A1A' : '#2A2A2A'}`,
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F0F0' }}>{row.artist_name}</span>
                  {done && (
                    <span style={{
                      background: '#1A0D0D', color: '#E0142A',
                      fontSize: 11, letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: 2,
                      border: '1px solid #3A1A1A', fontWeight: 500,
                    }}>Onboarded ✓</span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#444444', marginBottom: 8 }}>
                  {checkedCount} / {CHECKBOX_FIELDS.length} complete
                </div>

                <div style={{ width: '100%', height: 2, background: '#2A2A2A', borderRadius: 1, marginBottom: 12 }}>
                  <div style={{ width: `${progress * 100}%`, height: 2, background: '#E0142A', borderRadius: 1, transition: 'width 0.2s ease' }} />
                </div>

                <div>
                  {CHECKBOX_FIELDS.map((f, i) => {
                    const checked = row[f.key]
                    return (
                      <div
                        key={f.key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0',
                          borderBottom: i < CHECKBOX_FIELDS.length - 1 ? '1px solid #1A1A1A' : 'none',
                        }}
                      >
                        <span style={{
                          width: 14, height: 14, flexShrink: 0,
                          border: `1px solid ${checked ? '#E0142A' : '#333333'}`,
                          borderRadius: 3,
                          background: checked ? '#E0142A22' : 'transparent',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {checked && <span style={{ color: '#E0142A', fontSize: 10, lineHeight: 1 }}>✓</span>}
                        </span>
                        <span style={{
                          fontSize: 12,
                          color: checked ? '#444444' : '#888888',
                          textDecoration: checked ? 'line-through' : 'none',
                        }}>{f.label}</span>
                      </div>
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

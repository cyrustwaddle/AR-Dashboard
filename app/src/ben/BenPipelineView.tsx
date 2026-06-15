import { useEffect, useState, useCallback, Fragment } from 'react'
import { supabaseBen } from '../lib/supabaseBen'
import StagePill from '../components/StagePill'
import type { Stage } from '../lib/types'

interface Props {
  month: string
}

interface BenArtist {
  id: string
  artist_name: string
  genre_lane: string | null
  location: string | null
  tiktok_url: string | null
  spotify_url: string | null
  instagram_url: string | null
  source: string | null
  date_added: string | null
  month: string
  tiktok_followers: number | null
  tiktok_avg_views: number | null
  tiktok_ugc_count: number | null
  spotify_monthly_listeners: number | null
  spotify_top_track_streams: number | null
  spotify_playlist_presence: string | null
  instagram_followers: number | null
  stage: string | null
  manager_team: string | null
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function getPlatformColor(url: string): string {
  const u = url.toLowerCase()
  if (u.includes('spotify')) return '#1DB954'
  if (u.includes('instagram')) return '#E1306C'
  if (u.includes('tiktok')) return '#69C9D0'
  if (u.includes('youtube')) return '#FF0000'
  if (u.includes('twitter') || u.includes('x.com')) return '#1DA1F2'
  if (u.includes('soundcloud')) return '#FF5500'
  return '#AAAAAA'
}

function LinkCell({ href, label }: { href: string | null; label: string }) {
  if (!href) return null
  const color = getPlatformColor(href)
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noreferrer"
      style={{ color, fontSize: 11, letterSpacing: '0.04em', textDecoration: 'none', whiteSpace: 'nowrap' }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
    >{label}</a>
  )
}

function LinkPill({ href, label }: { href: string | null; label: string }) {
  if (!href) return null
  const color = getPlatformColor(href)
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noreferrer"
      style={{
        color, border: `1px solid ${color}4D`, background: 'transparent',
        padding: '4px 12px', borderRadius: 2, fontSize: 11,
        letterSpacing: '0.04em', textDecoration: 'none',
        display: 'inline-block', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
    >{label}</a>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555555', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 500 }}>{children}</div>
    </div>
  )
}

const TH: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#141414',
  padding: '10px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: '#555555', borderBottom: '1px solid #2A2A2A', whiteSpace: 'nowrap', zIndex: 2,
}
const TD: React.CSSProperties = {
  padding: '16px 12px', verticalAlign: 'middle', fontSize: 14,
  borderBottom: '1px solid #1A1A1A', color: '#AAAAAA', whiteSpace: 'nowrap',
}
const SECTION_TH: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#141414',
  padding: '4px 12px', textAlign: 'center', fontSize: 10,
  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: '#2A2A2A', borderBottom: '1px solid #2A2A2A', whiteSpace: 'nowrap', zIndex: 2,
}

export default function BenPipelineView({ month }: Props) {
  const [artists, setArtists] = useState<BenArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabaseBen
      .from('ben_pipeline_view')
      .select('*')
      .eq('month', month)
      .order('artist_name', { ascending: true })
    if (error) { setError(error.message); setLoading(false); return }
    setArtists(data ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  if (loading) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>
  if (error) return <p style={{ padding: 24, color: '#E0142A' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #2A2A2A' }}>
        <span style={{ fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#444444' }}>
          {artists.length} <span style={{ color: '#2A2A2A' }}>artists</span>
        </span>
      </div>

      <div style={{ overflowX: 'auto', borderTop: '1px solid #2A2A2A' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={SECTION_TH} colSpan={7}>Identity</th>
              <th style={SECTION_TH} colSpan={3}>TikTok</th>
              <th style={SECTION_TH} colSpan={3}>Spotify</th>
              <th style={SECTION_TH} colSpan={1}>Instagram</th>
              <th style={SECTION_TH} colSpan={2}>Pipeline</th>
            </tr>
            <tr>
              <th style={TH}>Artist Name</th>
              <th style={TH}>Genre/Lane</th>
              <th style={TH}>Location</th>
              <th style={TH}>TikTok</th>
              <th style={TH}>Spotify</th>
              <th style={TH}>Instagram</th>
              <th style={TH}>Date Added</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Followers</th>
              <th style={TH}>Avg Views</th>
              <th style={TH}>UGC</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Monthly Listeners</th>
              <th style={TH}>Top Streams</th>
              <th style={TH}>Playlist</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Followers</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Stage</th>
              <th style={TH}>Manager/Team</th>
            </tr>
          </thead>
          <tbody>
            {artists.length === 0 && (
              <tr>
                <td colSpan={16} style={{ ...TD, textAlign: 'center', color: '#444444', padding: 40 }}>
                  No artists for this month.
                </td>
              </tr>
            )}
            {artists.map(a => {
              const isExpanded = expandedId === a.id
              return (
                <Fragment key={a.id}>
                  <tr className="pipeline-row" style={{ height: 60 }}>
                    <td
                      style={{ ...TD, fontWeight: 600, fontSize: 15, color: '#FFFFFF', cursor: 'pointer' }}
                      onClick={() => setExpandedId(prev => prev === a.id ? null : a.id)}
                    >
                      <span
                        style={{ color: isExpanded ? '#E0142A' : '#FFFFFF', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#E0142A')}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.color = '#FFFFFF' }}
                      >
                        {a.artist_name}
                      </span>
                    </td>
                    <td style={TD}>{a.genre_lane ?? <span style={{ color: '#444' }}>—</span>}</td>
                    <td style={TD}>{a.location ?? <span style={{ color: '#444' }}>—</span>}</td>
                    <td style={TD}><LinkCell href={a.tiktok_url} label="TikTok" /></td>
                    <td style={TD}><LinkCell href={a.spotify_url} label="Spotify" /></td>
                    <td style={TD}><LinkCell href={a.instagram_url} label="IG" /></td>
                    <td style={TD}>{a.date_added ?? <span style={{ color: '#444' }}>—</span>}</td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>{fmt(a.tiktok_followers)}</td>
                    <td style={TD}>{fmt(a.tiktok_avg_views)}</td>
                    <td style={TD}>{fmt(a.tiktok_ugc_count)}</td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>{fmt(a.spotify_monthly_listeners)}</td>
                    <td style={TD}>{fmt(a.spotify_top_track_streams)}</td>
                    <td style={TD}>{a.spotify_playlist_presence ?? <span style={{ color: '#444' }}>—</span>}</td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>{fmt(a.instagram_followers)}</td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>
                      <StagePill stage={a.stage as Stage | null} />
                    </td>
                    <td style={TD}>{a.manager_team ?? <span style={{ color: '#444' }}>—</span>}</td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={16} style={{ padding: 0, borderBottom: '1px solid #2A2A2A' }}>
                        <div style={{ background: '#1A1A1A', borderLeft: '2px solid #E0142A', padding: '20px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
                            <DetailField label="Genre / Lane">{a.genre_lane ?? '—'}</DetailField>
                            <DetailField label="Location">{a.location ?? '—'}</DetailField>
                            <DetailField label="Stage"><StagePill stage={a.stage as Stage | null} /></DetailField>
                            <DetailField label="Date Added">{a.date_added ?? '—'}</DetailField>
                            <DetailField label="TikTok">
                              {a.tiktok_url ? <LinkPill href={a.tiktok_url} label="TikTok" /> : '—'}
                            </DetailField>
                            <DetailField label="Spotify">
                              {a.spotify_url ? <LinkPill href={a.spotify_url} label="Spotify" /> : '—'}
                            </DetailField>
                            <DetailField label="Instagram">
                              {a.instagram_url ? <LinkPill href={a.instagram_url} label="Instagram" /> : '—'}
                            </DetailField>
                            <DetailField label="TikTok Followers">{fmt(a.tiktok_followers)}</DetailField>
                            <DetailField label="TikTok Avg Views">{fmt(a.tiktok_avg_views)}</DetailField>
                            <DetailField label="TikTok UGC">{fmt(a.tiktok_ugc_count)}</DetailField>
                            <DetailField label="Monthly Listeners">{fmt(a.spotify_monthly_listeners)}</DetailField>
                            <DetailField label="Top Track Streams">{fmt(a.spotify_top_track_streams)}</DetailField>
                            <DetailField label="Playlist Presence">{a.spotify_playlist_presence ?? '—'}</DetailField>
                            <DetailField label="Instagram Followers">{fmt(a.instagram_followers)}</DetailField>
                            <DetailField label="Manager / Team">{a.manager_team ?? '—'}</DetailField>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

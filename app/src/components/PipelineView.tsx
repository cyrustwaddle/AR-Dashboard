import { useEffect, useState, useCallback, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import type { Artist, ArtistWithGrowth, ArtistInsert, Stage } from '../lib/types'
import { computeGrowth, SOURCES, STAGES } from '../lib/types'
import EditableCell from './EditableCell'
import StagePill from './StagePill'
import AddArtistModal from './AddArtistModal'

interface Props {
  month: string
}

function fmt(n: number | null, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function pct(n: number | null): React.ReactNode {
  if (n == null) return <span style={{ color: '#666666' }}>—</span>
  const color = n > 0 ? '#4CAF50' : n < 0 ? '#E0142A' : '#666666'
  return <span style={{ color, fontWeight: 600 }}>{n > 0 ? '+' : ''}{n.toFixed(1)}%</span>
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
    >
      {label}
    </a>
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
        color,
        border: `1px solid ${color}4D`,
        background: 'transparent',
        padding: '4px 12px',
        borderRadius: 2,
        fontSize: 11,
        letterSpacing: '0.04em',
        textDecoration: 'none',
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
    >
      {label}
    </a>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555555', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 500 }}>
        {children}
      </div>
    </div>
  )
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
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

export default function PipelineView({ month }: Props) {
  const [artists, setArtists] = useState<ArtistWithGrowth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [prevMonthWithData, setPrevMonthWithData] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [expandedArtistId, setExpandedArtistId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('artists')
      .select('*')
      .eq('month', month)
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }

    const rows = data ?? []
    setArtists(rows.map(computeGrowth))

    if (rows.length === 0) {
      const { data: prev } = await supabase
        .from('artists')
        .select('month')
        .lt('month', month)
        .order('month', { ascending: false })
        .limit(1)
      setPrevMonthWithData(prev?.[0]?.month ?? null)
    } else {
      setPrevMonthWithData(null)
    }

    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function updateField(id: string, field: string, value: unknown) {
    const { error } = await supabase.from('artists').update({ [field]: value }).eq('id', id)
    if (error) { alert(`Save failed: ${error.message}`); return }
    setArtists(prev => prev.map(a => a.id === id ? computeGrowth({ ...a, [field]: value } as Artist) : a))
  }

  async function handleAdd(data: ArtistInsert) {
    const { error } = await supabase.from('artists').insert({ ...data, month })
    if (error) throw new Error(error.message)
    await load()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this artist? This cannot be undone.')) return
    setDeletingId(id)
    const { error } = await supabase.from('artists').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); setDeletingId(null); return }
    setArtists(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  async function handleNewMonth() {
    if (!prevMonthWithData) return
    setCopying(true)
    const { data: prevArtists, error: fetchErr } = await supabase
      .from('artists')
      .select('*')
      .eq('month', prevMonthWithData)
    if (fetchErr || !prevArtists) {
      alert(`Failed to load previous month: ${fetchErr?.message}`)
      setCopying(false)
      return
    }
    const copies = (prevArtists as Artist[]).map(a => ({
      artist_name: a.artist_name,
      genre_lane: a.genre_lane,
      location: a.location,
      tiktok_url: a.tiktok_url,
      spotify_url: a.spotify_url,
      instagram_url: a.instagram_url,
      source: a.source,
      date_added: a.date_added,
      stage: a.stage,
      ben_sendable: a.ben_sendable,
      last_contact: a.last_contact,
      next_action: a.next_action,
      next_action_date: a.next_action_date,
      manager_team: a.manager_team,
      notes: a.notes,
      month,
      tiktok_followers: null,
      tiktok_followers_prev: null,
      tiktok_avg_views: null,
      tiktok_ugc_count: null,
      spotify_monthly_listeners: null,
      spotify_mls_prev: null,
      spotify_top_track_streams: null,
      spotify_playlist_presence: null,
      instagram_followers: null,
    }))
    const { error: insertErr } = await supabase.from('artists').insert(copies)
    if (insertErr) { alert(`Copy failed: ${insertErr.message}`); setCopying(false); return }
    await load()
    setCopying(false)
  }

  if (loading) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>
  if (error) return <p style={{ padding: 24, color: '#E0142A' }}>Error: {error}</p>

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid #2A2A2A',
      }}>
        <span style={{ fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#444444' }}>
          {artists.length} <span style={{ color: '#2A2A2A' }}>artists</span>
        </span>
        {prevMonthWithData && (
          <button
            className="btn-ghost"
            onClick={handleNewMonth}
            disabled={copying}
          >
            {copying ? 'Copying…' : `Copy roster from ${formatMonthLabel(prevMonthWithData)}`}
          </button>
        )}
        <button
          className="btn-primary"
          onClick={() => setShowModal(true)}
          style={{ marginLeft: 'auto' }}
        >
          + Add Artist
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderTop: '1px solid #2A2A2A' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={SECTION_TH} colSpan={8}>Identity</th>
              <th style={SECTION_TH} colSpan={3}>TikTok</th>
              <th style={SECTION_TH} colSpan={4}>Spotify</th>
              <th style={SECTION_TH} colSpan={1}>Instagram</th>
              <th style={SECTION_TH} colSpan={7}>Pipeline</th>
              <th style={SECTION_TH} />
            </tr>
            <tr>
              <th style={TH}>Artist Name</th>
              <th style={TH}>Genre/Lane</th>
              <th style={TH}>Location</th>
              <th style={TH}>TikTok</th>
              <th style={TH}>Spotify</th>
              <th style={TH}>Instagram</th>
              <th style={TH}>Source</th>
              <th style={TH}>Date Added</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Followers</th>
              <th style={TH}>Prev Wk</th>
              <th style={TH}>7d Growth</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Monthly Listeners</th>
              <th style={TH}>Prev Wk</th>
              <th style={TH}>7d Growth</th>
              <th style={TH}>Top Streams</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Followers</th>

              <th style={{ ...TH, borderLeft: '1px solid #2A2A2A' }}>Stage</th>
              <th style={{ ...TH, textAlign: 'center' }}>Push Forward?</th>
              <th style={TH}>Last Contact</th>
              <th style={TH}>Next Action</th>
              <th style={TH}>Next Action Date</th>
              <th style={TH}>Manager/Team</th>
              <th style={TH}>Notes</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {artists.length === 0 && (
              <tr>
                <td colSpan={24} style={{ ...TD, textAlign: 'center', color: '#444444', padding: 40 }}>
                  {prevMonthWithData
                    ? 'No artists for this month — use "Copy roster" above to carry over the previous roster.'
                    : 'No artists yet. Click "+ Add Artist" to get started.'}
                </td>
              </tr>
            )}
            {artists.map(a => {
              const upd = (field: string) => (val: string | number | boolean | null) => updateField(a.id, field, val)
              const rowBg = deletingId === a.id ? '#1A0D0D' : undefined
              const isExpanded = expandedArtistId === a.id
              return (
                <Fragment key={a.id}>
                  <tr className="pipeline-row" style={{ background: rowBg, height: 60 }}>
                    <td
                      style={{ ...TD, fontWeight: 600, fontSize: 15, color: '#FFFFFF', cursor: 'pointer' }}
                      onClick={() => setExpandedArtistId(prev => prev === a.id ? null : a.id)}
                    >
                      <span
                        style={{ color: isExpanded ? '#E0142A' : '#FFFFFF', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#E0142A')}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.color = '#FFFFFF' }}
                      >
                        {a.artist_name || '—'}
                      </span>
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.genre_lane} onSave={upd('genre_lane')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.location} onSave={upd('location')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.tiktok_url} onSave={upd('tiktok_url')}
                        render={v => <LinkCell href={v as string | null} label="TikTok" />} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.spotify_url} onSave={upd('spotify_url')}
                        render={v => <LinkCell href={v as string | null} label="Spotify" />} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.instagram_url} onSave={upd('instagram_url')}
                        render={v => <LinkCell href={v as string | null} label="IG" />} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.source} type="select" options={SOURCES} onSave={upd('source')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.date_added} type="date" onSave={upd('date_added')} />
                    </td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>
                      <EditableCell value={a.tiktok_followers} type="number" onSave={upd('tiktok_followers')}
                        render={v => fmt(v as number | null)} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.tiktok_followers_prev} type="number" onSave={upd('tiktok_followers_prev')}
                        render={v => fmt(v as number | null)} />
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>{pct(a.tiktok_growth_pct)}</td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>
                      <EditableCell value={a.spotify_monthly_listeners} type="number" onSave={upd('spotify_monthly_listeners')}
                        render={v => fmt(v as number | null)} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.spotify_mls_prev} type="number" onSave={upd('spotify_mls_prev')}
                        render={v => fmt(v as number | null)} />
                    </td>
                    <td style={{ ...TD, textAlign: 'right' }}>{pct(a.spotify_growth_pct)}</td>
                    <td style={TD}>
                      <EditableCell value={a.spotify_top_track_streams} type="number" onSave={upd('spotify_top_track_streams')}
                        render={v => fmt(v as number | null)} />
                    </td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>
                      <EditableCell value={a.instagram_followers} type="number" onSave={upd('instagram_followers')}
                        render={v => fmt(v as number | null)} />
                    </td>

                    <td style={{ ...TD, borderLeft: '1px solid #1A1A1A' }}>
                      <EditableCell value={a.stage} type="select" options={STAGES} onSave={upd('stage')}
                        render={v => <StagePill stage={v as Stage | null} />} />
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <EditableCell value={a.ben_sendable} type="boolean" onSave={upd('ben_sendable')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.last_contact} type="date" onSave={upd('last_contact')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.next_action} onSave={upd('next_action')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.next_action_date} type="date" onSave={upd('next_action_date')} />
                    </td>
                    <td style={TD}>
                      <EditableCell value={a.manager_team} onSave={upd('manager_team')} />
                    </td>
                    <td style={{ ...TD, minWidth: 180 }}>
                      <EditableCell value={a.notes} onSave={upd('notes')}
                        render={v => (
                          <span
                            title={v ? String(v) : undefined}
                            style={{
                              display: 'block', maxWidth: 240, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              fontSize: 13, color: v ? '#AAAAAA' : '#555555',
                            }}
                          >
                            {v || '—'}
                          </span>
                        )}
                      />
                    </td>
                    <td style={{ ...TD, textAlign: 'center', padding: '16px 8px' }}>
                      <button
                        className="row-delete-btn"
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        title="Delete artist"
                      >×</button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={24} style={{ padding: 0, borderBottom: '1px solid #2A2A2A' }}>
                        <div style={{
                          background: '#1A1A1A',
                          borderLeft: '2px solid #E0142A',
                          padding: '20px 24px',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
                            <DetailField label="Genre / Lane">{a.genre_lane || '—'}</DetailField>
                            <DetailField label="Location">{a.location || '—'}</DetailField>
                            <DetailField label="Source">{a.source || '—'}</DetailField>
                            <DetailField label="Stage"><StagePill stage={a.stage} /></DetailField>
                            <DetailField label="Date Added">{a.date_added || '—'}</DetailField>
                            <DetailField label="Push Forward?">{a.ben_sendable ? 'Yes' : 'No'}</DetailField>
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
                            <DetailField label="TikTok Prev Wk">{fmt(a.tiktok_followers_prev)}</DetailField>
                            <DetailField label="TikTok 7d Growth">{pct(a.tiktok_growth_pct)}</DetailField>
                            <DetailField label="Monthly Listeners">{fmt(a.spotify_monthly_listeners)}</DetailField>
                            <DetailField label="MLS Prev Wk">{fmt(a.spotify_mls_prev)}</DetailField>
                            <DetailField label="Spotify 7d Growth">{pct(a.spotify_growth_pct)}</DetailField>
                            <DetailField label="Top Track Streams">{fmt(a.spotify_top_track_streams)}</DetailField>
                            <DetailField label="Instagram Followers">{fmt(a.instagram_followers)}</DetailField>
                            <DetailField label="Last Contact">{a.last_contact || '—'}</DetailField>
                            <DetailField label="Next Action">{a.next_action || '—'}</DetailField>
                            <DetailField label="Next Action Date">{a.next_action_date || '—'}</DetailField>
                            <DetailField label="Manager / Team">{a.manager_team || '—'}</DetailField>
                          </div>
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555555', marginBottom: 6 }}>
                              Notes
                            </div>
                            <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 500, whiteSpace: 'pre-wrap', maxWidth: '100%' }}>
                              {a.notes || '—'}
                            </div>
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

      {showModal && (
        <AddArtistModal onClose={() => setShowModal(false)} onSubmit={handleAdd} />
      )}
    </div>
  )
}

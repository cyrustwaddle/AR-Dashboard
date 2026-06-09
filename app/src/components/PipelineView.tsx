import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Artist, ArtistWithGrowth, ArtistInsert, Stage } from '../lib/types'
import { computeGrowth, SOURCES, PLAYLIST_PRESENCES, STAGES } from '../lib/types'
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
  if (n == null) return <span style={{ color: '#aaa' }}>—</span>
  const color = n > 0 ? '#16a34a' : n < 0 ? '#dc2626' : '#6b7280'
  return <span style={{ color, fontWeight: 600 }}>{n > 0 ? '+' : ''}{n.toFixed(1)}%</span>
}

function LinkCell({ href }: { href: string | null }) {
  if (!href) return <span style={{ color: '#aaa' }}>—</span>
  const label = href.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
  return <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noreferrer"
    style={{ color: '#2563eb', wordBreak: 'break-all' }}>{label}</a>
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

const TH: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#f8fafc',
  padding: '6px 8px', textAlign: 'left', fontSize: 11,
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
  color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', zIndex: 2,
}
const TD: React.CSSProperties = {
  padding: '5px 8px', verticalAlign: 'middle', fontSize: 13,
  borderBottom: '1px solid #f1f5f9',
}
const SECTION_TH: React.CSSProperties = {
  ...TH, background: '#f1f5f9', color: '#94a3b8', textAlign: 'center',
  borderTop: '1px solid #e2e8f0',
}

export default function PipelineView({ month }: Props) {
  const [artists, setArtists] = useState<ArtistWithGrowth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [prevMonthWithData, setPrevMonthWithData] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)

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

  if (loading) return <p style={{ padding: 24 }}>Loading…</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Pipeline — {artists.length} artists</span>
        {prevMonthWithData && (
          <button
            onClick={handleNewMonth}
            disabled={copying}
            style={{
              padding: '6px 14px', background: '#f0fdf4', color: '#16a34a',
              border: '1px solid #86efac', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13,
            }}
          >
            {copying ? 'Copying…' : `Copy roster from ${formatMonthLabel(prevMonthWithData)}`}
          </button>
        )}
        <button
          onClick={() => setShowModal(true)}
          style={{ marginLeft: 'auto', padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
        >
          + Add Artist
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={SECTION_TH} colSpan={8}>Identity</th>
              <th style={{ ...SECTION_TH, background: '#fef9c3' }} colSpan={5}>TikTok</th>
              <th style={{ ...SECTION_TH, background: '#dcfce7' }} colSpan={5}>Spotify</th>
              <th style={{ ...SECTION_TH, background: '#fce7f3' }} colSpan={1}>Instagram</th>
              <th style={{ ...SECTION_TH, background: '#ede9fe' }} colSpan={7}>Pipeline</th>
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

              <th style={{ ...TH, background: '#fef9c3' }}>Followers</th>
              <th style={{ ...TH, background: '#fef9c3' }}>Prev Wk</th>
              <th style={{ ...TH, background: '#fef9c3' }}>7d Growth</th>
              <th style={{ ...TH, background: '#fef9c3' }}>Avg Views</th>
              <th style={{ ...TH, background: '#fef9c3' }}>UGC</th>

              <th style={{ ...TH, background: '#dcfce7' }}>Monthly Listeners</th>
              <th style={{ ...TH, background: '#dcfce7' }}>Prev Wk</th>
              <th style={{ ...TH, background: '#dcfce7' }}>7d Growth</th>
              <th style={{ ...TH, background: '#dcfce7' }}>Top Streams</th>
              <th style={{ ...TH, background: '#dcfce7' }}>Playlist</th>

              <th style={{ ...TH, background: '#fce7f3' }}>Followers</th>

              <th style={{ ...TH, background: '#ede9fe' }}>Stage</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Ben?</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Last Contact</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Next Action</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Next Action Date</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Manager/Team</th>
              <th style={{ ...TH, background: '#ede9fe' }}>Notes</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {artists.length === 0 && (
              <tr>
                <td colSpan={27} style={{ ...TD, textAlign: 'center', color: '#aaa', padding: 32 }}>
                  {prevMonthWithData
                    ? 'No artists for this month — use "Copy roster" above to carry over the previous roster.'
                    : 'No artists yet. Click "+ Add Artist" to get started.'}
                </td>
              </tr>
            )}
            {artists.map(a => {
              const upd = (field: string) => (val: string | number | boolean | null) => updateField(a.id, field, val)
              return (
                <tr key={a.id} style={{ background: deletingId === a.id ? '#fef2f2' : undefined }}>
                  <td style={{ ...TD, fontWeight: 600 }}>
                    <EditableCell value={a.artist_name} onSave={upd('artist_name')} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.genre_lane} onSave={upd('genre_lane')} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.location} onSave={upd('location')} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.tiktok_url} onSave={upd('tiktok_url')}
                      render={v => <LinkCell href={v as string | null} />} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.spotify_url} onSave={upd('spotify_url')}
                      render={v => <LinkCell href={v as string | null} />} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.instagram_url} onSave={upd('instagram_url')}
                      render={v => <LinkCell href={v as string | null} />} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.source} type="select" options={SOURCES} onSave={upd('source')} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.date_added} type="date" onSave={upd('date_added')} />
                  </td>

                  <td style={TD}>
                    <EditableCell value={a.tiktok_followers} type="number" onSave={upd('tiktok_followers')}
                      render={v => fmt(v as number | null)} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.tiktok_followers_prev} type="number" onSave={upd('tiktok_followers_prev')}
                      render={v => fmt(v as number | null)} />
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>{pct(a.tiktok_growth_pct)}</td>
                  <td style={TD}>
                    <EditableCell value={a.tiktok_avg_views} type="number" onSave={upd('tiktok_avg_views')}
                      render={v => fmt(v as number | null)} />
                  </td>
                  <td style={TD}>
                    <EditableCell value={a.tiktok_ugc_count} type="number" onSave={upd('tiktok_ugc_count')}
                      render={v => fmt(v as number | null)} />
                  </td>

                  <td style={TD}>
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
                  <td style={TD}>
                    <EditableCell value={a.spotify_playlist_presence} type="select" options={PLAYLIST_PRESENCES}
                      onSave={upd('spotify_playlist_presence')} />
                  </td>

                  <td style={TD}>
                    <EditableCell value={a.instagram_followers} type="number" onSave={upd('instagram_followers')}
                      render={v => fmt(v as number | null)} />
                  </td>

                  <td style={TD}>
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
                  <td style={{ ...TD, maxWidth: 200 }}>
                    <EditableCell value={a.notes} onSave={upd('notes')} />
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      style={{
                        background: 'none', border: '1px solid #fca5a5', color: '#ef4444',
                        borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12,
                      }}
                      title="Delete artist"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
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

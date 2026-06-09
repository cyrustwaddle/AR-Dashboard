import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ArtistInsert } from '../lib/types'
import { GENRE_LANES, SOURCES, PLAYLIST_PRESENCES, STAGES } from '../lib/types'

interface Props {
  onClose: () => void
  onSubmit: (data: ArtistInsert) => Promise<void>
}

const empty: ArtistInsert = {
  artist_name: '',
  genre_lane: null,
  location: null,
  tiktok_url: null,
  spotify_url: null,
  instagram_url: null,
  source: null,
  date_added: null,
  tiktok_followers: null,
  tiktok_followers_prev: null,
  tiktok_avg_views: null,
  tiktok_ugc_count: null,
  spotify_monthly_listeners: null,
  spotify_mls_prev: null,
  spotify_top_track_streams: null,
  spotify_playlist_presence: null,
  instagram_followers: null,
  stage: null,
  ben_sendable: false,
  last_contact: null,
  next_action: null,
  next_action_date: null,
  manager_team: null,
  notes: null,
}

function numOrNull(s: string): number | null {
  if (s === '') return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

function strOrNull(s: string): string | null {
  return s === '' ? null : s
}

export default function AddArtistModal({ onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ArtistInsert>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof ArtistInsert, val: unknown) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.artist_name.trim()) { setError('Artist Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '4px 6px' }
  const fieldStyle: React.CSSProperties = { marginBottom: 10 }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 2, color: '#555' }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={fieldStyle}>
        <label style={labelStyle}>{label}</label>
        {children}
      </div>
    )
  }

  function Sel<T extends string>({ field, opts }: { field: keyof ArtistInsert; opts: readonly T[] }) {
    return (
      <select value={(form[field] as string) ?? ''} onChange={e => set(field, e.target.value || null)} style={inputStyle}>
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  function Txt({ field, placeholder }: { field: keyof ArtistInsert; placeholder?: string }) {
    return (
      <input type="text" value={(form[field] as string) ?? ''} placeholder={placeholder}
        onChange={e => set(field, strOrNull(e.target.value))} style={inputStyle} />
    )
  }

  function Num({ field }: { field: keyof ArtistInsert }) {
    return (
      <input type="number" value={form[field] == null ? '' : String(form[field])}
        onChange={e => set(field, numOrNull(e.target.value))} style={inputStyle} />
    )
  }

  function DateField({ field }: { field: keyof ArtistInsert }) {
    return (
      <input type="date" value={(form[field] as string) ?? ''}
        onChange={e => set(field, strOrNull(e.target.value))} style={inputStyle} />
    )
  }

  const col: React.CSSProperties = { flex: 1, minWidth: 160 }
  const row: React.CSSProperties = { display: 'flex', gap: 16 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 24, width: 720,
        maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Add Artist</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {error && <p style={{ color: 'red', margin: '0 0 12px' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <h4 style={{ margin: '0 0 8px', color: '#333' }}>Identity</h4>
          <div style={row}>
            <div style={col}><Field label="Artist Name *"><Txt field="artist_name" placeholder="Required" /></Field></div>
            <div style={col}><Field label="Genre / Lane"><Sel field="genre_lane" opts={GENRE_LANES} /></Field></div>
            <div style={col}><Field label="Location"><Txt field="location" /></Field></div>
          </div>
          <div style={row}>
            <div style={col}><Field label="TikTok URL"><Txt field="tiktok_url" placeholder="@handle or URL" /></Field></div>
            <div style={col}><Field label="Spotify URL"><Txt field="spotify_url" /></Field></div>
            <div style={col}><Field label="Instagram URL"><Txt field="instagram_url" /></Field></div>
          </div>
          <div style={row}>
            <div style={col}><Field label="Source"><Sel field="source" opts={SOURCES} /></Field></div>
            <div style={col}><Field label="Date Added"><DateField field="date_added" /></Field></div>
            <div style={col} />
          </div>

          <h4 style={{ margin: '12px 0 8px', color: '#333' }}>TikTok</h4>
          <div style={row}>
            <div style={col}><Field label="Followers"><Num field="tiktok_followers" /></Field></div>
            <div style={col}><Field label="Followers (Prev Wk)"><Num field="tiktok_followers_prev" /></Field></div>
            <div style={col}><Field label="Avg Views (Last 5)"><Num field="tiktok_avg_views" /></Field></div>
            <div style={col}><Field label="UGC Count"><Num field="tiktok_ugc_count" /></Field></div>
          </div>

          <h4 style={{ margin: '12px 0 8px', color: '#333' }}>Spotify</h4>
          <div style={row}>
            <div style={col}><Field label="Monthly Listeners"><Num field="spotify_monthly_listeners" /></Field></div>
            <div style={col}><Field label="MLS (Prev Wk)"><Num field="spotify_mls_prev" /></Field></div>
            <div style={col}><Field label="Top Track Streams"><Num field="spotify_top_track_streams" /></Field></div>
            <div style={col}><Field label="Playlist Presence"><Sel field="spotify_playlist_presence" opts={PLAYLIST_PRESENCES} /></Field></div>
          </div>

          <h4 style={{ margin: '12px 0 8px', color: '#333' }}>Instagram</h4>
          <div style={row}>
            <div style={col}><Field label="Followers"><Num field="instagram_followers" /></Field></div>
            <div style={{ flex: 3 }} />
          </div>

          <h4 style={{ margin: '12px 0 8px', color: '#333' }}>Pipeline</h4>
          <div style={row}>
            <div style={col}><Field label="Stage"><Sel field="stage" opts={STAGES} /></Field></div>
            <div style={col}><Field label="Ben-Sendable">
              <input type="checkbox" checked={!!form.ben_sendable}
                onChange={e => set('ben_sendable', e.target.checked)} />
            </Field></div>
            <div style={col}><Field label="Last Contact"><DateField field="last_contact" /></Field></div>
            <div style={col}><Field label="Next Action Date"><DateField field="next_action_date" /></Field></div>
          </div>
          <div style={row}>
            <div style={{ flex: 2 }}><Field label="Next Action"><Txt field="next_action" /></Field></div>
            <div style={col}><Field label="Manager / Team"><Txt field="manager_team" /></Field></div>
          </div>
          <Field label="Notes">
            <textarea value={form.notes ?? ''} onChange={e => set('notes', strOrNull(e.target.value))}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} disabled={saving}
              style={{ padding: '7px 20px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving}
              style={{ padding: '7px 20px', cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }}>
              {saving ? 'Saving…' : 'Add Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

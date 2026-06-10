import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ArtistInsert, Source, PlaylistPresence, Stage } from '../lib/types'
import { SOURCES, PLAYLIST_PRESENCES, STAGES } from '../lib/types'

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

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box' }
const fieldStyle: React.CSSProperties = { marginBottom: 10 }
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500,
  marginBottom: 4, color: '#888888',
  letterSpacing: '0.06em', textTransform: 'uppercase',
}
const sectionStyle: React.CSSProperties = {
  margin: '14px 0 8px',
  fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#333333',
  borderBottom: '1px solid #2A2A2A', paddingBottom: 6,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Txt({ value, onChange, placeholder }: {
  value: string | null
  onChange: (v: string | null) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      style={inputStyle}
    />
  )
}

function Num({ value, onChange }: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <input
      type="number"
      value={value == null ? '' : String(value)}
      onChange={e => {
        if (e.target.value === '') { onChange(null); return }
        const n = Number(e.target.value)
        onChange(isNaN(n) ? null : n)
      }}
      style={inputStyle}
    />
  )
}

function DateField({ value, onChange }: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
      style={inputStyle}
    />
  )
}

function Sel<T extends string>({ value, opts, onChange }: {
  value: T | null
  opts: readonly T[]
  onChange: (v: T | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange((e.target.value || null) as T | null)}
      style={inputStyle}
    >
      <option value="">—</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
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

  const col: React.CSSProperties = { flex: 1, minWidth: 160 }
  const row: React.CSSProperties = { display: 'flex', gap: 16 }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#1C1C1C',
        border: '1px solid #2A2A2A',
        borderRadius: 4,
        padding: 24,
        width: 720,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#F0F0F0' }}>
            Add Artist
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#444444', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444444')}
          >×</button>
        </div>

        {error && <p style={{ color: '#E0142A', margin: '0 0 12px', fontSize: 12 }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <p style={sectionStyle}>Identity</p>
          <div style={row}>
            <div style={col}><Field label="Artist Name *">
              <input
                type="text"
                value={form.artist_name}
                placeholder="Required"
                onChange={e => set('artist_name', e.target.value)}
                style={inputStyle}
              />
            </Field></div>
            <div style={col}><Field label="Genre / Lane">
              <Txt value={form.genre_lane} onChange={v => set('genre_lane', v)} />
            </Field></div>
            <div style={col}><Field label="Location">
              <Txt value={form.location} onChange={v => set('location', v)} />
            </Field></div>
          </div>
          <div style={row}>
            <div style={col}><Field label="TikTok URL">
              <Txt value={form.tiktok_url} onChange={v => set('tiktok_url', v)} placeholder="@handle or URL" />
            </Field></div>
            <div style={col}><Field label="Spotify URL">
              <Txt value={form.spotify_url} onChange={v => set('spotify_url', v)} />
            </Field></div>
            <div style={col}><Field label="Instagram URL">
              <Txt value={form.instagram_url} onChange={v => set('instagram_url', v)} />
            </Field></div>
          </div>
          <div style={row}>
            <div style={col}><Field label="Source">
              <Sel<Source> value={form.source} opts={SOURCES} onChange={v => set('source', v)} />
            </Field></div>
            <div style={col}><Field label="Date Added">
              <DateField value={form.date_added} onChange={v => set('date_added', v)} />
            </Field></div>
            <div style={col} />
          </div>

          <p style={sectionStyle}>TikTok</p>
          <div style={row}>
            <div style={col}><Field label="Followers">
              <Num value={form.tiktok_followers} onChange={v => set('tiktok_followers', v)} />
            </Field></div>
            <div style={col}><Field label="Followers (Prev Wk)">
              <Num value={form.tiktok_followers_prev} onChange={v => set('tiktok_followers_prev', v)} />
            </Field></div>
            <div style={col}><Field label="Avg Views (Last 5)">
              <Num value={form.tiktok_avg_views} onChange={v => set('tiktok_avg_views', v)} />
            </Field></div>
            <div style={col}><Field label="UGC Count">
              <Num value={form.tiktok_ugc_count} onChange={v => set('tiktok_ugc_count', v)} />
            </Field></div>
          </div>

          <p style={sectionStyle}>Spotify</p>
          <div style={row}>
            <div style={col}><Field label="Monthly Listeners">
              <Num value={form.spotify_monthly_listeners} onChange={v => set('spotify_monthly_listeners', v)} />
            </Field></div>
            <div style={col}><Field label="MLS (Prev Wk)">
              <Num value={form.spotify_mls_prev} onChange={v => set('spotify_mls_prev', v)} />
            </Field></div>
            <div style={col}><Field label="Top Track Streams">
              <Num value={form.spotify_top_track_streams} onChange={v => set('spotify_top_track_streams', v)} />
            </Field></div>
            <div style={col}><Field label="Playlist Presence">
              <Sel<PlaylistPresence> value={form.spotify_playlist_presence} opts={PLAYLIST_PRESENCES} onChange={v => set('spotify_playlist_presence', v)} />
            </Field></div>
          </div>

          <p style={sectionStyle}>Instagram</p>
          <div style={row}>
            <div style={col}><Field label="Followers">
              <Num value={form.instagram_followers} onChange={v => set('instagram_followers', v)} />
            </Field></div>
            <div style={{ flex: 3 }} />
          </div>

          <p style={sectionStyle}>Pipeline</p>
          <div style={row}>
            <div style={col}><Field label="Stage">
              <Sel<Stage> value={form.stage} opts={STAGES} onChange={v => set('stage', v)} />
            </Field></div>
            <div style={col}><Field label="Ben-Sendable">
              <div style={{ paddingTop: 6 }}>
                <input
                  type="checkbox"
                  className="ben-check"
                  checked={!!form.ben_sendable}
                  onChange={e => set('ben_sendable', e.target.checked)}
                />
              </div>
            </Field></div>
            <div style={col}><Field label="Last Contact">
              <DateField value={form.last_contact} onChange={v => set('last_contact', v)} />
            </Field></div>
            <div style={col}><Field label="Next Action Date">
              <DateField value={form.next_action_date} onChange={v => set('next_action_date', v)} />
            </Field></div>
          </div>
          <div style={row}>
            <div style={{ flex: 2 }}><Field label="Next Action">
              <Txt value={form.next_action} onChange={v => set('next_action', v)} />
            </Field></div>
            <div style={col}><Field label="Manager / Team">
              <Txt value={form.manager_team} onChange={v => set('manager_team', v)} />
            </Field></div>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value === '' ? null : e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add Artist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

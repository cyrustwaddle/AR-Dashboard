import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Contact {
  id: string
  name: string
  company: string | null
  spotify_url: string | null
  checked: boolean
  created_at: string
}

type ContactData = Omit<Contact, 'id' | 'created_at'>

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

export default function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  useEffect(() => { loadContacts() }, [])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts((data ?? []) as Contact[])
    setLoading(false)
  }

  async function toggleChecked(contact: Contact) {
    const newVal = !contact.checked
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, checked: newVal } : c))
    const { error } = await supabase.from('contacts').update({ checked: newVal }).eq('id', contact.id)
    if (error) {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, checked: contact.checked } : c))
      alert(`Failed to update: ${error.message}`)
    }
  }

  async function deleteContact(id: string) {
    if (!window.confirm('Delete this contact? This cannot be undone.')) return
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function saveContact(data: ContactData, id?: string) {
    if (id) {
      const { error } = await supabase.from('contacts').update(data).eq('id', id)
      if (error) throw new Error(error.message)
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    } else {
      const { data: newData, error } = await supabase.from('contacts').insert(data).select().single()
      if (error) throw new Error(error.message)
      setContacts(prev => [...prev, newData as Contact].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const filtered = search
    ? contacts.filter(c => {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || (c.company?.toLowerCase().includes(q) ?? false)
      })
    : contacts

  if (loading) return <p style={{ padding: 24, color: '#444444' }}>Loading…</p>

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid #2A2A2A',
      }}>
        <span style={{ fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#444444' }}>
          {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
        </span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or company…"
          style={{ fontSize: 12, padding: '5px 10px', width: 240 }}
        />
        <button className="btn-primary" onClick={() => setShowAddModal(true)} style={{ marginLeft: 'auto' }}>
          + Add Contact
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH}>Name</th>
              <th style={TH}>Company</th>
              <th style={TH}>Spotify</th>
              <th style={{ ...TH, textAlign: 'center' }}>Checked</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#444444', padding: 40 }}>
                  {search ? 'No contacts match your search.' : 'No contacts yet. Click "+ Add Contact" to get started.'}
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="pipeline-row">
                <td style={{ ...TD, color: '#F0F0F0', fontWeight: 500 }}>{c.name}</td>
                <td style={TD}>{c.company || '—'}</td>
                <td style={TD}>
                  {c.spotify_url ? (
                    <a
                      href={c.spotify_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#1DB954', fontSize: 12, textDecoration: 'none', letterSpacing: '0.02em' }}
                      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                      onMouseLeave={e => (e.currentTarget.style.filter = '')}
                    >
                      ↗ Spotify
                    </a>
                  ) : <span style={{ color: '#444444' }}>—</span>}
                </td>
                <td style={{ ...TD, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="ben-check"
                    checked={c.checked}
                    onChange={() => toggleChecked(c)}
                  />
                </td>
                <td style={{ ...TD, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button
                      className="row-delete-btn"
                      onClick={() => setEditContact(c)}
                      style={{ visibility: 'visible', fontSize: 13 }}
                      title="Edit"
                    >✎</button>
                    <button
                      className="row-delete-btn"
                      onClick={() => deleteContact(c.id)}
                      style={{ visibility: 'visible' }}
                      title="Delete"
                    >🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAddModal || editContact) && (
        <ContactModal
          contact={editContact}
          onClose={() => { setShowAddModal(false); setEditContact(null) }}
          onSubmit={data => saveContact(data, editContact?.id)}
        />
      )}
    </div>
  )
}

function ContactModal({ contact, onClose, onSubmit }: {
  contact: Contact | null
  onClose: () => void
  onSubmit: (data: ContactData) => Promise<void>
}) {
  const [name, setName] = useState(contact?.name ?? '')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [spotifyUrl, setSpotifyUrl] = useState(contact?.spotify_url ?? '')
  const [checked, setChecked] = useState(contact?.checked ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        company: company.trim() || null,
        spotify_url: spotifyUrl.trim() || null,
        checked,
      })
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
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#444444', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0F0F0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444444')}>×</button>
        </div>
        {error && <p style={{ color: '#E0142A', margin: '0 0 12px', fontSize: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={IS} autoFocus />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>Company</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} style={IS} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={LS}>Spotify URL</label>
            <input type="text" value={spotifyUrl} onChange={e => setSpotifyUrl(e.target.value)} placeholder="https://open.spotify.com/user/…" style={IS} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...LS, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" className="ben-check" checked={checked} onChange={e => setChecked(e.target.checked)} />
              Checked
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : contact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

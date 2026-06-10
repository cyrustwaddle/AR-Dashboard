import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ---------- Types ----------

interface PitchArtist {
  id: string
  artist_name: string
  genre_lane: string | null
  spotify_monthly_listeners: number | null
  tiktok_followers: number | null
  tiktok_avg_views: number | null
  tiktok_url: string | null
  spotify_url: string | null
  instagram_url: string | null
  notes: string | null
  stage: string | null
}

interface SelectedArtist extends PitchArtist {
  rawNotes: string
  polishedNotes: string | null
  polishing: boolean
  outdated: boolean
}

interface RevisionEntry {
  instruction: string
}

interface ConfirmedExample {
  artist_name: string
  raw_notes: string | null
  confirmed_notes: string | null
}

// ---------- Helpers ----------

function fmtNum(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function generateEmail(artists: SelectedArtist[]): string {
  if (artists.length === 0) return ''
  const count = artists.length
  const blocks = artists.map((a, i) => {
    const linkParts = [
      a.spotify_url ? `[SPOTIFY](${a.spotify_url})` : null,
      a.tiktok_url ? `[TIKTOK](${a.tiktok_url})` : null,
      a.instagram_url ? `[INSTAGRAM](${a.instagram_url})` : null,
    ].filter((x): x is string => x !== null)
    const notes = (a.polishedNotes && !a.outdated) ? a.polishedNotes : (a.rawNotes || '—')
    const lines = [
      `${i + 1}.) ${a.artist_name}`,
      `Genre: ${a.genre_lane || '—'}`,
      `Monthly: ${fmtNum(a.spotify_monthly_listeners)}`,
    ]
    if (linkParts.length > 0) lines.push(`Links: ${linkParts.join(' | ')}`)
    lines.push(`Notes: ${notes}`)
    return lines.join('\n')
  })
  return `Hey Ben,\n\n${count} ${count === 1 ? 'play' : 'plays'} I've been tracking:\n\n${blocks.join('\n\n')}\n\nBest,`
}

async function callClaude(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `API error ${res.status}`)
  }
  const data = await res.json() as { content: Array<{ text: string }> }
  return data.content[0].text
}

function extractNotesFromEmail(email: string, artistName: string, index: number): string {
  const blockMarker = `${index + 1}.) ${artistName}`
  const blockStart = email.indexOf(blockMarker)
  if (blockStart === -1) return ''
  const notesLabel = 'Notes: '
  const notesIdx = email.indexOf(notesLabel, blockStart)
  if (notesIdx === -1) return ''
  const contentStart = notesIdx + notesLabel.length
  const blockEnd = email.indexOf('\n\n', notesIdx)
  return (blockEnd === -1 ? email.slice(contentStart) : email.slice(contentStart, blockEnd)).trim()
}

// ---------- Sub-components ----------

function Pill({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank" rel="noreferrer"
      style={{
        color, border: `1px solid ${color}4D`, background: 'transparent',
        padding: '3px 10px', borderRadius: 2, fontSize: 11,
        letterSpacing: '0.05em', textDecoration: 'none',
        display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 500,
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
    >{label}</a>
  )
}

// ---------- Shared styles ----------

const SL: React.CSSProperties = {
  margin: '0 0 14px', fontSize: 10, fontWeight: 500,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#444444',
  borderBottom: '1px solid #2A2A2A', paddingBottom: 8,
}

const FIELD_LABEL: React.CSSProperties = {
  display: 'block', fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#555555', marginBottom: 4,
}

// ---------- Main component ----------

export default function PitchGenerator() {
  const [allArtists, setAllArtists] = useState<PitchArtist[]>([])
  const [loadingArtists, setLoadingArtists] = useState(true)
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [emailDraft, setEmailDraft] = useState('')
  const [userEditedEmail, setUserEditedEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [revisions, setRevisions] = useState<RevisionEntry[]>([])
  const [revisionInput, setRevisionInput] = useState('')
  const [revising, setRevising] = useState(false)

  // Load ben-sendable artists
  useEffect(() => {
    supabase
      .from('artists')
      .select('id, artist_name, genre_lane, spotify_monthly_listeners, tiktok_followers, tiktok_avg_views, tiktok_url, spotify_url, instagram_url, notes, stage')
      .eq('ben_sendable', true)
      .order('artist_name')
      .then(({ data }) => {
        setAllArtists((data ?? []) as PitchArtist[])
        setLoadingArtists(false)
      })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropdownOpen])

  // Auto-regenerate email when artists or their notes change
  useEffect(() => {
    if (!userEditedEmail) setEmailDraft(generateEmail(selectedArtists))
  }, [selectedArtists, userEditedEmail])

  // ---- Handlers ----

  function addArtist(artist: PitchArtist) {
    setSelectedArtists(prev => [
      ...prev,
      { ...artist, rawNotes: '', polishedNotes: null, polishing: false, outdated: false },
    ])
  }

  function removeArtist(id: string) {
    setSelectedArtists(prev => prev.filter(a => a.id !== id))
  }

  function updateRawNotes(id: string, rawNotes: string) {
    setSelectedArtists(prev => prev.map(a =>
      a.id === id
        ? { ...a, rawNotes, outdated: a.polishedNotes != null }
        : a
    ))
  }

  async function polishNotes(artistId: string) {
    const artist = selectedArtists.find(a => a.id === artistId)
    if (!artist || !artist.rawNotes.trim()) return

    setSelectedArtists(prev => prev.map(a => a.id === artistId ? { ...a, polishing: true } : a))

    try {
      const { data: exData } = await supabase
        .from('confirmed_pitches')
        .select('artist_name, raw_notes, confirmed_notes')
        .order('confirmed_at', { ascending: false })
        .limit(5)

      const examples = (exData ?? []) as ConfirmedExample[]

      let system = `You are polishing A&R scouting notes into a brief, direct paragraph for a VP of A&R at Atlantic Records.

Rules:
- 3-5 sentences max
- Only include what Ben cares about: deal situation, competition, trajectory, engagement signals, Harold flag if present
- No fluff, no hype, no adjectives that don't carry information
- If Harold is mentioned, keep it factual: "Harold and I have spoken with him/her on the label side — he isn't moving on it."
- Tone: direct, peer-to-peer, no overselling
- Never start with the artist name
- Return ONLY the polished paragraph, no preamble, no explanation`

      if (examples.length > 0) {
        system += `\n\nYou also have confirmed examples of notes Cyrus has approved. Match this tone and style:\n\n`
        system += examples.map(ex =>
          `Artist: ${ex.artist_name}\nRaw: ${ex.raw_notes ?? ''}\nApproved: ${ex.confirmed_notes ?? ''}`
        ).join('\n---\n')
      }

      const context = [
        artist.artist_name,
        artist.genre_lane,
        artist.spotify_monthly_listeners != null ? `${fmtNum(artist.spotify_monthly_listeners)} monthly listeners` : null,
        artist.tiktok_followers != null ? `${fmtNum(artist.tiktok_followers)} TikTok followers` : null,
        artist.tiktok_avg_views != null ? `${fmtNum(artist.tiktok_avg_views)} avg TikTok views` : null,
        artist.stage,
      ].filter(Boolean).join(', ')

      const polished = await callClaude(
        system,
        `Raw notes: ${artist.rawNotes}\nArtist context: ${context}`,
        1000,
      )

      setSelectedArtists(prev => prev.map(a =>
        a.id === artistId ? { ...a, polishedNotes: polished, polishing: false, outdated: false } : a
      ))
    } catch (err) {
      alert(`Polish failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setSelectedArtists(prev => prev.map(a => a.id === artistId ? { ...a, polishing: false } : a))
    }
  }

  async function applyRevision() {
    if (!revisionInput.trim() || revising) return
    setRevising(true)

    const system = `You are revising a Ben-facing A&R pitch email based on a specific instruction.

Return ONLY the full updated email body — no explanation, no preamble, no markdown.
Keep the exact template format.
Apply only what the instruction asks. Change nothing else.

Previous pitch emails for tone and context reference:

---
Hey Ben,

2 plays I've been tracking:

1.) Southbound
Genre: House/Kettema adjacent
Monthly: 345K
Links: [SPOTIFY](https://open.spotify.com/artist/0dlNkho2CWhX2Cs2lmER6L) | [TIKTOK](https://www.tiktok.com/@southbound.iou) | [INSTAGRAM](https://www.instagram.com/southbound.iou/)
Notes: All 3 songs performed well on minimal spend. The deal was inked before he had any motion and they only put ~$2-3K into marketing via him. One song left on his AAO deal, shopping for future music. Given his deal terms were set pre-traction, we could potentially get in for cheap. No manager. Wants to start performing live. Strong TikTok engagement across posts. Harold and I have both spoken with him a few times on the label side — he isn't moving on it.

2.) Zizii
Genre: DMV/Bktherula adjacent
Monthly: 8,258
Links: [SPOTIFY](https://open.spotify.com/artist/1Cc8XsEdqruB06bfcpF6FQ) | [TIKTOK](https://www.tiktok.com/@zizikinz) | [INSTAGRAM](https://www.instagram.com/soyazizi/)
Notes: Still early but the sound is there and she's already drawing interest. Incredible engagement on TikTok/IG. In talks with some labels/potential offers on the table (APG, The Group Music, Create). No manager. Can send you unreleased if interested. Harold and I have also had a group call with her on the label side. He isn't moving on this either given the competition/budget size.

Best,
---`

    const artistData = selectedArtists.map(a => ({
      artist_name: a.artist_name,
      genre_lane: a.genre_lane,
      spotify_monthly_listeners: a.spotify_monthly_listeners,
      tiktok_followers: a.tiktok_followers,
      tiktok_avg_views: a.tiktok_avg_views,
      polished_notes: (a.polishedNotes && !a.outdated) ? a.polishedNotes : null,
    }))

    const userMsg = `Current draft:\n${emailDraft}\n\nRevision instruction: ${revisionInput}\n\nAll artist data:\n${JSON.stringify(artistData, null, 2)}`

    try {
      const revised = await callClaude(system, userMsg, 2000)
      setEmailDraft(revised)
      setUserEditedEmail(true)
      setRevisions(prev => [...prev, { instruction: revisionInput }])
      setRevisionInput('')
    } catch (err) {
      alert(`Revision failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRevising(false)
    }
  }

  async function handleConfirm() {
    if (confirming || selectedArtists.length === 0) return
    setConfirming(true)
    try {
      const rows = selectedArtists.map((a, i) => ({
        artist_id: a.id,
        artist_name: a.artist_name,
        raw_notes: a.rawNotes || null,
        confirmed_notes: extractNotesFromEmail(emailDraft, a.artist_name, i) || null,
      }))
      const { error } = await supabase.from('confirmed_pitches').insert(rows)
      if (error) throw new Error(error.message)
      setConfirmed(true)
      setTimeout(() => setConfirmed(false), 2000)
    } catch (err) {
      alert(`Confirm failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setConfirming(false)
    }
  }

  const availableArtists = allArtists.filter(a => !selectedArtists.some(s => s.id === a.id))
  const hasPolished = selectedArtists.some(a => a.polishedNotes !== null)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 800 }}>

      {/* ── Section 1: Artist multi-select ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={SL}>Select Artists</div>

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          {/* Trigger */}
          <div
            onClick={() => { if (!loadingArtists) setDropdownOpen(o => !o) }}
            style={{
              background: '#1C1C1C',
              border: `1px solid ${dropdownOpen ? '#E0142A' : '#2A2A2A'}`,
              borderRadius: 4, padding: '8px 12px',
              cursor: loadingArtists ? 'not-allowed' : 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 13, color: '#666666', userSelect: 'none',
              transition: 'border-color 0.15s',
            }}
          >
            <span>{loadingArtists ? 'Loading artists…' : 'Select artists…'}</span>
            <span style={{ fontSize: 9, color: '#444444' }}>{dropdownOpen ? '▲' : '▼'}</span>
          </div>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#1C1C1C', border: '1px solid #2A2A2A', borderRadius: 4,
              zIndex: 100, maxHeight: 240, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {availableArtists.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12, color: '#444444' }}>
                  {selectedArtists.length === allArtists.length && allArtists.length > 0
                    ? 'All artists selected'
                    : 'No ben-sendable artists found'}
                </div>
              ) : (
                availableArtists.map(a => (
                  <div
                    key={a.id}
                    onClick={() => addArtist(a)}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                      borderBottom: '1px solid #1A1A1A',
                      display: 'flex', alignItems: 'baseline', gap: 8,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#222222')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: '#F0F0F0', fontWeight: 500 }}>{a.artist_name}</span>
                    {a.genre_lane && (
                      <span style={{ fontSize: 11, color: '#666666' }}>{a.genre_lane}</span>
                    )}
                    {a.spotify_monthly_listeners != null && (
                      <span style={{ fontSize: 11, color: '#555555', marginLeft: 'auto', flexShrink: 0 }}>
                        {fmtNum(a.spotify_monthly_listeners)} mo.
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected chips */}
        {selectedArtists.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {selectedArtists.map(a => (
              <span
                key={a.id}
                style={{
                  background: '#1C1C1C', border: '1px solid #2A2A2A',
                  borderRadius: 2, padding: '4px 10px',
                  fontSize: 12, color: '#F0F0F0',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {a.artist_name}
                <span
                  onClick={() => removeArtist(a.id)}
                  style={{ color: '#555555', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E0142A')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
                >×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Per-artist note cards ── */}
      {selectedArtists.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={SL}>Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedArtists.map(a => (
              <div
                key={a.id}
                style={{
                  background: '#1C1C1C', border: '1px solid #2A2A2A',
                  borderRadius: 4, padding: 16,
                }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F0F0' }}>{a.artist_name}</span>
                    {a.genre_lane && <span style={{ fontSize: 12, color: '#666666' }}>{a.genre_lane}</span>}
                  </div>
                  <span
                    onClick={() => removeArtist(a.id)}
                    style={{ color: '#444444', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E0142A')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#444444')}
                  >×</span>
                </div>

                {/* Metrics */}
                {(a.spotify_monthly_listeners != null || a.tiktok_followers != null || a.tiktok_avg_views != null) && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                    {a.spotify_monthly_listeners != null && (
                      <span style={{ fontSize: 12, color: '#AAAAAA' }}>
                        <span style={{ color: '#555555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Spotify </span>
                        {fmtNum(a.spotify_monthly_listeners)}
                      </span>
                    )}
                    {a.tiktok_followers != null && (
                      <span style={{ fontSize: 12, color: '#AAAAAA' }}>
                        <span style={{ color: '#555555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TikTok </span>
                        {fmtNum(a.tiktok_followers)}
                      </span>
                    )}
                    {a.tiktok_avg_views != null && (
                      <span style={{ fontSize: 12, color: '#AAAAAA' }}>
                        <span style={{ color: '#555555', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg Views </span>
                        {fmtNum(a.tiktok_avg_views)}
                      </span>
                    )}
                  </div>
                )}

                {/* Platform pills */}
                {(a.spotify_url || a.tiktok_url || a.instagram_url) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {a.spotify_url && <Pill href={a.spotify_url} label="SPOTIFY" color="#1DB954" />}
                    {a.tiktok_url && <Pill href={a.tiktok_url} label="TIKTOK" color="#69C9D0" />}
                    {a.instagram_url && <Pill href={a.instagram_url} label="INSTAGRAM" color="#E1306C" />}
                  </div>
                )}

                {/* Raw notes textarea */}
                <div>
                  <label style={FIELD_LABEL}>Raw Notes</label>
                  <textarea
                    value={a.rawNotes}
                    placeholder="Paste your scouting notes here…"
                    onChange={e => updateRawNotes(a.id, e.target.value)}
                    rows={4}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.55 }}
                  />
                </div>

                {/* Polish button */}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn-ghost"
                    onClick={() => polishNotes(a.id)}
                    disabled={!a.rawNotes.trim() || a.polishing}
                    style={{ opacity: (!a.rawNotes.trim() || a.polishing) ? 0.4 : 1 }}
                  >
                    {a.polishing ? 'Polishing…' : (a.outdated ? 'Re-polish →' : 'Polish →')}
                  </button>
                </div>

                {/* Polished output */}
                {a.polishedNotes && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={FIELD_LABEL}>Polished</label>
                      {a.outdated && (
                        <span style={{ fontSize: 10, color: '#555555', letterSpacing: '0.02em' }}>
                          Outdated — re-polish to update
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        background: '#141414', border: '1px solid #222222',
                        borderRadius: 3, padding: '10px 12px',
                        fontSize: 12, color: '#AAAAAA', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        opacity: a.outdated ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {a.polishedNotes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Email preview ── */}
      {selectedArtists.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...SL }}>
            <span>Draft</span>
            {userEditedEmail && (
              <span
                onClick={() => { setUserEditedEmail(false); setEmailDraft(generateEmail(selectedArtists)) }}
                style={{ fontSize: 11, color: '#666666', cursor: 'pointer', letterSpacing: '0.02em', fontWeight: 400, textTransform: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#AAAAAA')}
                onMouseLeave={e => (e.currentTarget.style.color = '#666666')}
              >
                Reset to generated
              </span>
            )}
          </div>
          <textarea
            value={emailDraft}
            onChange={e => { setEmailDraft(e.target.value); setUserEditedEmail(true) }}
            style={{
              width: '100%', boxSizing: 'border-box',
              minHeight: 320, resize: 'vertical',
              fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.65,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              className="btn-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(emailDraft)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? '✓ Copied' : 'Copy email'}
            </button>
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirmed ? '✓ Confirmed' : confirming ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 4: Revision chat ── */}
      {hasPolished && (
        <div>
          <div style={SL}>Revise the Draft</div>

          {revisions.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {revisions.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#666666', padding: '4px 0', borderBottom: '1px solid #1A1A1A' }}>
                  <span style={{ fontSize: 10, color: '#444444', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>
                    Revision {i + 1}
                  </span>
                  {r.instruction}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={revisionInput}
              onChange={e => setRevisionInput(e.target.value)}
              placeholder="e.g. Make the tone less formal…"
              disabled={revising}
              onKeyDown={e => { if (e.key === 'Enter' && revisionInput.trim() && !revising) applyRevision() }}
              style={{ flex: 1, fontFamily: 'Inter, sans-serif' }}
            />
            <button
              className="btn-ghost"
              onClick={applyRevision}
              disabled={!revisionInput.trim() || revising}
              style={{ opacity: (!revisionInput.trim() || revising) ? 0.4 : 1, whiteSpace: 'nowrap' }}
            >
              {revising ? 'Applying…' : 'Apply →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import PipelineView from './components/PipelineView'
import OnboardingView from './components/OnboardingView'
import PitchGenerator from './components/PitchGenerator'

type Tab = 'pipeline' | 'onboarding' | 'pitch'

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function App() {
  const [tab, setTab] = useState<Tab>('pipeline')
  const [month, setMonth] = useState(currentMonthStr)
  const [prevHover, setPrevHover] = useState(false)
  const [nextHover, setNextHover] = useState(false)

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#141414' }}>

      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center',
        padding: '0 20px', height: 48,
        borderBottom: '1px solid #2A2A2A',
        background: '#0F0808',
      }}>
        {/* Logo */}
        <span style={{ userSelect: 'none', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: '#E0142A', textTransform: 'uppercase' }}>A&amp;R</span>
          <span style={{ fontWeight: 300, fontSize: 13, letterSpacing: '0.08em', color: '#F0F0F0', textTransform: 'uppercase' }}>{' '}DASHBOARD</span>
        </span>

        {/* Month nav — centered */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <button
            style={{ background: 'none', border: 'none', color: prevHover ? '#F0F0F0' : '#888888', fontSize: 18, padding: '0 6px', lineHeight: 1, borderRadius: 0 }}
            onMouseEnter={() => setPrevHover(true)}
            onMouseLeave={() => setPrevHover(false)}
            onClick={() => setMonth(m => addMonths(m, -1))}
          >‹</button>
          <span style={{ color: '#F0F0F0', fontWeight: 500, fontSize: 13, minWidth: 130, textAlign: 'center', letterSpacing: '0.02em' }}>
            {formatMonthLabel(month)}
          </span>
          <button
            style={{ background: 'none', border: 'none', color: nextHover ? '#F0F0F0' : '#888888', fontSize: 18, padding: '0 6px', lineHeight: 1, borderRadius: 0 }}
            onMouseEnter={() => setNextHover(true)}
            onMouseLeave={() => setNextHover(false)}
            onClick={() => setMonth(m => addMonths(m, 1))}
          >›</button>
        </div>

        {/* Right spacer to balance logo */}
        <span style={{ flexShrink: 0, minWidth: 100 }} />
      </header>

      {/* Tab bar */}
      <nav style={{ display: 'flex', borderBottom: '1px solid #2A2A2A', background: '#141414', padding: '0 20px' }}>
        {(['pipeline', 'onboarding', 'pitch'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #E0142A' : '2px solid transparent',
              color: tab === t ? '#F0F0F0' : '#444444',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '10px 16px',
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            {t === 'pipeline' ? 'Pipeline' : t === 'onboarding' ? 'Onboarding Checklist' : 'Pitch Generator'}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'pipeline' && <PipelineView month={month} />}
        {tab === 'onboarding' && <OnboardingView month={month} />}
        {tab === 'pitch' && <PitchGenerator />}
      </main>
    </div>
  )
}

import { useState } from 'react'
import PipelineView from './components/PipelineView'
import OnboardingView from './components/OnboardingView'

type Tab = 'pipeline' | 'onboarding'

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

  const navStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 20px',
    cursor: 'pointer',
    border: 'none',
    borderBottom: tab === t ? '3px solid #2563eb' : '3px solid transparent',
    background: 'none',
    fontWeight: tab === t ? 700 : 400,
    fontSize: 14,
    color: tab === t ? '#2563eb' : '#374151',
  })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#fff' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', borderBottom: '1px solid #e2e8f0',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginRight: 16 }}>
          A&amp;R Dashboard
        </span>
        <button style={navStyle('pipeline')} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button style={navStyle('onboarding')} onClick={() => setTab('onboarding')}>Onboarding</button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setMonth(m => addMonths(m, -1))}
            style={{ padding: '4px 10px', cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', fontSize: 16, lineHeight: 1 }}
          >‹</button>
          <span style={{ minWidth: 130, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
            {formatMonthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            style={{ padding: '4px 10px', cursor: 'pointer', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', fontSize: 16, lineHeight: 1 }}
          >›</button>
        </div>
      </header>

      <main>
        {tab === 'pipeline' && <PipelineView month={month} />}
        {tab === 'onboarding' && <OnboardingView month={month} />}
      </main>
    </div>
  )
}

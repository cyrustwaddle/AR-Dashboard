import { useState } from 'react'
import PipelineView from './components/PipelineView'
import OnboardingView from './components/OnboardingView'

type Tab = 'pipeline' | 'onboarding'

export default function App() {
  const [tab, setTab] = useState<Tab>('pipeline')

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
      </header>

      <main>
        {tab === 'pipeline' && <PipelineView />}
        {tab === 'onboarding' && <OnboardingView />}
      </main>
    </div>
  )
}

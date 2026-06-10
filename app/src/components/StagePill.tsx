import type { Stage } from '../lib/types'

interface Props {
  stage: Stage | null
}

const PILL_STYLES: Record<Stage, { background: string; color: string; border: string }> = {
  Radar:             { background: '#1A1A1A', color: '#666666', border: '1px solid #222222' },
  Contacted:         { background: '#0D1A0D', color: '#4CAF50', border: '1px solid #1A3A1A' },
  'In Conversation': { background: '#1A1400', color: '#D4A017', border: '1px solid #3A3000' },
  'Passed to Ben':   { background: '#1A0D0D', color: '#E0142A', border: '1px solid #3A1A1A' },
  Passed:            { background: '#111111', color: '#444444', border: '1px solid #1A1A1A' },
  Signed:            { background: '#0A1A0A', color: '#22C55E', border: '1px solid #1A4020' },
}

export default function StagePill({ stage }: Props) {
  if (!stage) return <span style={{ color: '#444444' }}>—</span>
  const s = PILL_STYLES[stage]
  return (
    <span style={{
      background: s.background,
      color: s.color,
      border: s.border,
      borderRadius: 2,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {stage}
    </span>
  )
}

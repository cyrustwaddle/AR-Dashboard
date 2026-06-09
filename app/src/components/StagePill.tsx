import type { Stage } from '../lib/types'
import { STAGE_COLORS } from '../lib/types'

interface Props {
  stage: Stage | null
}

export default function StagePill({ stage }: Props) {
  if (!stage) return <span style={{ color: '#aaa' }}>—</span>
  const bg = STAGE_COLORS[stage]
  return (
    <span style={{
      background: bg,
      color: '#fff',
      borderRadius: 12,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {stage}
    </span>
  )
}

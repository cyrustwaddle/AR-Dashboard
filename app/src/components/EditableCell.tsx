import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'

interface Props {
  value: string | number | boolean | null
  type?: 'text' | 'number' | 'date' | 'select' | 'boolean'
  options?: string[]
  onSave: (val: string | number | boolean | null) => void
  render?: (val: string | number | boolean | null) => React.ReactNode
}

export default function EditableCell({ value, type = 'text', options, onSave, render }: Props) {
  const [editing, setEditing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  function startEdit() {
    setDraft(value == null ? '' : String(value))
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (type === 'number') {
      const n = draft === '' ? null : Number(draft)
      onSave(isNaN(n as number) ? null : n)
    } else if (type === 'boolean') {
      onSave(draft === 'true')
    } else {
      onSave(draft === '' ? null : draft)
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (type === 'boolean') {
    return (
      <input
        type="checkbox"
        className="ben-check"
        checked={!!value}
        onChange={e => onSave(e.target.checked)}
      />
    )
  }

  if (editing) {
    if (type === 'select' && options) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          style={{ width: '100%', fontSize: 'inherit' }}
        >
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        style={{ width: '100%', fontSize: 'inherit', boxSizing: 'border-box' }}
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        cursor: 'text',
        minHeight: '1.4em',
        minWidth: 40,
        borderBottom: hovering ? '1px solid #2A2A2A' : '1px solid transparent',
      }}
      title="Click to edit"
    >
      {render
        ? render(value)
        : (value == null || value === ''
          ? <span style={{ color: '#444444' }}>—</span>
          : String(value)
        )
      }
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  const hh = String(h).padStart(2, '0')
  const period = h < 12 ? 'AM' : 'PM'
  const display = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m} ${period}`
  return { value: `${hh}:${m}`, display }
})

function format24to12(val) {
  if (!val) return ''
  const slot = TIME_SLOTS.find(s => s.value === val)
  return slot ? slot.display : val
}

export default function TimeInput({ value, onChange, id, name, required }) {
  const [text, setText] = useState(format24to12(value))
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [prevValue, setPrevValue] = useState(value)
  const wrapperRef = useRef(null)
  const listRef = useRef(null)

  if (value !== prevValue) {
    setPrevValue(value)
    setText(format24to12(value))
  }

  const filtered = TIME_SLOTS.filter(s =>
    s.display.toLowerCase().includes(text.toLowerCase().trim()) ||
    s.value.startsWith(text.trim())
  )

  function select(slot) {
    setText(slot.display)
    onChange({ target: { name, value: slot.value } })
    setOpen(false)
    setHighlighted(-1)
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150)
    const match = TIME_SLOTS.find(s =>
      s.display.toLowerCase() === text.toLowerCase().trim()
    )
    if (match) {
      onChange({ target: { name, value: match.value } })
    } else {
      setText(format24to12(value))
    }
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0 && filtered[highlighted]) select(filtered[highlighted])
      else if (filtered.length === 1) select(filtered[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (listRef.current && highlighted >= 0) {
      const el = listRef.current.children[highlighted]
      if (el) el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        id={id}
        name={name}
        type="text"
        autoComplete="off"
        required={required}
        placeholder="e.g. 6:00 PM"
        value={text}
        onChange={e => { setText(e.target.value); setOpen(true); setHighlighted(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((slot, i) => (
            <div
              key={slot.value}
              className={`cursor-pointer px-3 py-1.5 text-sm ${
                i === highlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              }`}
              onMouseDown={() => select(slot)}
            >
              {slot.display}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

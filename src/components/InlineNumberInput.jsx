import React, { useState, useEffect } from 'react'

export default function InlineNumberInput({ value, min, max, onChangeSubmit, className = '' }) {
  const [localVal, setLocalVal] = useState(value ?? '')

  useEffect(() => {
    setLocalVal(value ?? '')
  }, [value])

  const submit = () => {
    let parsed = parseInt(localVal, 10)
    if (isNaN(parsed)) {
      setLocalVal(value ?? '')
      return
    }
    if (min !== undefined && parsed < min) parsed = min
    if (max !== undefined && parsed > max) parsed = max
    
    setLocalVal(parsed)
    if (parsed !== value) {
      onChangeSubmit(parsed)
    }
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
      className={`w-8 md:w-10 text-center bg-transparent outline-none border-b border-transparent hover:border-white/30 focus:border-blue-400 transition-colors appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  )
}

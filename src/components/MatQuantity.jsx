import React from 'react'
import { formatNumber } from '../utils/calculator'

export default function MatQuantity({ val, icon, color = 'text-[var(--text)]', align = 'center', format = true }) {
  if (!val) {
    return (
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'}`}>
        <span className="text-[var(--muted)] opacity-50">-</span>
      </div>
    )
  }
  
  const displayVal = format ? formatNumber(val) : val
  const justifyClass = align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'

  return (
    <div className={`flex items-center gap-1.5 ${justifyClass}`}>
      <span className="text-[12px] opacity-80" title={icon}>{icon}</span>
      <span className={`font-mono text-[11px] font-bold ${color}`}>{displayVal}</span>
    </div>
  )
}

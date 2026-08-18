import React from 'react'
import { formatNumber } from '../utils/calculator'
import GenshinImage from './GenshinImage'
import { getMaterialIcon } from '../utils/assetHelper'

export default function MatQuantity({ val, color = 'text-[var(--text)]', align = 'center', format = true, nameKey, category, icon }) {
  if (!val) {
    return (
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'}`}>
        <span className="text-[var(--muted)] opacity-50">-</span>
      </div>
    )
  }
  
  const displayVal = format ? formatNumber(val) : val
  const justifyClass = align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'
  
  // Create a minimal text fallback (e.g. first 2 letters) in case image fails
  const fallbackStr = nameKey ? nameKey.substring(0, 2).toUpperCase() : '??'
  const iconFallback = <span className="text-xs font-bold text-[var(--muted)] border border-[var(--border)] rounded px-0.5 bg-[var(--elevated)] opacity-70" title={nameKey}>{fallbackStr}</span>

  const renderFallback = icon ? <span className="text-base" title={nameKey}>{icon}</span> : iconFallback;

  return (
    <div className={`flex items-center gap-2 ${justifyClass}`}>
      {nameKey ? (
        <GenshinImage 
          src={getMaterialIcon(nameKey, category)} 
          alt={nameKey} 
          className="w-8 h-8 object-contain shrink-0" 
          fallback={renderFallback} 
        />
      ) : (
        renderFallback
      )}
      <span className={`text-xs font-bold ${color}`}>{displayVal}</span>
    </div>
  )
}

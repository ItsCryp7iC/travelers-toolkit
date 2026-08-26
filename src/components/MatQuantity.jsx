import React from 'react'
import { formatNumber } from '../utils/calculator'
import GenshinImage from './GenshinImage'
import { getMaterialIcon } from '../utils/assetHelper'

export default function MatQuantity({ val, color = 'text-[var(--text)]', align = 'center', format = true, nameKey, category, icon, isStacked = false }) {
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

  const renderedVal = isStacked ? (
    <span className="border-b border-dashed border-slate-400/60 pb-[1px] cursor-help">
      {displayVal}<span className="text-[10px] ml-[1px] align-top text-slate-400">*</span>
    </span>
  ) : (
    displayVal
  );

  const imageElement = nameKey ? (
    <GenshinImage 
      src={getMaterialIcon(nameKey, category)} 
      alt={nameKey} 
      className="w-8 h-8 object-contain shrink-0 relative z-10" 
      fallback={renderFallback} 
    />
  ) : (
    renderFallback
  );

  const finalImage = isStacked ? (
    <div className="relative shrink-0 w-8 h-8">
      <div className="absolute -top-1 -right-1 w-full h-full bg-[#1e293b]/80 rounded -z-20 border border-slate-600/30"></div>
      <div className="absolute -top-0.5 -right-0.5 w-full h-full bg-[#334155]/90 rounded -z-10 border border-slate-500/40"></div>
      <div className="relative z-10 w-full h-full flex items-center justify-center bg-black/20 rounded">
        {imageElement}
      </div>
    </div>
  ) : (
    imageElement
  );

  return (
    <div className={`flex items-center gap-2 ${justifyClass}`}>
      {finalImage}
      <span className={`text-xs font-bold ${color}`}>{renderedVal}</span>
    </div>
  )
}

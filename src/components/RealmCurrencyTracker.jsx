import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { formatDuration, formatRelativeFillTime, getTimeZoneDisplayLabel } from '../utils/timeZoneUtils'

export default function RealmCurrencyTracker({ syncData, variant = 'default' }) {
 const displayTimeZone = useStore((s) => s.displayTimeZone)
 const [currentCurrency, setCurrentCurrency] = useState(0)
 const [secondsToFull, setSecondsToFull] = useState(0)
 const [maxCurrency, setMaxCurrency] = useState(2400) // Default max

 useEffect(() => {
 if (!syncData || !syncData.targetFullTime) return

 const update = () => {
 const now = Date.now()
 const targetFullTime = syncData.targetFullTime
 const max = syncData.max || 2400
 setMaxCurrency(max)

 if (now >= targetFullTime) {
 setCurrentCurrency(max)
 setSecondsToFull(0)
 } else {
 const remainingSec = Math.floor((targetFullTime - now) / 1000)

 setCurrentCurrency(syncData.current || 0)
 setSecondsToFull(remainingSec)
 }
 }
 update()
 const id = setInterval(update, 1000)
 return () => clearInterval(id)
 }, [syncData])

 if (!syncData) {
 return null; // Don't show if not synced
 }

  const isCapped = currentCurrency >= maxCurrency
  const pct = Math.min(100, (currentCurrency / maxCurrency) * 100)

  if (variant === 'compact') {
    return (
      <div 
        className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)] shrink-0 cursor-default outline-none focus:ring-1 focus:ring-primary"
        tabIndex={0}
        aria-label="Realm Currency Tracker"
      >
        <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/others/RealmCurrency.png" className="w-5 h-5 object-contain" alt="Realm Currency" />
        <span className="text-sm font-semibold whitespace-nowrap">
          <span style={{ color: isCapped ? '#4EC9B0' : 'var(--text)' }}>{currentCurrency}</span>
          <span className="text-[var(--muted)] text-xs ml-0.5">/ {maxCurrency}</span>
        </span>

        {/* Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all z-50 pointer-events-none">
          <h4 className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider mb-2 border-b border-[var(--border)] pb-1">
            Realm Currency
          </h4>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Current</span>
            <span className="text-sm font-semibold text-[var(--color-text-main)]">{currentCurrency} / {maxCurrency}</span>
          </div>

          {isCapped ? (
            <p className="text-sm text-[#4EC9B0] font-semibold mb-2">Fully replenished!</p>
          ) : (
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Full in</span>
                <span className="text-sm text-[var(--color-text-main)] font-mono">{formatDuration(secondsToFull)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Full at</span>
                <span className="text-sm text-[var(--color-text-main)] text-right">{syncData?.targetFullTime ? formatRelativeFillTime(syncData.targetFullTime, displayTimeZone) : '—'}</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--color-text-muted)]">
              Time zone: {getTimeZoneDisplayLabel(displayTimeZone)}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row gap-5 items-center shadow-lg">
 <div className="absolute top-0 right-0 w-64 h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at right, #4EC9B0, transparent)' }} />
 <span className="absolute -right-4 -bottom-6 text-9xl opacity-5 pointer-events-none select-none">🫖</span>

 {/* Icon + Count */}
 <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
 <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-[var(--elevated)] border-2" style={{ borderColor: isCapped ? '#4EC9B0' : 'rgba(78,201,176,0.4)' }}>
 <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/others/RealmCurrency.png" className="w-12 h-12 object-contain" alt="Realm Currency" style={{ filter: isCapped ? 'drop-shadow(0 0 8px rgba(78,201,176,0.6))' : 'none' }} />
 </div>
 <div className="flex-1">
 <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-0.5">Realm Currency</p>
 <div className="flex items-baseline gap-1">
 <span className=" text-3xl leading-none" style={{ color: isCapped ? '#4EC9B0' : 'var(--text)' }}>{currentCurrency}</span>
 <span className=" text-lg text-[var(--muted)]">/ {maxCurrency}</span>
 </div>
 </div>
 </div>

 {/* Progress + Timers */}
 <div className="flex-1 w-full relative z-10">
 <div className="flex justify-between items-end mb-1">
 {isCapped
 ? <p className="text-xs text-[#4EC9B0] font-semibold">Fully replenished!</p>
 : (
     <div className="text-right flex flex-col items-end w-full">
       <p className="text-xs text-[var(--muted)]">Full in <span className="text-[var(--text)]">{formatDuration(secondsToFull)}</span></p>
     </div>
   )
 }
 </div>
 {!isCapped && syncData?.targetFullTime && (
   <p className="text-xs text-[var(--muted)] text-right mb-1">
     Full at {formatRelativeFillTime(syncData.targetFullTime, displayTimeZone)}
   </p>
 )}
 <div className="h-2 w-full bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)]">
 <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: isCapped ? '#4EC9B0' : 'rgba(78,201,176,0.8)', boxShadow: isCapped ? '0 0 10px #4EC9B0' : 'none' }} />
 </div>
 </div>
 </div>
 )
}

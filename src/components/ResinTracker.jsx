import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { formatDuration, formatRelativeFillTime, getTimeZoneDisplayLabel } from '../utils/timeZoneUtils'

const RESIN_CAP = 200
const REGEN_RATE_SEC = 8 * 60 // 1 resin per 8 minutes

export default function ResinTracker({ syncData, variant = 'default' }) {
 const storeResinCount = useStore((s) => s.resinCount)
 const storeResinTimestamp = useStore((s) => s.resinTimestamp)
 const displayTimeZone = useStore((s) => s.displayTimeZone)
 const setResin = useStore((s) => s.setResin)

 const [currentResin, setCurrentResin] = useState(storeResinCount)
 const [secondsToNext, setSecondsToNext] = useState(0)
 const [secondsToFull, setSecondsToFull] = useState(0)

 useEffect(() => {
 const update = () => {
 const now = Date.now()

 if (syncData && syncData.targetFullTime) {
 const targetFullTime = syncData.targetFullTime
 const max = syncData.max || RESIN_CAP

 if (now >= targetFullTime) {
 setCurrentResin(max)
 setSecondsToNext(0)
 setSecondsToFull(0)
 } else {
 const remainingSec = Math.floor((targetFullTime - now) / 1000)
 const deficit = Math.ceil(remainingSec / REGEN_RATE_SEC)
 const calc = Math.max(0, max - deficit)

 setCurrentResin(calc)
 setSecondsToFull(remainingSec)
 setSecondsToNext(remainingSec % REGEN_RATE_SEC === 0 ? REGEN_RATE_SEC : remainingSec % REGEN_RATE_SEC)
 }
 } else {
 const elapsedSec = Math.floor((now - storeResinTimestamp) / 1000)
 const regenerated = Math.floor(elapsedSec / REGEN_RATE_SEC)
 const calc = Math.min(RESIN_CAP, storeResinCount + regenerated)
 setCurrentResin(calc)
 if (calc < RESIN_CAP) {
 setSecondsToNext(REGEN_RATE_SEC - (elapsedSec % REGEN_RATE_SEC))
 setSecondsToFull(Math.max(0, ((RESIN_CAP - calc) * REGEN_RATE_SEC) - (elapsedSec % REGEN_RATE_SEC)))
 } else {
 setSecondsToNext(0)
 setSecondsToFull(0)
 }
 }
 }
 update()
 const id = setInterval(update, 1000)
 return () => clearInterval(id)
 }, [storeResinCount, storeResinTimestamp, syncData])

 const isCapped = currentResin >= (syncData?.max || RESIN_CAP)
 const pct = Math.min(100, (currentResin / (syncData?.max || RESIN_CAP)) * 100)

 let targetFullTimeMs = null;
 if (!isCapped) {
   if (syncData?.targetFullTime) {
     targetFullTimeMs = syncData.targetFullTime;
   } else {
     const totalSecondsToFull = (RESIN_CAP - storeResinCount) * REGEN_RATE_SEC;
     targetFullTimeMs = storeResinTimestamp + (totalSecondsToFull * 1000);
   }
 }

 if (variant === 'compact') {
    return (
      <div 
        className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)] shrink-0 cursor-default outline-none focus:ring-1 focus:ring-primary"
        tabIndex={0}
        aria-label="Resin Tracker"
      >
        <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/others/FragileResin.png" className="w-5 h-5 object-contain" alt="Resin" />
        <span className="text-sm font-semibold whitespace-nowrap">
          <span style={{ color: isCapped ? '#FFD700' : 'var(--text)' }}>{currentResin}</span>
          <span className="text-[var(--muted)] text-xs ml-0.5">/ {syncData?.max || RESIN_CAP}</span>
        </span>

        {/* Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible transition-all z-50 pointer-events-none">
          <h4 className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider mb-2 border-b border-[var(--border)] pb-1">
            Original Resin
          </h4>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Current</span>
            <span className="text-sm font-semibold text-[var(--color-text-main)]">{currentResin} / {syncData?.max || RESIN_CAP}</span>
          </div>

          {isCapped ? (
            <p className="text-sm text-[#FFD700] font-semibold mb-2">Fully replenished!</p>
          ) : (
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Next in</span>
                <span className="text-sm text-[var(--color-text-main)] font-mono">{formatDuration(secondsToNext)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Full in</span>
                <span className="text-sm text-[var(--color-text-main)] font-mono">{formatDuration(secondsToFull)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Full at</span>
                <span className="text-sm text-[var(--color-text-main)] text-right">{targetFullTimeMs ? formatRelativeFillTime(targetFullTimeMs, displayTimeZone) : '—'}</span>
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
 <div className="absolute top-0 right-0 w-64 h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at right, var(--gold), transparent)' }} />
 <span className="absolute -right-4 -bottom-6 text-9xl opacity-5 pointer-events-none select-none">🌙</span>

 {/* Icon + Count */}
 <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
 <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-[var(--elevated)] border-2" style={{ borderColor: isCapped ? '#FFD700' : 'rgba(200,169,110,0.4)' }}>
 <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/others/FragileResin.png" className="w-12 h-12 object-contain" alt="Resin" style={{ filter: isCapped ? 'drop-shadow(0 0 8px rgba(255,215,0,0.6))' : 'none' }} />
 </div>
 <div className="flex-1">
 <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-0.5">Original Resin</p>
 <div className="flex items-baseline gap-1">
 <span className=" text-3xl leading-none" style={{ color: isCapped ? '#FFD700' : 'var(--text)' }}>{currentResin}</span>
 <span className=" text-lg text-[var(--muted)]">/ {syncData?.max || RESIN_CAP}</span>
 </div>
 </div>
 </div>

 {/* Progress + Timers */}
 <div className="flex-1 w-full relative z-10">
 <div className="flex justify-between items-end mb-1">
 {isCapped
 ? <p className="text-xs text-[#FFD700] font-semibold">Fully replenished!</p>
 : (
     <>
       <p className="text-xs text-[var(--muted)]">Next in <span className="text-[var(--gold)]">{formatDuration(secondsToNext)}</span></p>
       <div className="text-right flex flex-col items-end">
         <p className="text-xs text-[var(--muted)]">Full in <span className="text-[var(--text)]">{formatDuration(secondsToFull)}</span></p>
       </div>
     </>
   )
 }
 </div>
 {!isCapped && targetFullTimeMs && (
   <p className="text-xs text-[var(--muted)] text-right mb-1">
     Full at {formatRelativeFillTime(targetFullTimeMs, displayTimeZone)}
   </p>
 )}
 <div className="h-2 w-full bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)]">
 <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: isCapped ? '#FFD700' : 'var(--gold)', boxShadow: isCapped ? '0 0 10px #FFD700' : 'none' }} />
 </div>
 </div>

 {/* Quick controls */}
 {!syncData && (
 <div className="flex items-center gap-2 relative z-10 w-full md:w-auto justify-end flex-wrap">
 <button onClick={() => setResin(currentResin - 40)} disabled={currentResin < 40} className="px-3 py-1.5 rounded-lg text-xs bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/20 hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-30 transition-colors">-40</button>
 <button onClick={() => setResin(currentResin - 20)} disabled={currentResin < 20} className="px-3 py-1.5 rounded-lg text-xs bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/20 hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-30 transition-colors">-20</button>
 <div className="w-px h-7 bg-[var(--border)]" />
 <button onClick={() => setResin(currentResin + 60)} disabled={currentResin >= RESIN_CAP} className="px-3 py-1.5 rounded-lg text-xs bg-[rgba(78,201,176,0.1)] text-[#4EC9B0] border border-[#4EC9B0]/20 hover:bg-[rgba(78,201,176,0.2)] disabled:opacity-30 transition-colors" title="Fragile Resin">+60</button>
 </div>
 )}
 </div>
 )
}

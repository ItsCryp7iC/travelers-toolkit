import React, { useState, useEffect } from 'react'

function formatTime(totalSeconds) {
  if (totalSeconds <= 0) return '00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export default function RealmCurrencyTracker({ syncData }) {
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
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-0.5">Realm Currency</p>
          <div className="flex items-baseline gap-1">
            <span className="font-cinzel font-bold text-3xl leading-none" style={{ color: isCapped ? '#4EC9B0' : 'var(--text)' }}>{currentCurrency}</span>
            <span className="font-cinzel font-bold text-lg text-[var(--muted)]">/ {maxCurrency}</span>
          </div>
        </div>
      </div>

      {/* Progress + Timers */}
      <div className="flex-1 w-full relative z-10">
        <div className="flex justify-between items-end mb-1.5">
          {isCapped
            ? <p className="text-xs text-[#4EC9B0] font-semibold">Fully replenished!</p>
            : <p className="text-xs text-[var(--muted)]">Full in <span className="font-mono text-[var(--text)]">{formatTime(secondsToFull)}</span></p>
          }
        </div>
        <div className="h-2 w-full bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)]">
          <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: isCapped ? '#4EC9B0' : 'rgba(78,201,176,0.8)', boxShadow: isCapped ? '0 0 10px #4EC9B0' : 'none' }} />
        </div>
      </div>
    </div>
  )
}

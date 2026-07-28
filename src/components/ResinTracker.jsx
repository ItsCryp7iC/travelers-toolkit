import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'

const RESIN_CAP = 200
const REGEN_RATE_SEC = 8 * 60 // 1 resin per 8 minutes

function formatTime(totalSeconds) {
  if (totalSeconds <= 0) return '00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export default function ResinTracker() {
  const resinCount     = useStore((s) => s.resinCount)
  const resinTimestamp = useStore((s) => s.resinTimestamp)
  const setResin       = useStore((s) => s.setResin)

  const [currentResin,  setCurrentResin]  = useState(resinCount)
  const [secondsToNext, setSecondsToNext] = useState(0)
  const [secondsToFull, setSecondsToFull] = useState(0)

  useEffect(() => {
    const update = () => {
      const now = Date.now()
      const elapsedSec = Math.floor((now - resinTimestamp) / 1000)
      const regenerated = Math.floor(elapsedSec / REGEN_RATE_SEC)
      const calc = Math.min(RESIN_CAP, resinCount + regenerated)
      setCurrentResin(calc)
      if (calc < RESIN_CAP) {
        setSecondsToNext(REGEN_RATE_SEC - (elapsedSec % REGEN_RATE_SEC))
        setSecondsToFull(Math.max(0, ((RESIN_CAP - calc) * REGEN_RATE_SEC) - (elapsedSec % REGEN_RATE_SEC)))
      } else {
        setSecondsToNext(0)
        setSecondsToFull(0)
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [resinCount, resinTimestamp])

  const isCapped = currentResin >= RESIN_CAP
  const pct = Math.min(100, (currentResin / RESIN_CAP) * 100)

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row gap-5 items-center shadow-lg">
      <div className="absolute top-0 right-0 w-64 h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse at right, var(--gold), transparent)' }} />
      <span className="absolute -right-4 -bottom-6 text-9xl opacity-5 pointer-events-none select-none">🌙</span>

      {/* Icon + Count */}
      <div className="flex items-center gap-4 relative z-10 w-full md:w-auto">
        <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-[var(--elevated)] border-2" style={{ borderColor: isCapped ? '#FFD700' : 'rgba(200,169,110,0.4)' }}>
          <span className="text-2xl" style={{ textShadow: isCapped ? '0 0 12px rgba(255,215,0,0.5)' : 'none' }}>🌙</span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold mb-0.5">Original Resin</p>
          <div className="flex items-baseline gap-1">
            <span className="font-cinzel font-bold text-3xl leading-none" style={{ color: isCapped ? '#FFD700' : 'var(--text)' }}>{currentResin}</span>
            <span className="font-cinzel font-bold text-lg text-[var(--muted)]">/ {RESIN_CAP}</span>
          </div>
        </div>
      </div>

      {/* Progress + Timers */}
      <div className="flex-1 w-full relative z-10">
        <div className="flex justify-between items-end mb-1.5">
          {isCapped
            ? <p className="text-xs text-[#FFD700] font-semibold">Fully replenished!</p>
            : <p className="text-xs text-[var(--muted)]">Next in <span className="font-mono text-[var(--gold)]">{formatTime(secondsToNext)}</span></p>
          }
          {!isCapped && <p className="text-xs text-[var(--muted)]">Full in <span className="font-mono text-[var(--text)]">{formatTime(secondsToFull)}</span></p>}
        </div>
        <div className="h-2 w-full bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)]">
          <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{ width: `${pct}%`, background: isCapped ? '#FFD700' : 'var(--gold)', boxShadow: isCapped ? '0 0 10px #FFD700' : 'none' }} />
        </div>
      </div>

      {/* Quick controls */}
      <div className="flex items-center gap-2 relative z-10 w-full md:w-auto justify-end flex-wrap">
        <button onClick={() => setResin(currentResin - 40)} disabled={currentResin < 40} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/20 hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-30 transition-colors">-40</button>
        <button onClick={() => setResin(currentResin - 20)} disabled={currentResin < 20} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(239,68,68,0.1)] text-red-400 border border-red-500/20 hover:bg-[rgba(239,68,68,0.2)] disabled:opacity-30 transition-colors">-20</button>
        <div className="w-px h-7 bg-[var(--border)]" />
        <button onClick={() => setResin(currentResin + 60)} disabled={currentResin >= RESIN_CAP} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(78,201,176,0.1)] text-[#4EC9B0] border border-[#4EC9B0]/20 hover:bg-[rgba(78,201,176,0.2)] disabled:opacity-30 transition-colors" title="Fragile Resin">+60</button>
      </div>
    </div>
  )
}

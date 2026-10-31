import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import notify from '../utils/notify'
import { acquireBodyScrollLock } from '../utils/scrollLock'

export default function CookiePromptModal({ onClose, onSaveAndSync }) {
  const connectHoyolabSession = useStore((s) => s.connectHoyolabSession)

  const [ltuid, setLtuid] = useState('')
  const [ltoken, setLtoken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Lock body scroll while modal is open, restoring previous overflow state
  useEffect(() => {
    return acquireBodyScrollLock();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ltuid || !ltoken) {
      notify.warning("Please provide both ltuid and ltoken.")
      return
    }
    
    setIsConnecting(true)
    const res = await connectHoyolabSession(ltuid, ltoken)
    setIsConnecting(false)
    
    if (res.success) {
      setLtuid('')
      setLtoken('')
      notify.success("HoYoLAB connected successfully!")
      // Trigger sync
      onSaveAndSync()
    } else {
      notify.error(`Connection failed: ${res.message || res.error}`)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-modal-title"
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl relative animate-slide-up max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col my-auto"
      >
        <button 
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-white hover:bg-[var(--elevated)] transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 pr-8 shrink-0">
          <span className="text-2xl shrink-0" aria-hidden="true">🍪</span>
          <h2 id="cookie-modal-title" className="text-lg sm:text-xl font-bold text-primary break-words">HoYoLAB Authentication</h2>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed break-words">
          Please provide your HoYoLAB cookies to sync live data. These are securely managed by the server.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="cookie-ltuid" className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltuid_v2 (or ltuid)</label>
            <input 
              id="cookie-ltuid"
              type="password" 
              autoComplete="off"
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[42px] sm:min-h-[44px]"
              value={ltuid}
              onChange={(e) => setLtuid(e.target.value)}
              placeholder="Enter ltuid"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="cookie-ltoken" className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltoken_v2 (or ltoken)</label>
            <input 
              id="cookie-ltoken"
              type="password" 
              autoComplete="off"
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary min-h-[42px] sm:min-h-[44px]"
              value={ltoken}
              onChange={(e) => setLtoken(e.target.value)}
              placeholder="Enter ltoken"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 mt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--muted)] hover:bg-[var(--elevated)] transition-colors w-full sm:w-auto min-h-[44px] flex items-center justify-center text-center"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="genshin-btn px-6 py-2.5 w-full sm:w-auto min-h-[44px] flex items-center justify-center text-center"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect & Sync'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

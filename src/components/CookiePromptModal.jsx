import React, { useState } from 'react'
import useStore from '../store/useStore'

export default function CookiePromptModal({ onClose, onSaveAndSync }) {
  const connectHoyolabSession = useStore((s) => s.connectHoyolabSession)

  const [ltuid, setLtuid] = useState('')
  const [ltoken, setLtoken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!ltuid || !ltoken) {
      alert("Please provide both ltuid and ltoken.")
      return
    }
    
    setIsConnecting(true)
    const res = await connectHoyolabSession(ltuid, ltoken)
    setIsConnecting(false)
    
    if (res.success) {
      setLtuid('')
      setLtoken('')
      // Trigger sync
      onSaveAndSync()
    } else {
      alert(`Connection failed: ${res.message || res.error}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-slide-up">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🍪</span>
          <h2 className="text-xl font-bold text-primary">HoYoLAB Authentication</h2>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Please provide your HoYoLAB cookies to sync live data. These are securely managed by the server.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltuid_v2 (or ltuid)</label>
            <input 
              type="password" 
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary"
              value={ltuid}
              onChange={(e) => setLtuid(e.target.value)}
              placeholder="Enter ltuid"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-main)] mb-1 block">ltoken_v2 (or ltoken)</label>
            <input 
              type="password" 
              className="w-full bg-[var(--elevated)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--color-text-main)] outline-none focus:border-primary"
              value={ltoken}
              onChange={(e) => setLtoken(e.target.value)}
              placeholder="Enter ltoken"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[var(--muted)] hover:bg-[var(--elevated)] transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="genshin-btn px-6 py-2"
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

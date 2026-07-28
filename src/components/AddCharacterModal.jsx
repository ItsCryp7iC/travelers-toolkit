import React, { useState, useMemo, useEffect, useRef } from 'react'
import charactersData from '../data/characters.json'
import useStore from '../store/useStore'
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getRarityClass, getStars } from '../utils/gameData'

export default function AddCharacterModal({ onClose }) {
  const roster = useStore((s) => s.roster)
  const addCharacter = useStore((s) => s.addCharacter)
  const modalRef = useRef(null)
  const [search, setSearch] = useState('')
  const [elementFilter, setElementFilter] = useState('All')

  const unrostered = useMemo(() => {
    let list = charactersData.filter((c) => !roster[c.name])
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.element?.toLowerCase().includes(q))
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    return list.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
  }, [roster, search, elementFilter])

  const allElements = ['All', ...Object.keys(ELEMENTS).filter((e) => e !== 'Unknown')]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleAdd = (char) => {
    addCharacter(char.name)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-[var(--elevated)] rounded-2xl shadow-2xl flex flex-col max-h-[88vh] border border-[var(--border)] animate-slide-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="font-cinzel font-bold text-lg text-[var(--text)]">Add Character to Roster</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-[var(--muted)] flex items-center justify-center transition-colors">✕</button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-[var(--border)] shrink-0 space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">🔍</span>
            <input
              autoFocus
              type="search"
              placeholder="Search characters…"
              className="search-input w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {allElements.map((el) => {
              const cfg = ELEMENTS[el]
              return (
                <button
                  key={el}
                  onClick={() => setElementFilter(el)}
                  className={`filter-pill text-[11px] py-1 ${elementFilter === el ? 'active' : ''}`}
                >
                  {cfg ? cfg.emoji : '🌐'} {el}
                </button>
              )
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {unrostered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">🎉</span>
              <p className="font-cinzel font-semibold text-[var(--text)]">All characters are in your roster!</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {unrostered.map((char) => {
                const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown
                const wpCfg = WEAPON_TYPES[char.weapon_type]
                return (
                  <button
                    key={char.name}
                    onClick={() => handleAdd(char)}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] hover:bg-[var(--elevated)] transition-all text-center cursor-pointer"
                  >
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center relative shadow-md"
                      style={{ background: elCfg.avatarGradient }}
                    >
                      <span className="font-cinzel text-xl" style={{ color: elCfg.color, textShadow: `0 0 12px ${elCfg.color}` }}>
                        {getInitials(char.name)}
                      </span>
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="font-cinzel text-[11px] font-semibold text-[var(--text)] truncate">{formatName(char.name)}</p>
                      <p className={`text-[10px] ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                      <div className="flex justify-center gap-1 mt-1">
                        <span className="text-[10px]">{elCfg.emoji}</span>
                        {wpCfg && <span className="text-[10px]">{wpCfg.emoji}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity font-semibold">+ Add</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { WEAPON_TYPES, formatName, getStars, getRarityClass, RARITY_COLORS, getRarityBg } from '../utils/gameData'
import GenshinImage from './GenshinImage'
import { getWeaponIcon, getWeaponTypeIcon } from '../utils/assetHelper'
import useStore from '../store/useStore'

const getAscensionMaxLevel = (asc) => {
  if (asc === 0) return 20;
  if (asc === 1) return 40;
  if (asc === 2) return 50;
  if (asc === 3) return 60;
  if (asc === 4) return 70;
  if (asc === 5) return 80;
  return 90;
}

const AscensionPanel = ({ label, asc, setAsc, level, setLevel }) => {
  const cap = getAscensionMaxLevel(asc);
  
  useEffect(() => {
    if (level > cap) setLevel(cap);
  }, [asc, cap, level, setLevel]);
  
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex-1">
      <h4 className="font-cinzel font-bold text-[var(--gold)] mb-3 text-sm">{label}</h4>
      
      <div className="mb-4">
        <p className="text-[10px] text-[var(--muted)] tracking-widest uppercase mb-2">Ascension Phase</p>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6].map(a => (
            <button
              key={a}
              onClick={() => setAsc(a)}
              className={`w-8 h-8 rounded-lg font-mono text-xs font-bold transition-all ${
                asc === a 
                  ? 'bg-[var(--gold)] text-gray-900 shadow-md transform scale-105' 
                  : 'bg-[var(--elevated)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-gray-500'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <p className="text-[10px] text-[var(--muted)] tracking-widest uppercase">Weapon Level</p>
          <span className="font-mono text-[var(--text)] text-sm font-bold">Lv. {level} / {cap}</span>
        </div>
        <input 
          type="range" 
          min={1} 
          max={cap} 
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full accent-[var(--gold)] h-1.5 bg-[var(--border)] rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-[var(--muted)] font-mono">1</span>
          <span className="text-[10px] text-[var(--muted)] font-mono">{cap}</span>
        </div>
      </div>
    </div>
  )
}

export default function WeaponInfoModal({ weapon, onClose }) {
  const modalRef = useRef(null)
  const addTrackedWeapon = useStore((s) => s.addTrackedWeapon)
  const roster = useStore((s) => s.roster)
  
  const { name, rarity, type } = weapon
  const displayName = formatName(name)
  const wpConfig = WEAPON_TYPES[type] || { emoji: '✨', label: 'Unknown' }
  const rarityClass = getRarityClass(rarity)
  const rarityColor = RARITY_COLORS[rarity] || '#C8A96E'

  // Configuration States
  const [currentAscension, setCurrentAscension] = useState(0)
  const [currentLevel, setCurrentLevel] = useState(1)
  const [targetAscension, setTargetAscension] = useState(6)
  const [targetLevel, setTargetLevel] = useState(90)
  const [assignedCharacter, setAssignedCharacter] = useState('unassigned')

  // Prevent invalid targets
  useEffect(() => {
    if (targetAscension < currentAscension) {
      setTargetAscension(currentAscension)
    }
  }, [currentAscension, targetAscension])

  useEffect(() => {
    if (targetLevel < currentLevel) {
      setTargetLevel(currentLevel)
    }
  }, [currentLevel, targetLevel])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSave = () => {
    const assignTo = assignedCharacter === 'unassigned' ? null : assignedCharacter;
    const config = {
      currentLevel,
      currentAscension,
      targetLevel,
      targetAscension
    }
    addTrackedWeapon(name, assignTo, config)
    onClose()
  }

  const rosterNames = Object.keys(roster).sort()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in"
         style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-[var(--elevated)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up border"
        style={{ borderColor: `${rarityColor}40` }}
      >
        {/* ── Header ── */}
        <header
          className="relative p-6 shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${rarityColor}40 0%, ${rarityColor}10 100%)` }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors z-20"
          >
            ✕
          </button>

          <div className="relative z-10 flex gap-5 items-center">
              <div className={`w-20 h-20 rounded-xl flex items-center justify-center border-2 shadow-lg relative overflow-hidden ${getRarityBg(rarity)}`}
                   style={{ borderColor: rarityColor, color: rarityColor, textShadow: `0 0 16px ${rarityColor}` }}>
                <GenshinImage 
                  src={getWeaponIcon(name)} 
                  alt={name} 
                  className="w-full h-full object-contain absolute inset-0 z-10 p-2" 
                  fallback={<span className="font-cinzel text-4xl relative z-10">{wpConfig.emoji}</span>} 
                />
              </div>
            <div>
              <h2 className="font-cinzel font-bold text-2xl text-[var(--text)] drop-shadow-md mb-1">{displayName}</h2>
              <div className="flex gap-2 items-center flex-wrap">
                <span className={`text-sm tracking-wide ${rarityClass} drop-shadow-md`}>{getStars(rarity)}</span>
                <span className="text-white/80 text-sm px-3 py-1 rounded-full bg-black/30 border border-white/20 flex items-center gap-1.5">
                  <GenshinImage src={getWeaponTypeIcon(type)} alt={type} className="w-6 h-6 object-contain" fallback={<span>{wpConfig.emoji}</span>} />
                  <span>{type || 'Unknown'}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
               style={{ background: `radial-gradient(circle at 80% 50%, ${rarityColor}, transparent 60%)` }} />
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Progression Panels */}
          <div className="flex flex-col sm:flex-row gap-4">
            <AscensionPanel 
              label="WEAPON CURRENT" 
              asc={currentAscension} 
              setAsc={setCurrentAscension} 
              level={currentLevel} 
              setLevel={setCurrentLevel} 
            />
            <AscensionPanel 
              label="WEAPON TARGET" 
              asc={targetAscension} 
              setAsc={setTargetAscension} 
              level={targetLevel} 
              setLevel={setTargetLevel} 
            />
          </div>

          {/* Character Assignment Dropdown */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <label className="block text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
              Assign to Character (Optional)
            </label>
            <div className="relative">
              <select
                value={assignedCharacter}
                onChange={(e) => setAssignedCharacter(e.target.value)}
                className="w-full bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-sm rounded-lg px-4 py-3 outline-none focus:border-[var(--gold)] transition-colors appearance-none cursor-pointer"
              >
                <option value="unassigned">-- Unassigned --</option>
                {rosterNames.map(char => (
                  <option key={char} value={char}>{formatName(char)}</option>
                ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">▼</span>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="p-4 sm:p-6 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-semibold text-[var(--text)] bg-[var(--elevated)] border border-[var(--border)] hover:bg-[var(--border)] transition-colors text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] py-3 rounded-xl font-cinzel font-bold text-[var(--bg)] bg-[var(--gold)] hover:brightness-110 active:brightness-90 transition-all shadow-md text-sm sm:text-lg"
          >
            Add to Armory
          </button>
        </div>
      </div>
    </div>
  )
}

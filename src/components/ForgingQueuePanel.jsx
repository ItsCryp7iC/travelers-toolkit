import React, { useMemo } from 'react'
import weaponsData from '../data/weapons.json'
import forgingData from '../data/weapon_forging.json'
import useStore from '../store/useStore'
import { getForgingCosts } from '../utils/aggregator'
import { getWeaponIcon, getMaterialIcon, toPascalCase } from '../utils/assetHelper'
import { formatNumber } from '../utils/calculator'
import GenshinImage from './GenshinImage'

const RARITY_COLORS = {
  5: '#D87A34',
  4: '#9370DB',
  3: '#4A9EFF',
  2: '#6B8E23',
  1: '#808080'
}

function getRarityNum(weapon) {
  const r = weapon?.rarity || ''
  if (typeof r === 'string') return (r.match(/★/g) || []).length
  return Number(r) || 0
}

function getRarityGradient(rarity) {
  switch (rarity) {
    case 5: return 'from-amber-500/10'
    case 4: return 'from-purple-500/10'
    case 3: return 'from-blue-500/10'
    default: return 'from-white/5'
  }
}

// ─── Queue Entry Row (Read-only) ──────────────────────────────────────────────
function QueueEntry({ entry }) {
  const weapon = weaponsData.find(w => w.id === entry.weapon_id || w.name === entry.weaponName)
  const rarity = getRarityNum(weapon)
  const quantity = entry.targetRefinement - entry.currentRefinement;

  return (
    <div className={`bg-gradient-to-br ${getRarityGradient(rarity)} to-transparent border border-[var(--border)] rounded-xl p-3 flex items-center gap-3 hover:border-[var(--gold)]/40 transition-colors group`}>
      {/* Weapon icon */}
      <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
        <GenshinImage
          src={weapon ? getWeaponIcon(weapon.name) : ''}
          alt={entry.weaponName}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full bg-[var(--elevated)] flex items-center justify-center text-[var(--gold)] text-sm font-bold">
              {entry.weaponName?.[0] ?? '?'}
            </div>
          }
        />
      </div>

      {/* Name + Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)] truncate">{entry.weaponName}</p>
        <p className="text-xs text-[var(--muted)] truncate mt-0.5">
          {entry.assignedTo ? `For ${entry.assignedTo}` : <span className="italic opacity-50">Unassigned</span>}
        </p>
        {weapon && (
          <p className="text-xs text-[var(--gold)] opacity-60 mt-0.5">{weapon.type} · {weapon.rarity}</p>
        )}
      </div>

      {/* Target quantity */}
      <div className="flex flex-col items-center flex-shrink-0 pr-2">
        <span className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">To Forge</span>
        <span className="text-sm font-bold text-[var(--text)] bg-[var(--elevated)] border border-[var(--border)] px-3 py-1 rounded-md">{quantity}</span>
      </div>
      
      {/* Refinement delta display */}
      <div className="flex flex-col items-end flex-shrink-0 pl-2 border-l border-[var(--border)]/50">
        <span className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Refinement</span>
        <div className="flex items-center text-xs font-bold gap-1">
          <span className="text-blue-300">R{entry.currentRefinement}</span>
          <span className="text-[var(--muted)]">→</span>
          <span className="text-[var(--gold)]">R{entry.targetRefinement}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Materials Summary ────────────────────────────────────────────────────────
function MaterialsSummary({ forgingQueue }) {
  const costs = useMemo(() => getForgingCosts(forgingQueue, forgingData), [forgingQueue])

  if (!forgingQueue.length) return null

  const { totalCosts, categories } = costs
  const entries = Object.entries(totalCosts).filter(([, qty]) => qty > 0)

  if (!entries.length) return null

  // Separate into groups
  const billets = entries.filter(([id]) => categories[id] === 'billet')
  const ores = entries.filter(([id]) => categories[id] === 'forgingOre')
  const moraEntry = entries.find(([id]) => id === 'mora')

  // Get display name from forgingData
  const getMaterialName = (id) => {
    for (const recipe of Object.values(forgingData)) {
      if (recipe.billet?.id === id) return recipe.billet.name
      for (const ore of recipe.ores ?? []) {
        if (ore.id === id) return ore.name
      }
    }
    return id
  }

  const MatChip = ({ id, qty, iconFn, cat }) => {
    const name = getMaterialName(id)
    const iconSrc = iconFn(id, cat)
    return (
      <div className="flex flex-col items-center gap-1 p-2 bg-[var(--elevated)] border border-[var(--border)] rounded-xl min-w-[64px]">
        <div className="relative w-9 h-9">
          <GenshinImage
            src={iconSrc}
            alt={name}
            className="w-9 h-9 object-contain"
            fallback={
              <div className="w-9 h-9 bg-[var(--surface)] rounded-lg flex items-center justify-center text-[var(--gold)] text-xs font-bold border border-[var(--border)]">
                {name?.[0] ?? '?'}
              </div>
            }
          />
          <span className="absolute -bottom-1 -right-1 bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-[9px] font-bold px-1 rounded-full leading-tight">
            ×{qty}
          </span>
        </div>
        <span className="text-[10px] text-[var(--muted)] text-center leading-tight max-w-[64px] line-clamp-2">{name}</span>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mt-6">
      <h3 className="text-sm font-bold text-[var(--text)] mb-4 tracking-wide uppercase flex items-center gap-2">
        <span>📦</span> Total Materials Needed
      </h3>

      {moraEntry && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--elevated)] border border-[var(--gold)]/20 rounded-xl">
          <GenshinImage
            src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/others/Mora.png`}
            alt="Mora"
            className="w-6 h-6 object-contain"
            fallback={<span className="text-lg">🌙</span>}
          />
          <span className="text-sm text-[var(--gold)] font-bold">{formatNumber(moraEntry[1])} Mora</span>
        </div>
      )}

      {billets.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-2">Billets</p>
          <div className="flex flex-wrap gap-2">
            {billets.map(([id, qty]) => (
              <MatChip key={id} id={id} qty={qty} iconFn={getMaterialIcon} cat="billet" />
            ))}
          </div>
        </div>
      )}

      {ores.length > 0 && (
        <div>
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-2">Ores</p>
          <div className="flex flex-wrap gap-2">
            {ores.map(([id, qty]) => (
              <MatChip key={id} id={id} qty={qty} iconFn={getMaterialIcon} cat="forgingOre" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function forgingQueuePanel() {
  const trackedWeapons = useStore(s => s.trackedWeapons)
  
  const forgingQueue = useMemo(() => {
    return trackedWeapons.filter(w => (w.targetRefinement ?? 1) > (w.currentRefinement ?? 1))
  }, [trackedWeapons])

  return (
    <div className="animate-fade-in">
      {/* Queue list */}
      {forgingQueue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">⚒️</span>
          <h3 className="font-semibold text-[var(--text)] text-lg mb-2">No weapons queued for forging</h3>
          <p className="text-[var(--muted)] text-sm max-w-xs">
            In your Armory, increase the Target Refinement of a forgeable weapon above its Current Refinement to track its forging costs here.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[var(--text)] tracking-wide uppercase flex items-center gap-2">
                <span className="text-[var(--gold)]">📋</span> Forge Queue (From Armory)
                <span className="ml-1 text-xs bg-[var(--elevated)] border border-[var(--border)] text-[var(--muted)] px-2 py-0.5 rounded-full">
                  {forgingQueue.length} weapon{forgingQueue.length !== 1 ? 's' : ''}
                </span>
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {forgingQueue.map(entry => (
                <QueueEntry
                  key={entry.id}
                  entry={entry}
                />
              ))}
            </div>
          </div>

          {/* Materials summary */}
          <MaterialsSummary forgingQueue={forgingQueue} />
        </>
      )}
    </div>
  )
}

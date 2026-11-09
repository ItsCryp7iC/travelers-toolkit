import React, { useState } from 'react'
import { getCharacterAvatar, getWeaponIcon, getMaterialIcon, toPascalCase } from '../utils/assetHelper'
import { formatItemName } from '../utils/calculator'
import { formatPlannerQuantity } from '../utils/plannerTabs'
import { getFamilyForMaterial } from '../data/craftingRecipes'

const RARITY_COLORS = {
  5: '#D87A34',
  4: '#9370DB',
  3: '#4A9EFF',
  2: '#6B8E23',
  1: '#808080'
}

export default function DomainCard({
  domainName,
  familyObj,
  accent,
  globalCosts,
  inventory,
  itemFolder = "weapon_ascension_materials",
  craftingMode = 'crafting-aware',
  craftingPlan = null
}) {
  const [expandedCrafting, setExpandedCrafting] = useState(false);
  const { familyName, familyData, items, neededBy } = familyObj;

  const chars = neededBy?.filter(e => e.type === 'character') || [];
  const weaps = neededBy?.filter(e => e.type === 'weapon') || [];

  if (!familyData || !familyData.tiers) return null;

  // Resolve family plan for craftable families
  const familyKeyCandidate = familyData?.familyId || familyObj.familyId || familyObj.familyKey;
  let resolvedFamilyId = familyKeyCandidate;
  if (!resolvedFamilyId && familyData.tiers?.[0]?.id) {
    const fam = getFamilyForMaterial(familyData.tiers[0].id);
    if (fam) resolvedFamilyId = fam.familyId;
  }
  const familyPlan = craftingPlan?.families?.[resolvedFamilyId] || familyObj.craftingPlan || null;

  // Compute family-level crafting status pill
  let familyStatusPill = null;
  if (craftingMode === 'crafting-aware' && familyPlan && familyPlan.isCraftable) {
    if (familyPlan.allDirectlyStocked) {
      familyStatusPill = {
        label: 'Already stocked',
        bg: 'rgba(74, 222, 128, 0.15)',
        text: '#4ADE80',
        border: 'rgba(74, 222, 128, 0.3)',
        icon: '✅'
      };
    } else if (familyPlan.requiresCrafting && familyPlan.allCoveredByCrafting) {
      familyStatusPill = {
        label: 'Crafting required — No additional farming',
        bg: 'rgba(78, 201, 176, 0.15)',
        text: '#4EC9B0',
        border: 'rgba(78, 201, 176, 0.3)',
        icon: '🔨'
      };
    } else if (familyPlan.requiresCrafting && !familyPlan.allCoveredByCrafting) {
      familyStatusPill = {
        label: 'Farming required',
        bg: 'rgba(249, 115, 22, 0.15)',
        text: '#F97316',
        border: 'rgba(249, 115, 22, 0.3)',
        icon: '🌾'
      };
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors overflow-hidden relative group">
      {/* Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ background: accent }} />

      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">{familyObj.type === 'weekly_boss' ? '👑' : familyObj.type === 'world_boss' ? '🐉' : familyObj.type === 'elite_mob' ? '🛡️' : familyObj.type === 'gemstones' ? '💎' : '🏛️'}</span>
          <span className="text-xs font-bold tracking-wider uppercase text-[var(--muted)] truncate">
            {['weekly_boss', 'world_boss', 'elite_mob', 'gemstones', 'currency'].includes(familyObj.type) ? domainName : `Domain: ${domainName}`}
          </span>
        </div>
        {familyStatusPill && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 border"
            style={{
              background: familyStatusPill.bg,
              color: familyStatusPill.text,
              borderColor: familyStatusPill.border,
            }}
          >
            <span>{familyStatusPill.icon}</span>
            <span className="hidden sm:inline">{familyStatusPill.label}</span>
          </span>
        )}
      </div>

      {/* Body: Tier List */}
      <div className="p-3 space-y-3 flex-1">
        {familyData.tiers.map(tier => {
          const itemObj = items[tier.id]?.item;
          let required = globalCosts[tier.id] ?? 0;
          if (itemObj) {
            required = itemObj.required ?? globalCosts[tier.id] ?? 0;
          }
          const owned = inventory[tier.id] ?? 0;
          const directShortage = Math.max(0, required - owned);
          const adjustedShortage = itemObj?.craftingAdjustedToFarm ?? (familyPlan?.adjustedShortages?.[tier.id] ?? directShortage);
          const toFarm = craftingMode === 'raw' ? directShortage : (itemObj?.toFarm ?? adjustedShortage);

          let craftQuantity = 0;
          if (craftingMode === 'crafting-aware') {
            if (itemObj && typeof itemObj.craftQuantity === 'number') {
              craftQuantity = itemObj.craftQuantity;
            } else if (familyPlan?.steps) {
              const step = familyPlan.steps.find((s) => s.outputItemId === tier.id);
              if (step) craftQuantity = step.totalOutputProduced;
            }
          }

          if (required === 0 && owned === 0 && familyObj.type !== 'currency') return null;

          const isFullyCovered = craftingMode === 'crafting-aware'
            ? toFarm === 0
            : (required > 0 && owned >= required);
          const percent = required > 0
            ? (isFullyCovered ? 100 : Math.min(100, (owned / required) * 100))
            : (owned > 0 ? 100 : 0);
          const rarityColor = RARITY_COLORS[tier.rarity] || RARITY_COLORS[3];

          return (
            <div key={tier.id} className="flex flex-col gap-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rarityColor }} />
                  <img
                    src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${itemFolder}/${toPascalCase(tier.name)}.png`}
                    alt={tier.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-md shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                  />
                  <span className="hidden text-xl shrink-0">📦</span>
                  <span className="text-xs sm:text-sm text-[var(--text)] truncate font-semibold" style={{ color: rarityColor }} title={formatItemName(tier.name)}>
                    {formatItemName(tier.name)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs shrink-0 self-end sm:self-auto pl-7 sm:pl-0 flex-wrap">
                  <span className="text-[var(--muted)]" title={`Need: ${(required || 0).toLocaleString()}`}>
                    Need: <span className="font-bold text-[var(--text)]">{formatPlannerQuantity(required)}</span>
                  </span>
                  <span className="text-[var(--muted)]" title={`Have: ${(owned || 0).toLocaleString()}`}>
                    Have: <span className="text-[var(--text)] font-bold">{formatPlannerQuantity(owned)}</span>
                  </span>
                  {craftingMode === 'crafting-aware' && craftQuantity > 0 && (
                    <span className="text-amber-400 font-semibold" title={`Recommended craft: ${craftQuantity.toLocaleString()}`}>
                      Craft: <span className="font-bold text-amber-300">+{formatPlannerQuantity(craftQuantity)}</span>
                    </span>
                  )}
                  <span className="text-[var(--muted)]" title={`To Farm: ${(toFarm || 0).toLocaleString()}`}>
                    To Farm: <span className="font-bold" style={{ color: toFarm > 0 ? accent : 'var(--muted)' }}>{formatPlannerQuantity(toFarm)}</span>
                  </span>
                </div>
              </div>
              <div className="h-1 bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)] relative">
                <div className="absolute top-0 left-0 h-full rounded-full transition-all" style={{ width: `${percent}%`, background: isFullyCovered ? '#4ADE80' : rarityColor }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Expandable Per-Family Crafting Instructions */}
      {craftingMode === 'crafting-aware' && familyPlan && familyPlan.steps && familyPlan.steps.length > 0 && (
        <div className="px-3 pb-3 border-t border-[var(--border)] pt-2.5 bg-black/10">
          <button
            type="button"
            onClick={() => setExpandedCrafting((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer py-1"
            aria-expanded={expandedCrafting}
          >
            <span className="flex items-center gap-1.5">
              <span>🔨</span>
              <span>Crafting Instructions ({familyPlan.steps.length} step{familyPlan.steps.length !== 1 ? 's' : ''})</span>
            </span>
            <span className="text-[11px] text-[var(--muted)] flex items-center gap-1">
              <span>Fee: {(familyPlan.craftingMora || 0).toLocaleString()} Mora</span>
              <span>{expandedCrafting ? '▲' : '▼'}</span>
            </span>
          </button>

          {expandedCrafting && (
            <div className="mt-2 space-y-2 text-xs bg-black/25 p-2.5 rounded-lg border border-white/5">
              {familyPlan.steps.map((step, idx) => (
                <div key={step.recipeId} className="flex flex-col gap-0.5 border-b border-white/5 last:border-b-0 pb-1.5 last:pb-0">
                  <div className="flex items-center justify-between font-medium text-gray-200">
                    <span>
                      {idx + 1}. Craft <b className="text-emerald-400">{step.totalOutputProduced.toLocaleString()}</b> {formatItemName(step.outputItemName)}
                    </span>
                    <span className="text-amber-300 text-[11px]">{(step.totalMoraCost || 0).toLocaleString()} Mora</span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">
                    Use {step.totalInputConsumed.toLocaleString()} {formatItemName(step.inputItemName)}
                  </p>
                </div>
              ))}

              <div className="pt-1.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--muted)]">
                <span>Total Fee: <b className="text-amber-300">{(familyPlan.craftingMora || 0).toLocaleString()} Mora</b></span>
                {(() => {
                  const leftovers = Object.entries(familyPlan.projectedInventory || {})
                    .filter(([_, qty]) => qty > 0)
                    .map(([id, qty]) => `${qty.toLocaleString()} ${formatItemName(familyData.tiers.find((t) => t.id === id)?.name || id)}`);
                  if (leftovers.length === 0) return null;
                  return (
                    <span className="text-teal-300">
                      Projected leftover: {leftovers.join(', ')}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer (Needed By) */}
      {(chars.length > 0 || weaps.length > 0) && (
        <div className="px-3 pb-3 mt-auto">
          <div className="h-px w-full bg-[var(--border)] mb-2 opacity-50" />
          <p className="text-xs font-semibold tracking-widest text-[var(--muted)] uppercase mb-1.5">Needed By</p>
          <div>
            {chars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chars.map((entity, i) => (
                  <div key={`char-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/characters/${toPascalCase(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs z-0" title={entity.name}>👤</div>
                  </div>
                ))}
              </div>
            )}

            {weaps.length > 0 && (
              <div className={`flex flex-wrap gap-1 ${chars.length > 0 ? 'mt-2' : ''}`}>
                {weaps.map((entity, i) => (
                  <div key={`weap-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/weapons/${toPascalCase(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs z-0" title={entity.name}>👤</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

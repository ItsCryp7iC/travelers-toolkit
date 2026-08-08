import React from 'react'
import { formatName } from '../utils/gameData'
import { formatNumber, formatItemName } from '../utils/calculator'

export default function CharacterPlanCard({ entryObj, inventory, categories = {} }) {
  const { name, entry, totalCosts, talentState, character } = entryObj;
  
  const getSafeImgId = (id) => {
    if (!id) return '';
    const minorWords = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'on', 'for', 'to', 'with']);
    return String(id)
      .replace(/[\u2014\u2013-]/g, ' ')
      .replace(/[^a-zA-Z0-9_ ]/g, '')
      .split(/[\s_]+/)
      .filter(word => word.length > 0)
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && minorWords.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  };

  const displayName = formatName(name);
  const avatarUrl = `https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/characters/${getSafeImgId(name)}.png`;

  const getFolder = (category) => {
    switch (category) {
      case 'talentBooks': return 'talent_materials';
      case 'weeklyBoss': return 'weekly_boss_materials';
      case 'weaponAscMats': return 'weapon_ascension_materials';
      case 'gemstones': return 'character_ascension_gems';
      case 'worldBoss': return 'normal_boss_materials';
      case 'localSpecialty': return 'local_specialties';
      case 'eliteMob': return 'elite_enhancement_materials';
      case 'mob': return 'common_enhancement_materials';
      case 'mora':
      case 'crown':
      case 'stellaFortuna': return 'others';
      case 'heroWits':
      case 'mysticOre': return 'experience';
      default: return 'others';
    }
  };

  return (
    <div className="bg-[#1a1c23] border border-white/5 rounded-xl p-4 flex flex-col gap-4 hover:border-amber-500/50 transition-colors relative overflow-hidden group">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--gold)] bg-[var(--surface)] flex-shrink-0 relative">
          <img 
            src={avatarUrl} 
            alt={displayName}
            className="w-full h-full object-cover relative z-10"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          <div className="absolute inset-0 hidden items-center justify-center text-sm z-0 font-bold text-[var(--gold)]">
            {displayName[0]}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--text)] text-sm truncate">{displayName}</h3>
          <p className="text-[10px] text-[var(--gold)] font-cinzel tracking-wider">Mora: {formatNumber(totalCosts?.mora || 0)}</p>
        </div>
        {character?.element && (
          <img 
            src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/elements/${getSafeImgId(character.element)}.png`} 
            alt={character.element} 
            className="w-8 h-8 object-contain opacity-80 ml-auto" 
          />
        )}
      </div>

      {/* State Block */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
          <p className="text-[10px] text-[var(--muted)] mb-0.5 uppercase tracking-wider">Level</p>
          <p className="font-semibold text-gray-200">
            Lv. {entry.level ?? 1} 
            <span className="text-[var(--gold)] mx-1">→</span> 
            {entry.targetLevel ?? 90}
          </p>
        </div>
        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
          <p className="text-[10px] text-[var(--muted)] mb-0.5 uppercase tracking-wider">Talents</p>
          {talentState ? (
            <p className="font-semibold text-gray-200 text-[10px]">
              {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}
              <span className="text-[var(--gold)] mx-1">→</span>
              {talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
            </p>
          ) : (
            <p className="text-gray-500 text-[10px]">Maxed</p>
          )}
        </div>
      </div>

      {/* Materials Block */}
      <div className="mt-auto border-t border-white/5 pt-3">
        <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-2 font-semibold">Required Materials</p>
        {Object.keys(totalCosts || {}).length === 0 ? (
          <p className="text-xs text-gray-500 italic">No materials needed.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(totalCosts)
              .filter(([matId, qty]) => qty > 0 && matId !== 'mora')
              .map(([matId, qty]) => {
                const owned = inventory[matId] || 0;
                const toFarm = Math.max(0, qty - owned);
                
                return (
                  <div key={matId} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-black/30 border border-white/5 relative group/mat hover:border-amber-500/30 transition-colors">
                    <img 
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${getFolder(categories[matId])}/${getSafeImgId(matId)}.png`} 
                      alt={formatItemName(matId)} 
                      className="w-8 h-8 object-contain mb-1 drop-shadow-md"
                      title={`${formatItemName(matId)}\nNeeded: ${toFarm} (Total: ${qty})`}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                    />
                    <span className="hidden text-xl mb-1" title={formatItemName(matId)}>📦</span>
                    
                    <span className={`text-[9px] font-bold ${toFarm === 0 ? 'text-green-400' : 'text-gray-300'}`}>
                      {toFarm === 0 ? '✅' : `×${formatNumber(toFarm)}`}
                    </span>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  )
}

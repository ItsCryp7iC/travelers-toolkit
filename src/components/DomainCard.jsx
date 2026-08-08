import React from 'react'
import { getCharacterAvatar, getWeaponIcon, getMaterialIcon } from '../utils/assetHelper'
import { formatItemName } from '../utils/calculator'

const RARITY_COLORS = {
  5: '#D87A34',
  4: '#9370DB',
  3: '#4682B4',
  2: '#6B8E23',
  1: '#808080'
}

export default function DomainCard({ domainName, familyObj, accent, globalCosts, inventory, itemFolder = "weapon_ascension_materials" }) {
  const { familyName, familyData, items, neededBy } = familyObj;

  const getSafeImgId = (id) => {
    if (!id) return '';
    
    // 1. Decode URI to catch %E2%80%94 (em-dash), then strip apostrophes and replace dashes with spaces
    let strId = decodeURIComponent(id.toString());
    strId = strId.replace(/['’]/g, '').replace(/[-—]/g, ' ');
  
    // 2. Intercept Talent Books (continuous strings)
    const talentMatch = strId.match(/^(philosophiesof|guideto|teachingsof)(.+)$/i);
    if (talentMatch) {
      const prefix = talentMatch[1].toLowerCase();
      const suffix = talentMatch[2];
      
      let formattedPrefix = '';
      if (prefix === 'philosophiesof') formattedPrefix = 'Philosophiesof';
      else if (prefix === 'guideto') formattedPrefix = 'Guideto';
      else if (prefix === 'teachingsof') formattedPrefix = 'Teachingsof';
      
      const formattedSuffix = suffix.charAt(0).toUpperCase() + suffix.slice(1);
      return `${formattedPrefix}${formattedSuffix}`;
    }
  
    // 3. True Title Case (spaces removed)
    const lowercaseExceptions = ['of', 'the', 'a', 'an', 'to', 'and', 'in', 'on', 'for', 'from'];
    return strId
      .split(/[\s_]+/) 
      .map((word, index) => {
        if (!word) return '';
        const lowerWord = word.toLowerCase();
        // Keep articles/prepositions lowercase unless they are the first word
        if (index > 0 && lowercaseExceptions.includes(lowerWord)) {
          return lowerWord;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join('');
  };

  const chars = neededBy?.filter(e => e.type === 'character') || [];
  const weaps = neededBy?.filter(e => e.type === 'weapon') || [];

  if (!familyData || !familyData.tiers) return null;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors overflow-hidden relative group">
      {/* Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ background: accent }} />
      
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <span className="text-xs">{familyObj.type === 'weekly_boss' ? '👑' : familyObj.type === 'world_boss' ? '🐉' : familyObj.type === 'elite_mob' ? '🛡️' : familyObj.type === 'gemstones' ? '💎' : '🏛️'}</span>
        <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--muted)] truncate">
          {['weekly_boss', 'world_boss', 'elite_mob', 'gemstones', 'currency'].includes(familyObj.type) ? domainName : `Domain: ${domainName}`}
        </span>
      </div>

      {/* Body: Tier List */}
      <div className="p-3 space-y-3 flex-1">
        {familyData.tiers.map(tier => {
          let required = globalCosts[tier.id] || 0;
          if (items[tier.id]) {
             required = items[tier.id].item.required || items[tier.id].item.toFarm || globalCosts[tier.id];
          }
          const owned = inventory[tier.id] || 0;
          
          if (required === 0 && owned === 0 && familyObj.type !== 'currency') return null;

          const percent = required > 0 ? Math.min(100, (owned / required) * 100) : (owned > 0 ? 100 : 0);
          const rarityColor = RARITY_COLORS[tier.rarity] || RARITY_COLORS[3];

          return (
            <div key={tier.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rarityColor }} />
                  <img 
                    src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${itemFolder}/${getSafeImgId(tier.name)}.png`}
                    alt={tier.name} 
                    className="w-8 h-8 object-contain drop-shadow-md" 
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} 
                  />
                  <span className="hidden text-xl">📦</span>
                  <span className="text-sm text-[var(--text)] truncate font-semibold" style={{ color: rarityColor }}>
                    {formatItemName(tier.name)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                  <span className="text-[var(--muted)]">Have: <span className="text-[var(--text)] font-cinzel font-bold">{owned}</span></span>
                  <span className="text-[var(--muted)]">Need: <span className="font-cinzel font-bold" style={{ color: accent }}>{required}</span></span>
                </div>
              </div>
              <div className="h-1 bg-[var(--elevated)] rounded-full overflow-hidden border border-[var(--border)] relative">
                <div className="absolute top-0 left-0 h-full rounded-full transition-all" style={{ width: `${percent}%`, background: required > 0 && owned >= required ? '#4ADE80' : rarityColor }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer (Needed By) */}
      {(chars.length > 0 || weaps.length > 0) && (
        <div className="px-3 pb-3 mt-auto">
          <div className="h-px w-full bg-[var(--border)] mb-2 opacity-50" />
          <p className="text-[9px] font-semibold tracking-widest text-[var(--muted)] uppercase mb-1.5">Needed By</p>
          <div>
            {chars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chars.map((entity, i) => (
                  <div key={`char-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img 
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/characters/${getSafeImgId(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] z-0" title={entity.name}>👤</div>
                  </div>
                ))}
              </div>
            )}
            
            {weaps.length > 0 && (
              <div className={`flex flex-wrap gap-1 ${chars.length > 0 ? 'mt-2' : ''}`}>
                {weaps.map((entity, i) => (
                  <div key={`weap-${i}`} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                    <img 
                      src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/weapons/${getSafeImgId(entity.name)}.png`}
                      alt={entity.name}
                      title={entity.name}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] z-0" title={entity.name}>👤</div>
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

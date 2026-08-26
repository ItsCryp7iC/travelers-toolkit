import React from 'react'
import { formatName } from '../utils/gameData'
import { toPascalCase } from '../utils/assetHelper'
import { formatNumber, formatItemName } from '../utils/calculator'
import characterGemsData from '../data/character_gems.json'
import normalBossData from '../data/normal_boss.json'
import localSpecialtyData from '../data/local_specialty.json'
import commonEnemyData from '../data/common_enemy.json'
import talentMatsData from '../data/talent_materials.json'
import weeklyBossData from '../data/weekly_boss.json'
import eliteEnemyData from '../data/elite_enemy.json'
import weaponAscData from '../data/weapon_ascension.json'

export default function CharacterPlanCard({ entryObj, inventory, categories = {} }) {
 const { name, entry, totalCosts, talentState, character } = entryObj;
 


 const displayName = formatName(name);
 const avatarUrl = `https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/characters/${toPascalCase(name)}.png`;

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

 const getItemName = (itemId) => {
 if (!itemId) return '';
 
 const allItems = [
 ...localSpecialtyData,
 ...normalBossData,
 ...weeklyBossData
 ];
 
 const allTierFamilies = [
 ...characterGemsData,
 ...commonEnemyData,
 ...talentMatsData,
 ...eliteEnemyData,
 ...weaponAscData
 ];
 
 const flatFound = allItems.find(item => item.id === itemId);
 if (flatFound) return flatFound.name;
 
 for (const family of allTierFamilies) {
 if (family.tiers) {
 const tierFound = Object.values(family.tiers).find(t => t.id === itemId);
 if (tierFound) return tierFound.name;
 }
 }
 
 return itemId;
 };

 const getElementGradient = (element) => {
 switch (element?.toLowerCase()) {
 case 'pyro': return 'from-red-500/10';
 case 'hydro': return 'from-blue-500/10';
 case 'anemo': return 'from-teal-400/10';
 case 'electro': return 'from-purple-500/10';
 case 'dendro': return 'from-green-500/10';
 case 'cryo': return 'from-cyan-400/10';
 case 'geo': return 'from-yellow-500/10';
 default: return 'from-white/5';
 }
 };

  const getSortWeight = (matId, category) => {
    const catWeight = {
      'experience': 1,
      'heroWits': 1,
      'localSpecialty': 2,
      'gemstones': 3,
      'worldBoss': 4,
      'mob': 5,
      'talentBooks': 6,
      'weeklyBoss': 7,
      'crown': 8,
    }[category] || 99;

    let tierWeight = 0;
    if (category === 'gemstones') {
      if (matId.includes('sliver')) tierWeight = 1;
      else if (matId.includes('fragment')) tierWeight = 2;
      else if (matId.includes('chunk')) tierWeight = 3;
      else if (matId.includes('gemstone')) tierWeight = 4;
    } else if (matId.includes('1_star')) {
      tierWeight = 1;
    } else if (matId.includes('2_star')) {
      tierWeight = 2;
    } else if (matId.includes('3_star')) {
      tierWeight = 3;
    } else if (matId.includes('4_star')) {
      tierWeight = 4;
    } else if (matId.includes('5_star')) {
      tierWeight = 5;
    } else if (category === 'talentBooks') {
      // Fallback for custom traveler book keys like Freedom_2_star_talent_material
      const match = matId.match(/(\d)_star/);
      if (match) tierWeight = parseInt(match[1]);
    }

    // Combine category weight (major) and tier weight (minor)
    return catWeight * 100 + tierWeight;
  };

 return (
 <div className={`bg-gradient-to-br ${getElementGradient(character?.element)} to-bg-base border border-white/5 rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-colors hover:border-white/10 group`}>
 {/* Header */}
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[var(--gold)] bg-[var(--surface)] flex-shrink-0 relative">
 <img 
 src={avatarUrl} 
 alt={displayName}
 className="w-full h-full object-cover relative z-10"
 onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
 />
 <div className="absolute inset-0 hidden items-center justify-center text-sm z-0 text-[var(--gold)]">
 {displayName[0]}
 </div>
 </div>
 <div className="min-w-0 flex-1">
 <h3 className=" text-[var(--text)] text-sm truncate">{displayName}</h3>
 <p className="text-xs text-[var(--gold)] tracking-wider">Mora: {formatNumber(totalCosts?.mora || 0)}</p>
 </div>
 {character?.element && (
 <img 
 src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/elements/${toPascalCase(character.element)}.png`} 
 alt={character.element} 
 className="w-8 h-8 object-contain opacity-80 ml-auto" 
 />
 )}
 </div>

 {/* State Block */}
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div className="bg-black/20 p-2 rounded-lg border border-white/5">
 <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Level</p>
 <p className=" text-gray-200">
 Lv. {entry.level ?? 1} 
 <span className="text-[var(--gold)] mx-1">→</span> 
 {entry.targetLevel ?? 90}
 </p>
 </div>
 <div className="bg-black/20 p-2 rounded-lg border border-white/5">
 <p className="text-xs text-[var(--muted)] mb-0.5 uppercase tracking-wider">Talents</p>
 {talentState ? (
 <p className=" text-gray-200 text-xs">
 {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}
 <span className="text-[var(--gold)] mx-1">→</span>
 {talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
 </p>
 ) : (
 <p className="text-gray-500 text-xs">Maxed</p>
 )}
 </div>
 </div>

 {/* Materials Block */}
 <div className="mt-auto border-t border-white/5 pt-3">
 <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 ">Required Materials</p>
 {Object.keys(totalCosts || {}).length === 0 ? (
 <p className="text-xs text-gray-500 italic">No materials needed.</p>
 ) : (
 <div className="grid grid-cols-4 gap-2">
 {Object.entries(totalCosts)
 .filter(([matId, qty]) => qty > 0 && matId !== 'mora')
 .sort(([idA], [idB]) => {
    const weightA = getSortWeight(idA, categories[idA]);
    const weightB = getSortWeight(idB, categories[idB]);
    if (weightA === weightB) return idA.localeCompare(idB);
    return weightA - weightB;
  })
 .map(([matId, qty]) => {
 const owned = inventory[matId] || 0;
 const toFarm = Math.max(0, qty - owned);
 
 return (
 <div key={matId} className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-black/30 border border-white/5 relative group/mat hover:border-primary/30 transition-colors">
 <img 
 src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${getFolder(categories[matId])}/${toPascalCase(getItemName(matId))}.png`} 
 alt={formatItemName(matId)} 
 className="w-8 h-8 object-contain mb-1 drop-shadow-md"
 title={`${formatItemName(matId)}\nNeeded: ${toFarm} (Total: ${qty})`}
 onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
 />
 <span className="hidden text-xl mb-1" title={formatItemName(matId)}>📦</span>
 
 <span className={`text-xs ${toFarm === 0 ? 'text-green-400' : 'text-gray-300'}`}>
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

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
import weaponsData from '../data/weapons.json'

export default function WeaponPlanCard({ entryObj, inventory, categories = {} }) {
 const { name, entry, totalCosts } = entryObj;
 const weapon = weaponsData.find(w => w.name === name) || {};
 


 const displayName = formatName(name);
 const avatarUrl = `https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/weapons/${toPascalCase(name)}.png`;

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

 const getSafeRarity = (weapon) => {
 if (!weapon) return 0;
 
 const rawRarity = weapon.rarity || weapon.stars || weapon.star;
 
 // If the rarity is a string containing star symbols, count them
 if (typeof rawRarity === 'string' && rawRarity.includes('★')) {
 return (rawRarity.match(/★/g) || []).length;
 }

 // Fallback for standard numeric strings (e.g., "5", "5-star")
 const parsedRarity = parseInt(String(rawRarity).replace(/\D/g, ''), 10);
 return isNaN(parsedRarity) ? 0 : parsedRarity;
 };

 const getRarityGradient = (rarity) => {
 switch (Number(rarity)) {
 case 5: return 'from-amber-500/10'; // Gold
 case 4: return 'from-purple-500/10'; // Purple
 case 3: return 'from-blue-500/10'; // Blue
 case 2: return 'from-green-500/10'; // Green
 case 1: return 'from-gray-500/10'; // Gray
 default: return 'from-white/5';
 }
 };

 return (
 <div className={`bg-gradient-to-br ${getRarityGradient(getSafeRarity(weapon))} to-bg-base border border-white/5 rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-colors hover:border-white/10`}>
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
 {weapon.type && (
 <img 
 src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/billets/${toPascalCase(weapon.type)}.png`} 
 alt={weapon.type} 
 className="w-8 h-8 object-contain opacity-80 ml-auto" 
 />
 )}
 </div>

 {/* State Block */}
 <div className="grid grid-cols-1 gap-2 text-xs">
 <div className="bg-black/20 p-2 rounded-lg border border-white/5 flex items-center justify-between">
 <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Level</p>
 <p className=" text-gray-200">
 Lv. {entry.level ?? 1} 
 <span className="text-[var(--gold)] mx-2">→</span> 
 {entry.targetLevel ?? 90}
 </p>
 </div>
 </div>

 {/* Materials Block */}
 <div className="mt-auto border-t border-white/5 pt-3">
 <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 ">Required Materials</p>
 {Object.keys(totalCosts || {}).length === 0 ? (
 <p className="text-xs text-gray-500 italic">No materials needed.</p>
 ) : (
 <div className="grid grid-cols-4 gap-2 mt-2">
 {Object.entries(totalCosts || {})
 .filter(([matId, qty]) => {
 const sanitizedKey = matId.toString().toLowerCase().replace(/[\s_]/g, '');
 return qty > 0 && sanitizedKey !== 'mora' && !['totalexp', 'normalore', 'fineore', 'wastedexp', 'exptonextlevel'].includes(sanitizedKey);
 })
 .sort(([keyA], [keyB]) => {
 const a = keyA.toString().toLowerCase().replace(/[\s_]/g, '');
 const b = keyB.toString().toLowerCase().replace(/[\s_]/g, '');
 if (a === 'totalmora') return -1;
 if (b === 'totalmora') return 1;
 return 0;
 })
 .map(([matId, qty], index) => {
 let actualId = matId;
 const sanitizedKey = matId.toString().toLowerCase().replace(/[\s_]/g, '');
 
 if (sanitizedKey === 'totalmora') actualId = 'mora';
 if (sanitizedKey === 'mysticore') actualId = 'mystic_enhancement_ore';

 return (
 <div key={index} className="flex flex-col items-center p-2 bg-bg-surface rounded-lg border border-white/5">
 <img 
 src={`https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/main/${getFolder(categories[actualId])}/${toPascalCase(getItemName(actualId) || actualId)}.png`} 
 alt={actualId} 
 className="w-8 h-8 object-contain mb-1"
 />
 <span className="text-xs text-gray-400 ">x{qty}</span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )
}

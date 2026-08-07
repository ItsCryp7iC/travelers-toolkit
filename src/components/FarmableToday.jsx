/**
 * FarmableToday.jsx — "What can I farm today?" domain schedule widget.
 */
import React, { useMemo, useState } from 'react'
import useStore from '../store/useStore'
import { aggregateRosterCosts, computeToFarm } from '../utils/aggregator'
import { getDayLabel, formatItemName } from '../utils/calculator'
import weaponsData from '../data/weapons.json'
import { resolveSpecificItem, getJsonData } from '../utils/resolver'
import { getCharacterAvatar, getWeaponIcon, getMaterialIcon } from '../utils/assetHelper'

const REGION_ORDER = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai'];

const DAY_SCHEDULE_LABEL = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday',
}

const WEEKDAY_COLORS = {
  1: '#60A5FA', 4: '#60A5FA',
  2: '#4ADE80', 5: '#4ADE80',
  3: '#F97316', 6: '#F97316',
  0: '#C8A96E',
}

const RARITY_COLORS = {
  5: '#D87A34',
  4: '#9370DB',
  3: '#4682B4',
  2: '#6B8E23',
  1: '#808080'
}

const getScheduleWeight = (familyData) => {
  if (familyData?.days?.length) return Math.min(...familyData.days);
  return 99;
}

function DomainCard({ domainName, familyObj, accent, globalCosts, inventory }) {
  const { familyName, familyData, items, neededBy } = familyObj;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors overflow-hidden relative group">
      {/* Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ background: accent }} />
      
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <span className="text-xs">🏛️</span>
        <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--muted)] truncate">
          Domain: {domainName}
        </span>
      </div>

      {/* Body: Tier List */}
      <div className="p-3 space-y-3 flex-1">
        {familyData.tiers.map(tier => {
          let required = globalCosts[tier.id] || 0;
          if (items[tier.id]) {
             required = items[tier.id].item.required;
          }
          const owned = inventory[tier.id] || 0;
          
          if (required === 0 && owned === 0) return null;

          const percent = required > 0 ? Math.min(100, (owned / required) * 100) : (owned > 0 ? 100 : 0);
          const rarityColor = RARITY_COLORS[tier.rarity] || RARITY_COLORS[3];

          return (
            <div key={tier.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rarityColor }} />
                  <img 
                    src={getMaterialIcon(tier.name, familyObj.type === 'talent' ? 'Talent Material' : 'Weapon Ascension Material')} 
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
      {neededBy && neededBy.length > 0 && (
        <div className="px-3 pb-3 mt-auto">
          <div className="h-px w-full bg-[var(--border)] mb-2 opacity-50" />
          <p className="text-[9px] font-semibold tracking-widest text-[var(--muted)] uppercase mb-1.5">Needed By</p>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
            {neededBy.map((entity, i) => (
              <div key={i} className="relative w-8 h-8 rounded-full border border-gray-600 overflow-hidden bg-[var(--elevated)] flex-shrink-0">
                <img 
                  src={entity.type === 'character' ? getCharacterAvatar(entity.name) : getWeaponIcon(entity.name)}
                  alt={entity.name}
                  title={entity.name}
                  className="w-full h-full object-cover relative z-10"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] z-0" title={entity.name}>👤</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FarmableToday() {
  const roster = useStore((s) => s.roster)
  const trackedWeapons = useStore((s) => s.trackedWeapons)
  const inventory = useStore((s) => s.inventory)

  const [selectedDay, setSelectedDay] = useState(new Date().getDay())

  const dayLabel = DAY_SCHEDULE_LABEL[selectedDay]
  const dayColor = WEEKDAY_COLORS[selectedDay] || '#C8A96E'

  const totals = useMemo(() => aggregateRosterCosts(roster, trackedWeapons), [roster, trackedWeapons])
  const toFarm = useMemo(() => computeToFarm(totals, inventory), [totals, inventory])


  
  const getNeededBy = (matKey, type) => {
    const needed = []
    if (type === 'talent') {
      totals.breakdown.forEach(b => {
        if (b.totalCosts[matKey] > 0) {
          const charId = b.character?.id || b.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          needed.push({ name: b.name, icon: charId, type: 'character' })
        }
      })
    } else {
      trackedWeapons.forEach(w => {
        if (w.ascension === w.targetAscension && w.level >= w.targetLevel) return;
        const wData = weaponsData.find(wd => wd.name === w.weaponName)
        if (wData && wData.materials) {
           const family = wData.materials.ascension_material_family_id;
           const matFamilyData = getJsonData(matKey);
           
           if (matFamilyData && matFamilyData.familyId) {
             if (family && matFamilyData.familyId.toLowerCase().includes(family.toLowerCase())) {
               needed.push({ name: w.weaponName, icon: w.weapon_id, type: 'weapon' });
             }
           } else {
             // Fallback
             const normalizedMatKey = matKey.toLowerCase().replace(/[^a-z0-9]/g, '');
             if (family && normalizedMatKey.includes(family.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
               needed.push({ name: w.weaponName, icon: w.weapon_id, type: 'weapon' });
             }
           }
        }
      })
    }
    // Remove duplicates
    return needed.filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i);
  }

  // First, map the farmables
  const todayBooksFarmable = useMemo(() => {
    return (toFarm.talentBooks || []).filter(item => {
      const dbItem = getJsonData(item.name);
      return dbItem && (selectedDay === 0 || dbItem.days.includes(selectedDay));
    })
  }, [toFarm.talentBooks, selectedDay]);

  const todayWeaponFarmable = useMemo(() => {
    return (toFarm.weaponAscMats || []).filter(item => {
      const dbItem = getJsonData(item.name);
      return dbItem && (selectedDay === 0 || dbItem.days.includes(selectedDay));
    })
  }, [toFarm.weaponAscMats, selectedDay]);

  const groupedBooksData = useMemo(() => {
    const groups = {}; // Region -> Domain -> FamilyName -> FamilyObj
    todayBooksFarmable.forEach(item => {
      const familyData = getJsonData(item.name);
      if (!familyData) return;

      const region = familyData.region;
      const domainName = familyData.domain || 'Unknown Domain';
      const familyName = familyData.familyName;

      if (!groups[region]) groups[region] = {};
      if (!groups[region][domainName]) groups[region][domainName] = {};
      if (!groups[region][domainName][familyName]) {
        groups[region][domainName][familyName] = {
          familyName,
          familyData,
          type: 'talent',
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'talent');
      groups[region][domainName][familyName].items[item.name] = { item, neededBy };
      
      neededBy.forEach(entity => {
        if (!groups[region][domainName][familyName].neededBy.find(e => e.name === entity.name)) {
          groups[region][domainName][familyName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [todayBooksFarmable, totals.breakdown, trackedWeapons]);

  const groupedWeaponData = useMemo(() => {
    const groups = {}; // Region -> Domain -> FamilyName -> FamilyObj
    todayWeaponFarmable.forEach(item => {
      const familyData = getJsonData(item.name);
      if (!familyData) return;

      const region = familyData.region;
      const domainName = familyData.domain || 'Unknown Domain';
      const familyName = familyData.familyName;

      if (!groups[region]) groups[region] = {};
      if (!groups[region][domainName]) groups[region][domainName] = {};
      if (!groups[region][domainName][familyName]) {
        groups[region][domainName][familyName] = {
          familyName,
          familyData,
          type: 'weapon',
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'weapon');
      groups[region][domainName][familyName].items[item.name] = { item, neededBy };
      
      neededBy.forEach(entity => {
        if (!groups[region][domainName][familyName].neededBy.find(e => e.name === entity.name)) {
          groups[region][domainName][familyName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [todayWeaponFarmable, totals.breakdown, trackedWeapons]);

  const renderRegionGroups = (groupedData, accent) => {
    if (Object.keys(groupedData).length === 0) return (
      <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mb-4">
        {selectedDay === 0
          ? 'All materials are available today — farm anything!'
          : 'No materials needed from today\'s domains.'}
      </div>
    );

    return Object.keys(groupedData)
      .sort((a, b) => {
        const idxA = REGION_ORDER.indexOf(a);
        const idxB = REGION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(region => (
        <div key={region} className="mb-8 last:mb-2">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-sm">📍</span> {region}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.keys(groupedData[region]).map(domainName => (
              Object.values(groupedData[region][domainName])
                .sort((a, b) => getScheduleWeight(a.familyData) - getScheduleWeight(b.familyData))
                .map(familyObj => (
                  <DomainCard 
                    key={familyObj.familyName} 
                    domainName={domainName} 
                    familyObj={familyObj} 
                    accent={accent} 
                    globalCosts={totals.totalCosts}
                    inventory={inventory}
                  />
              ))
            ))}
          </div>
        </div>
      ))
  }

  // Aggregation
  const farmableCount = todayBooksFarmable.length + todayWeaponFarmable.length
  const weeklyNeeded  = toFarm.weeklyBoss || []

  if (Object.keys(roster).length === 0) return null

  console.log("FarmableToday toFarm prop:", toFarm);
  return (
    <div
      className="rounded-2xl border overflow-hidden bg-[var(--surface)]"
      style={{ borderColor: `${dayColor}30` }}
      id="farmable-today-widget"
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: `${dayColor}20`, background: `${dayColor}06` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${dayColor}18` }}>
            📅
          </div>
          <div>
            <h3 className="font-cinzel font-bold text-sm text-[var(--text)]">
              Daily Action Plan
            </h3>
            <p className="text-[10px] tracking-widest font-semibold mt-0.5" style={{ color: dayColor }}>
              {dayLabel.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-cinzel font-bold text-lg leading-none" style={{ color: farmableCount > 0 ? dayColor : '#4ADE80' }}>
            {farmableCount}
          </p>
          <p className="text-[9px] text-[var(--muted)] uppercase tracking-wider">tasks</p>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-[var(--border)]" style={{ background: 'rgba(0,0,0,0.1)' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedDay === day ? 'opacity-100 shadow-md' : 'opacity-40 hover:opacity-70 border-transparent'}`}
            style={{ 
              background: selectedDay === day ? `${WEEKDAY_COLORS[day] || '#C8A96E'}15` : 'transparent',
              color: selectedDay === day ? (WEEKDAY_COLORS[day] || '#C8A96E') : 'var(--muted)',
              border: `1px solid ${selectedDay === day ? (WEEKDAY_COLORS[day] || '#C8A96E') + '40' : 'transparent'}`
            }}
          >
            {DAY_SCHEDULE_LABEL[day].substring(0, 3).toUpperCase()}
          </button>
        ))}
      </div>

      <div className="px-5 py-5">
        <p className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-3 flex items-center gap-2">
          <span>📚</span> Talent Materials
        </p>
        {renderRegionGroups(groupedBooksData, dayColor)}

        <div className="genshin-divider my-6" />

        <p className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-3 flex items-center gap-2">
          <span>🗡️</span> Weapon Ascension Materials
        </p>
        {renderRegionGroups(groupedWeaponData, 'var(--gold)')}

        {/* Weekly Boss reminder */}
        {weeklyNeeded.length > 0 && (
          <>
            <div className="genshin-divider my-6" />
            <p className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase mb-3 flex items-center gap-2">
              <span>👑</span> Weekly Boss Reminders
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {weeklyNeeded.map((item) => (
                <div key={item.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border"
                  style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">👑</span>
                    <span className="text-xs font-bold text-[var(--text)] truncate">{formatItemName(item.name)}</span>
                  </div>
                  <span className="font-cinzel font-bold text-sm text-[#FBBF24] flex-shrink-0">×{item.toFarm}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* All done message */}
        {farmableCount === 0 && weeklyNeeded.length === 0 && (
          <div className="text-center py-8">
            <span className="text-4xl drop-shadow-lg">🎉</span>
            <p className="text-sm text-[var(--muted)] font-semibold mt-3 uppercase tracking-wider">Nothing left to farm today!</p>
          </div>
        )}
      </div>
    </div>
  )
}

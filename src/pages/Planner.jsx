import React, { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../store/useStore'
import { aggregateRosterCosts, computeToFarm } from '../utils/aggregator'
import { formatNumber, formatItemName } from '../utils/calculator'
import { formatName } from '../utils/gameData'
import FarmableToday from '../components/FarmableToday'
import DomainCard from '../components/DomainCard'
import { getJsonData } from '../utils/resolver'
import weeklyBossData from '../data/weekly_boss.json'
import weaponsData from '../data/weapons.json'
import characterGemsData from '../data/character_gems.json'
import normalBossData from '../data/normal_boss.json'
import eliteEnemyData from '../data/elite_enemy.json'
import commonEnemyData from '../data/common_enemy.json'
import localSpecialtyData from '../data/local_specialty.json'


// ─── Progress Bar ─────────────────────────────────────────────────────────
function ProgressBar({ owned, required, accent }) {
  const pct = required > 0 ? Math.min(100, Math.round((owned / required) * 100)) : 100
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--elevated)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#4ADE80' : accent || 'var(--gold)' }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums"
        style={{ color: pct >= 100 ? '#4ADE80' : 'var(--muted)' }}>
        {pct}%
      </span>
    </div>
  )
}

const RARITY_COLORS = {
  5: 'rgba(219, 177, 98, 0.2)', // Gold
  4: 'rgba(175, 140, 209, 0.2)', // Purple
  3: 'rgba(92, 172, 238, 0.2)', // Blue
  2: 'rgba(141, 198, 126, 0.2)', // Green
  1: 'rgba(164, 170, 181, 0.2)', // Gray
}

const RARITY_BORDERS = {
  5: 'var(--rarity-5)',
  4: 'var(--rarity-4)',
  3: 'var(--rarity-3)',
  2: 'var(--rarity-2)',
  1: 'var(--rarity-1)',
}

// ─── Tailored Item Card ────────────────────────────────────────────────────
export function ItemCard({ item, accent }) {
  const rarityBg = RARITY_COLORS[item.rarity || 3] || RARITY_COLORS[3];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)] transition-colors relative overflow-hidden group">

      {/* Background Glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: rarityBg }} />

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden" style={{ background: rarityBg }}>
        <img
          src={`/assets/items/${item.name}.png`}
          alt={formatItemName(item.name)}
          className="w-10 h-10 object-contain z-10 drop-shadow-md"
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
        />
        {/* Fallback icon if image fails to load */}
        <span className="text-xl absolute hidden">📦</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className="text-xs font-semibold text-[var(--text)] truncate mr-2">{formatItemName(item.name)}</span>
          <span className="font-cinzel font-bold text-xs" style={{ color: accent || 'var(--gold)' }}>
            ×{item.toFarm}
          </span>
        </div>
        <div className="flex justify-between text-[9px] text-[var(--muted)] mb-1">
          <span>Have: <b style={{ color: item.owned > 0 ? '#4ADE80' : 'var(--muted)' }}>{item.owned}</b></span>
          <span>Need: <b className="text-[var(--text)]">{item.required}</b></span>
        </div>
        <ProgressBar owned={item.owned} required={item.required} accent={accent} />
      </div>
    </div>
  )
}

// ─── To-Farm Category ─────────────────────────────────────────────────────
function ToFarmCategory({ icon, title, items, accent, emptyMsg }) {
  if (!items || items.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="planner-section-title mb-3">{icon} {title}</h3>
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-[var(--muted)] text-xs">
          <span>✅</span> {emptyMsg || 'All stocked up!'}
        </div>
      </div>
    )
  }
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="planner-section-title">{icon} {title}</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}>
          {items.length} items
        </span>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <ItemCard key={item.name} item={item} accent={accent} />
        ))}
      </div>
    </div>
  )
}

// ─── Per-Character Breakdown Row ──────────────────────────────────────────
function BreakdownRow({ entry: { name, entry, totalCosts, talentState, weaponState } }) {
  const [open, setOpen] = useState(false)
  const displayName = formatName(name)

  const totalMora = totalCosts?.mora || 0

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--elevated)] transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-cinzel font-bold text-xs flex-shrink-0"
          style={{ background: 'rgba(200,169,110,0.15)', color: 'var(--gold)' }}>
          {displayName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</p>
          <p className="text-[10px] text-[var(--muted)]">
            A{entry.ascension ?? 0} Lv{entry.level ?? 1} → A{entry.targetAscension ?? 6} Lv{entry.targetLevel ?? 90}
            {talentState && (
              <span className="ml-2">
                • Talents {talentState.normalFrom}/{talentState.skillFrom}/{talentState.burstFrom}→{talentState.normalTo}/{talentState.skillTo}/{talentState.burstTo}
              </span>
            )}
            {weaponState && weaponState.equippedWeapon && (
              <span className="ml-2 border-l border-[var(--border)] pl-2">
                🗡️ {formatName(weaponState.equippedWeapon)} {weaponState.weaponFromLv}→{weaponState.weaponToLv}
              </span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-cinzel font-bold text-[var(--gold)]">{formatNumber(totalMora)}</p>
          <p className="text-[9px] text-[var(--muted)]">Total Mora</p>
        </div>
        <span className="text-[var(--muted)] text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {totalCosts?.heros_wit > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📚 Hero's Wit</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.heros_wit}</p>
              </div>
            )}
            {totalCosts?.mystic_ore > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💠 Mystic Ore</p>
                <p className="text-sm font-cinzel font-bold text-[#F472B6]">×{totalCosts.mystic_ore}</p>
              </div>
            )}
            {totalCosts?.crown > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">👑 Crowns</p>
                <p className="text-sm font-cinzel font-bold text-[#FBBF24]">×{totalCosts.crown}</p>
              </div>
            )}
            {totalCosts?.masterless_stella_fortuna > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">⭐ Stella Fortuna</p>
                <p className="text-sm font-cinzel font-bold text-[#FBBF24]">×{totalCosts.masterless_stella_fortuna}</p>
              </div>
            )}

            {/* Gemstones */}
            {['gem_sliver', 'gem_fragment', 'gem_chunk', 'gem_gemstone'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">💎 {formatName(key.replace('gem_', ''))}</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Boss & Local */}
            {totalCosts?.boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🐉 Boss Material</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.boss_material}</p>
              </div>
            )}
            {totalCosts?.local_specialty > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🌸 Local Specialty</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.local_specialty}</p>
              </div>
            )}

            {/* Talent Books */}
            {['2_star_talent_material', '3_star_talent_material', '4_star_talent_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">📖 {key.split('_')[0]}-Star Book</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Weekly Boss */}
            {totalCosts?.weekly_boss_material > 0 && (
              <div className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🐺 Weekly Boss</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts.weekly_boss_material}</p>
              </div>
            )}

            {/* Weapon Asc Mats */}
            {['2_star_ascension_material', '3_star_ascension_material', '4_star_ascension_material', '5_star_ascension_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🔗 {key.split('_')[0]}-Star Asc. Mat</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Elite Drops */}
            {['2_star_enhancement_material', '3_star_enhancement_material', '4_star_enhancement_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">🛡️ {key.split('_')[0]}-Star Elite Mat</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}

            {/* Mob Drops */}
            {['1_star_enemy_material', '2_star_enemy_material', '3_star_enemy_material'].map(key => totalCosts?.[key] > 0 && (
              <div key={key} className="rounded-lg bg-[var(--elevated)] border border-[var(--border)] px-3 py-2">
                <p className="text-[9px] text-[var(--muted)] mb-0.5">⚔️ {key.split('_')[0]}-Star Mob Drop</p>
                <p className="text-sm font-cinzel font-bold text-[var(--text)]">×{totalCosts[key]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary Stat Card ────────────────────────────────────────────────────
function PlannerStat({ icon, label, value, accent, sub }) {
  return (
    <div className="stat-card flex-col items-start gap-1 py-4">
      <div className="flex items-center gap-2 w-full">
        <div className="stat-icon w-9 h-9" style={{ background: `${accent || '#C8A96E'}18` }}>{icon}</div>
        <p className="text-[var(--muted)] text-xs">{label}</p>
      </div>
      <p className="font-cinzel font-bold text-xl pl-1 leading-none mt-1" style={{ color: accent || 'var(--gold)' }}>
        {value}
      </p>
      {sub && <p className="text-[9px] text-[var(--muted)] pl-1">{sub}</p>}
    </div>
  )
}

// ─── Empty Roster Prompt ──────────────────────────────────────────────────
function EmptyRosterPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)' }}>
        🗺️
      </div>
      <h2 className="font-cinzel font-bold text-xl text-[var(--text)] mb-3">No Characters in Roster</h2>
      <p className="text-[var(--muted)] text-sm max-w-sm mb-6">
        Head to the Dashboard, add characters to your roster, and set their progression targets. The Planner will calculate everything needed.
      </p>
      <Link to="/" className="genshin-btn text-sm px-6 py-2.5" id="go-to-dashboard-btn">
        ➕ Add Characters
      </Link>
    </div>
  )
}

// ─── Main Planner Page ────────────────────────────────────────────────────
export default function Planner() {
  const roster = useStore(s => s.roster)
  const trackedWeapons = useStore(s => s.trackedWeapons)
  const inventory = useStore(s => s.inventory)

  const [activeTab, setActiveTab] = useState('daily_action')

  const totals = useMemo(() => aggregateRosterCosts(roster, trackedWeapons), [roster, trackedWeapons])
  const toFarm = useMemo(() => computeToFarm(totals, inventory), [totals, inventory])

  const getNeededBy = useCallback((matKey, type) => {
    const needed = []
    if (['talent', 'weekly_boss', 'gemstones', 'world_boss', 'elite_mob', 'mob', 'local_specialty', 'weapon'].includes(type)) {
      totals.breakdown.forEach(b => {
        if (b.totalCosts[matKey] > 0) {
          const isWeaponBreakdown = !b.character && weaponsData.some(w => w.name === b.name);
          const entityType = isWeaponBreakdown ? 'weapon' : 'character';
          const entityIcon = b.character?.id || b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          needed.push({ name: b.name, icon: entityIcon, type: entityType });
        }
      })
    }

    if (['weapon_ascension', 'weapon', 'elite_mob', 'mob'].includes(type)) {
      trackedWeapons.forEach(w => {
        if (w.ascension === w.targetAscension && w.level >= w.targetLevel) return;
        const wData = weaponsData.find(wd => wd.name === w.weaponName)
        if (wData && wData.materials) {
          let family = null;
          if (type === 'weapon_ascension' || type === 'weapon') family = wData.materials.ascension_material_family_id;
          if (type === 'elite_mob') family = wData.materials.elite_enemy_material_family_id;
          if (type === 'mob') family = wData.materials.common_enemy_material_family_id;

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
    return needed.filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i);
  }, [totals.breakdown, trackedWeapons]);

  const groupedBooksData = useMemo(() => {
    const groups = {}; // Region -> Domain -> FamilyName -> FamilyObj
    const allBooks = toFarm.talentBooks || [];

    allBooks.forEach(item => {
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
  }, [toFarm.talentBooks, getNeededBy]);

  const groupedWeaponMatsData = useMemo(() => {
    const groups = {}; // Region -> Domain -> FamilyName -> FamilyObj
    const allWeaponMats = toFarm.weaponAscMats || [];

    allWeaponMats.forEach(item => {
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
  }, [toFarm.weaponAscMats, getNeededBy]);

  const groupedGemstonesData = useMemo(() => {
    const groups = {}; // BaseName -> FamilyObj
    const allGems = toFarm.gemstones || [];

    const TIER_ORDER = {
      'sliver': 1,
      'fragment': 2,
      'chunk': 3,
      'gemstone': 4
    };

    allGems.forEach(item => {
      const rawName = item.name.toLowerCase();
      const prefixMatch = rawName.match(/^(.*?)(sliver|fragment|chunk|gemstone)$/);
      if (!prefixMatch) return;

      const prefix = prefixMatch[1];
      const suffix = prefixMatch[2];

      const cleanName = prefix.replace(/_+/g, ' ').trim();
      const formattedFamilyName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
      const baseKey = formattedFamilyName.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!groups[baseKey]) {
        const jsonEntry = characterGemsData.find(g => g.id === baseKey);
        let jsonSortOrder = 999;
        if (jsonEntry && jsonEntry.tiers) {
          jsonSortOrder = Math.min(...Object.values(jsonEntry.tiers).map(t => t.sortOrder || 999));
        }

        groups[baseKey] = {
          familyName: formattedFamilyName,
          familyKey: baseKey,
          jsonSortOrder,
          type: 'gemstones',
          familyData: {
            tiers: [
              { id: `${prefix}sliver`, name: `${formattedFamilyName} Sliver`, rarity: 1 },
              { id: `${prefix}fragment`, name: `${formattedFamilyName} Fragment`, rarity: 2 },
              { id: `${prefix}chunk`, name: `${formattedFamilyName} Chunk`, rarity: 3 },
              { id: `${prefix}gemstone`, name: `${formattedFamilyName} Gemstone`, rarity: 4 }
            ]
          },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'gemstones');

      groups[baseKey].items[item.name] = { item, neededBy };

      neededBy.forEach(entity => {
        if (!groups[baseKey].neededBy.find(e => e.name === entity.name)) {
          groups[baseKey].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.gemstones, getNeededBy]);

  const renderGemGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.values(groupedData)
          .sort((a, b) => a.jsonSortOrder - b.jsonSortOrder)
          .map(familyObj => (
            <DomainCard
              key={familyObj.familyKey}
              domainName={`FAMILY: ${familyObj.familyName.toUpperCase()}`}
              familyObj={familyObj}
              accent={accent}
              globalCosts={totals.totalCosts}
              inventory={inventory}
              itemFolder={itemFolder}
            />
          ))}
      </div>
    );
  };

  const groupedWeeklyBosses = useMemo(() => {
    const groups = {}; // Region -> BossName -> { bossName, region, items: [], neededBy: [] }
    const weeklyNeeded = toFarm.weeklyBoss || [];

    weeklyNeeded.forEach(item => {
      const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bossData = weeklyBossData.find(b => b.id === normalizedKey || b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

      if (!bossData) return;
      const bossName = bossData.boss_name || 'Unknown Boss';
      const region = bossData.region || 'Unknown Region';

      if (!groups[region]) groups[region] = {};

      if (!groups[region][bossName]) {
        const allBossMaterials = weeklyBossData.filter(b => b.boss_name === bossName).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const bossSortOrder = Math.min(...allBossMaterials.map(m => m.sortOrder || 999));

        groups[region][bossName] = {
          bossName,
          region,
          bossSortOrder,
          familyName: bossName,
          type: 'weekly_boss',
          familyData: {
            tiers: allBossMaterials.map(m => ({ id: m.id, name: m.name, rarity: 5 })) // mock tiers for DomainCard
          },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'weekly_boss');

      groups[region][bossName].items[bossData.id] = { item, neededBy };

      neededBy.forEach(entity => {
        if (!groups[region][bossName].neededBy.find(e => e.name === entity.name)) {
          groups[region][bossName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.weeklyBoss, getNeededBy]);

  const groupedNormalBosses = useMemo(() => {
    const groups = {}; // Region -> BossName -> { bossName, region, items: [], neededBy: [] }
    const bossNeeded = toFarm.worldBoss || [];

    bossNeeded.forEach(item => {
      const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bossData = normalBossData.find(b => b.id === normalizedKey || b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

      if (!bossData) return;
      const bossName = bossData.boss_name || 'Unknown Boss';
      const region = bossData.region || 'Unknown Region';

      if (!groups[region]) groups[region] = {};

      if (!groups[region][bossName]) {
        groups[region][bossName] = {
          bossName,
          region,
          bossSortOrder: bossData.sortOrder || 999,
          type: 'world_boss',
          familyData: { tiers: [{ id: bossData.id, name: item.name, rarity: 4 }] },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'world_boss');

      groups[region][bossName].items[bossData.id] = { item, neededBy };

      neededBy.forEach(entity => {
        if (!groups[region][bossName].neededBy.find(e => e.name === entity.name)) {
          groups[region][bossName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.worldBoss, getNeededBy]);

  const renderBossRegionGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return Object.keys(groupedData)
      .sort((a, b) => {
        const idxA = REGION_ORDER.indexOf(a);
        const idxB = REGION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(region => {
        const regionKey = `${categoryKey}-${region}`;
        const isCollapsed = collapsed[regionKey];
        return (
          <div key={region} className="mb-8 last:mb-2">
            <h3
              className="text-xl font-bold mb-4 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleSection(regionKey)}
            >
              <span className={`text-lg inline-block transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
              <span className="text-sm">📍</span> {region}
            </h3>
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.values(groupedData[region])
                  .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                  .map(bossObj => {
                    let prefix = 'BOSS';
                    if (bossObj.type === 'elite_mob' || bossObj.type === 'mob') prefix = 'ENEMY';
                    if (bossObj.type === 'local_specialty') prefix = 'LOCAL SPECIALTY';

                    return (
                      <DomainCard
                        key={bossObj.bossName}
                        domainName={`${prefix}: ${bossObj.bossName.toUpperCase()}`}
                        familyObj={bossObj}
                        accent={accent}
                        globalCosts={totals.totalCosts}
                        inventory={inventory}
                        itemFolder={itemFolder}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        );
      });
  };

  const groupedLocalSpecialties = useMemo(() => {
    const groups = {}; // Region -> itemName -> { bossName, region, items: {}, neededBy: [] }
    const localNeeded = toFarm.localSpecialty || [];

    localNeeded.forEach(item => {
      const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const specialtyData = localSpecialtyData.find(s => s.id === normalizedKey || s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);
      
      if (!specialtyData) return;
      const region = specialtyData.region || 'Unknown Region';
      const itemName = specialtyData.name;

      if (!groups[region]) groups[region] = {};

      if (!groups[region][itemName]) {
        groups[region][itemName] = {
          bossName: itemName,
          region,
          bossSortOrder: specialtyData.sortOrder || 999,
          type: 'local_specialty',
          familyData: {
            tiers: [{ id: specialtyData.id, name: itemName, rarity: 1 }]
          },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'local_specialty');
      
      groups[region][itemName].items[specialtyData.id] = { item, neededBy };
      
      neededBy.forEach(entity => {
        if (!groups[region][itemName].neededBy.find(e => e.name === entity.name)) {
          groups[region][itemName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.localSpecialty, getNeededBy]);

  const groupedEliteEnemies = useMemo(() => {
    const groups = {}; // EnemyName -> { bossName, items: [], neededBy: [] }
    const eliteNeeded = toFarm.eliteMob || [];

    eliteNeeded.forEach(item => {
      let matchedEnemy = null;
      let matchedTierId = null;

      // Find which enemy and tier this item belongs to
      for (const enemy of eliteEnemyData) {
        if (matchedEnemy) break;
        for (const [tierKey, tierObj] of Object.entries(enemy.tiers)) {
          if (tierObj.name === item.name || tierObj.id === item.name.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            matchedEnemy = enemy;
            matchedTierId = tierObj.id;
            break;
          }
        }
      }

      if (!matchedEnemy) return;
      const enemyName = matchedEnemy.name || 'Unknown Enemy';

      if (!groups[enemyName]) {
        groups[enemyName] = {
          bossName: enemyName,
          bossSortOrder: matchedEnemy.tiers['2_star']?.sortOrder || 999,
          type: 'elite_mob',
          familyData: {
            tiers: [
              { id: matchedEnemy.tiers['2_star'].id, name: matchedEnemy.tiers['2_star'].name, rarity: 2 },
              { id: matchedEnemy.tiers['3_star'].id, name: matchedEnemy.tiers['3_star'].name, rarity: 3 },
              { id: matchedEnemy.tiers['4_star'].id, name: matchedEnemy.tiers['4_star'].name, rarity: 4 }
            ]
          },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'elite_mob');

      groups[enemyName].items[matchedTierId] = { item, neededBy };

      neededBy.forEach(entity => {
        if (!groups[enemyName].neededBy.find(e => e.name === entity.name)) {
          groups[enemyName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.eliteMob, getNeededBy]);

  const groupedCommonEnemies = useMemo(() => {
    const groups = {}; // EnemyName -> { bossName, items: {}, neededBy: [] }
    const mobNeeded = toFarm.mob || [];

    mobNeeded.forEach(item => {
      let matchedEnemy = null;
      let matchedTierId = null;

      for (const enemy of commonEnemyData) {
        if (matchedEnemy) break;
        for (const [tierKey, tierObj] of Object.entries(enemy.tiers)) {
          if (tierObj.name === item.name || tierObj.id === item.name.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            matchedEnemy = enemy;
            matchedTierId = tierObj.id;
            break;
          }
        }
      }

      if (!matchedEnemy) return;
      const enemyName = matchedEnemy.name || 'Unknown Enemy';

      if (!groups[enemyName]) {
        groups[enemyName] = {
          bossName: enemyName,
          bossSortOrder: matchedEnemy.tiers['1_star']?.sortOrder || 999,
          type: 'mob',
          familyData: {
            tiers: [
              { id: matchedEnemy.tiers['1_star'].id, name: matchedEnemy.tiers['1_star'].name, rarity: 1 },
              { id: matchedEnemy.tiers['2_star'].id, name: matchedEnemy.tiers['2_star'].name, rarity: 2 },
              { id: matchedEnemy.tiers['3_star'].id, name: matchedEnemy.tiers['3_star'].name, rarity: 3 }
            ]
          },
          items: {},
          neededBy: []
        };
      }

      const neededBy = getNeededBy(item.name, 'mob');

      groups[enemyName].items[matchedTierId] = { item, neededBy };

      neededBy.forEach(entity => {
        if (!groups[enemyName].neededBy.find(e => e.name === entity.name)) {
          groups[enemyName].neededBy.push(entity);
        }
      });
    });

    return groups;
  }, [toFarm.mob, getNeededBy]);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('planner-collapsed-state');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const toggleSection = (key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('planner-collapsed-state', JSON.stringify(next));
      return next;
    });
  };

  const setAllRegions = (category, isCollapsed, groupedData) => {
    setCollapsed(prev => {
      const next = { ...prev };
      Object.keys(groupedData).forEach(region => {
        next[`${category}-${region}`] = isCollapsed;
      });
      localStorage.setItem('planner-collapsed-state', JSON.stringify(next));
      return next;
    });
  };

  const REGION_ORDER = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya'];

  const getScheduleWeight = (familyData) => {
    if (familyData?.days?.length) return Math.min(...familyData.days);
    return 99;
  };

  const renderRegionGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return Object.keys(groupedData)
      .sort((a, b) => {
        const idxA = REGION_ORDER.indexOf(a);
        const idxB = REGION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(region => {
        const regionKey = `${categoryKey}-${region}`;
        const isCollapsed = collapsed[regionKey];
        return (
          <div key={region} className="mb-8 last:mb-2">
            <h3
              className="text-xl font-bold mb-4 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleSection(regionKey)}
            >
              <span className={`text-lg inline-block transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
              <span className="text-sm">📍</span> {region}
            </h3>
            {!isCollapsed && (
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
                        itemFolder={itemFolder}
                      />
                    ))
                ))}
              </div>
            )}
          </div>
        );
      })
  }

  const hasRoster = Object.keys(roster).length > 0

  const remainingTotals = useMemo(() => {
    let mora = toFarm.mora?.toFarm || 0;
    let crowns = toFarm.crown?.toFarm || 0;
    let sumItems = 0;

    for (const key of Object.keys(toFarm)) {
      if (['totalItems', 'allDone', 'mora', 'crown'].includes(key)) continue;
      const val = toFarm[key];
      if (Array.isArray(val)) {
        val.forEach(item => {
          if (item?.toFarm) sumItems += item.toFarm;
        });
      } else if (val?.toFarm) {
        sumItems += val.toFarm;
      }
    }
    return { mora, crowns, sumItems };
  }, [toFarm]);

  if (!hasRoster) return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📋</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">Planner</h1>
        </div>
      </div>
      <EmptyRosterPrompt />
    </div>
  )

  const TABS = [
    { id: 'daily_action', label: 'Daily Action Plan' },
    { id: 'currency_exp', label: 'Currency & EXP' },
    { id: 'normal_boss', label: 'Normal Boss Material' },
    { id: 'weekly_boss', label: 'Weekly Boss Material' },
    { id: 'talent', label: 'Talent Materials' },
    { id: 'common_enhancement', label: 'Common Enhancement Material' },
    { id: 'elite_enhancement', label: 'Elite Enhancement Material' },
    { id: 'weapon_ascension', label: 'Weapon Ascension Material' },
    { id: 'local_specialty', label: 'Local Specialty' },
    { id: 'character_gem', label: 'Character Ascension Gem' },
    { id: 'per_character', label: 'Per Character Plan' },
    { id: 'per_weapon', label: 'Per Weapon Plan' }
  ];

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📋</span>
          <h1 className="font-cinzel font-bold text-2xl md:text-3xl text-[var(--text)]">Resource Planner</h1>
        </div>
        <p className="text-[var(--muted)] text-sm ml-11">
          Grand total across {totals.trackedCount} tracked character{totals.trackedCount !== 1 ? 's' : ''} — inventory subtracted
        </p>
      </div>

      {/* ── Grand Total Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <PlannerStat icon="👥" label="Tracked Characters" value={totals.trackedCount} accent="#4EC9B0" />
        <PlannerStat icon="🪙" label="Total Mora" value={formatNumber(remainingTotals.mora)} accent="#FAB632" />
        <PlannerStat icon="👑" label="Crowns Needed" value={remainingTotals.crowns} accent="#FBBF24"
          sub={remainingTotals.crowns > 0 ? 'Crown of Insight' : 'None needed'} />
        <PlannerStat icon="🎒" label="Still to Farm" value={formatNumber(remainingTotals.sumItems)}
          accent={toFarm.allDone ? '#4ADE80' : '#F97316'}
          sub={toFarm.allDone ? '✅ All stocked!' : 'materials left'} />
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex flex-wrap gap-2 my-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.id 
                ? 'bg-amber-600 text-white' 
                : 'bg-[#1a1c23] text-gray-400 hover:bg-[#23252e] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="animate-fade-in">
        {activeTab === 'daily_action' && (
          <>
            {toFarm.allDone && (
              <div className="rounded-2xl border mb-8 px-6 py-5 flex items-center gap-4"
                style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' }}>
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="font-cinzel font-bold text-lg" style={{ color: '#4ADE80' }}>Inventory is fully stocked!</p>
                  <p className="text-sm text-[var(--muted)] mt-0.5">Your current inventory covers all progression goals. Time to ascend!</p>
                </div>
              </div>
            )}
            <FarmableToday />
          </>
        )}

        {activeTab === 'currency_exp' && (
          (toFarm.mora || toFarm.heroWits || toFarm.crown || toFarm.mysticOre || toFarm.stellaFortuna) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {toFarm.mora && <ItemCard item={toFarm.mora} accent="#FAB632" />}
              {toFarm.heroWits && <ItemCard item={toFarm.heroWits} accent="#60A5FA" />}
              {toFarm.mysticOre && <ItemCard item={toFarm.mysticOre} accent="#F472B6" />}
              {toFarm.crown && <ItemCard item={toFarm.crown} accent="#FBBF24" />}
              {toFarm.stellaFortuna && <ItemCard item={toFarm.stellaFortuna} accent="#FBBF24" />}
            </div>
          ) : (
            <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All currency and EXP covered</div>
          )
        )}

        {activeTab === 'talent' && (
          toFarm.talentBooks?.length > 0
            ? renderRegionGroups(groupedBooksData, '#A855F7', 'all-talent', 'talent_materials')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All talent books covered</div>
        )}

        {activeTab === 'weekly_boss' && (
          toFarm.weeklyBoss?.length > 0
            ? renderBossRegionGroups(groupedWeeklyBosses, '#FBBF24', 'all-weekly', 'weekly_boss_materials')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All weekly boss drops covered</div>
        )}

        {activeTab === 'weapon_ascension' && (
          toFarm.weaponAscMats?.length > 0
            ? renderRegionGroups(groupedWeaponMatsData, 'var(--gold)', 'all-weapon', 'weapon_ascension_materials')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All weapon domains covered</div>
        )}

        {activeTab === 'character_gem' && (
          toFarm.gemstones?.length > 0
            ? renderGemGroups(groupedGemstonesData, '#C8A96E', 'all-gem', 'character_gems')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All gemstones covered</div>
        )}

        {activeTab === 'normal_boss' && (
          toFarm.worldBoss?.length > 0
            ? renderBossRegionGroups(groupedNormalBosses, '#F97316', 'all-normalboss', 'normal_boss_materials')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All boss drops covered</div>
        )}

        {activeTab === 'elite_enhancement' && (
          toFarm.eliteMob?.length > 0
            ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {Object.values(groupedEliteEnemies)
                    .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                    .map(bossObj => (
                      <DomainCard
                        key={bossObj.bossName}
                        domainName={`ENEMY: ${bossObj.bossName.toUpperCase()}`}
                        familyObj={bossObj}
                        accent="var(--gold)"
                        globalCosts={totals.totalCosts}
                        inventory={inventory}
                        itemFolder="elite_enhancement_materials"
                      />
                    ))}
                </div>
              )
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All elite drops covered</div>
        )}

        {activeTab === 'local_specialty' && (
          toFarm.localSpecialty?.length > 0
            ? renderBossRegionGroups(groupedLocalSpecialties, '#4ADE80', 'all-specialty', 'local_specialties')
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All local specialties covered</div>
        )}

        {activeTab === 'common_enhancement' && (
          toFarm.mob?.length > 0
            ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {Object.values(groupedCommonEnemies)
                    .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                    .map(enemyObj => (
                      <DomainCard
                        key={enemyObj.bossName}
                        domainName={`ENEMY: ${enemyObj.bossName.toUpperCase()}`}
                        familyObj={enemyObj}
                        accent="#A855F7"
                        globalCosts={totals.totalCosts}
                        inventory={inventory}
                        itemFolder="common_enhancement_materials"
                      />
                    ))}
                </div>
              )
            : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All mob drops covered</div>
        )}

        {activeTab === 'per_character' && (
          <div>
            <p className="text-xs text-[var(--muted)] mb-4">Click a row to expand the full cost breakdown</p>
            {totals.breakdown.filter(entry => entry.character).length > 0
              ? totals.breakdown.filter(entry => entry.character).map((entry) => <BreakdownRow key={entry.name} entry={entry} />)
              : <div className="text-center py-12 text-[var(--muted)]"><p>No characters have active goals yet.</p></div>
            }
          </div>
        )}

        {activeTab === 'per_weapon' && (
          <div>
            <p className="text-xs text-[var(--muted)] mb-4">Click a row to expand the full cost breakdown</p>
            {totals.breakdown.filter(entry => !entry.character).length > 0
              ? totals.breakdown.filter(entry => !entry.character).map((entry) => <BreakdownRow key={entry.name} entry={entry} />)
              : <div className="text-center py-12 text-[var(--muted)]"><p>No stand-alone weapons have active goals yet.</p></div>
            }
          </div>
        )}
      </div>

      {/* ── Inventory link ── */}
      <div className="mt-10 p-4 rounded-xl border border-[var(--border)] flex items-center justify-between gap-4 bg-[var(--surface)]">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">📦 Update your inventory</p>
          <p className="text-xs text-[var(--muted)]">The To-Farm list auto-updates as you add materials</p>
        </div>
        <Link to="/inventory" id="go-to-inventory-btn"
          className="genshin-btn text-xs px-4 py-2 whitespace-nowrap flex-shrink-0">
          Open Inventory →
        </Link>
      </div>
    </div>
  )
}

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel, 
  flexRender 
} from '@tanstack/react-table';
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass } from '../utils/gameData';
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon, getMaterialIcon } from '../utils/assetHelper';
import GenshinImage from './GenshinImage';
import MatQuantity from './MatQuantity';
import InlineNumberInput from './InlineNumberInput';
import { resolveCharacterMaterials } from '../utils/dataManager';
import { formatNumber, toggleMilestoneAscension, isMilestone } from '../utils/calculator';
import { universalFilterFn, UnifiedHeaderMenu } from './Table/UnifiedHeaderMenu';

const getRarityColorClass = (rarity) => {
  const r = Number(rarity) || rarity;
  if (r === 5 || r === '5*' || r === '★★★★★') return 'text-amber-400 font-semibold';
  if (r === 4 || r === '4*' || r === '★★★★') return 'text-purple-400 font-semibold';
  if (r === 3 || r === '3*' || r === '★★★') return 'text-blue-400';
  if (r === 2 || r === '2*' || r === '★★') return 'text-green-400';
  return 'text-gray-400';
};

const isAscended = (level, ascension) => {
  if (level === 20 && ascension >= 1) return true;
  if (level === 40 && ascension >= 2) return true;
  if (level === 50 && ascension >= 3) return true;
  if (level === 60 && ascension >= 4) return true;
  if (level === 70 && ascension >= 5) return true;
  if (level === 80 && ascension >= 6) return true;
  if (level === 90 && ascension >= 6) return true;
  return false;
}



export default function CharactersTable({
  data,
  selectedNames,
  setSelectedNames,
  setEditingChar,
  updateCharacter,
  removeCharacter
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setActiveMenu(null); 
      setMenuAnchorEl(null); 
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const renderTalentCell = (row, tierStar, defaultColor, defaultIcon) => {
    const isTraveler = !!row.original.materials?.talent_material_family_ids;
    const resolvedMats = resolveCharacterMaterials(row.original);

    if (!isTraveler) {
      const val = row.original.talentCosts?.[`${tierStar}_star_talent_material`] || 0;
      return <MatQuantity val={val} icon={defaultIcon} color={`text-${defaultColor}`} nameKey={resolvedMats?.talent?.tiers?.[`${tierStar}_star`]?.name} category="Talent Material" />;
    }

    // Traveler Logic
    const families = row.original.materials.talent_material_family_ids;
    const breakdown = [];
    let totalVal = 0;
    
    families.forEach(family => {
      const key = `${family}_${tierStar}_star_talent_material`;
      const qty = row.original.talentCosts?.[key] || 0;
      if (qty > 0) {
         breakdown.push({ family, qty });
         totalVal += qty;
      }
    });

    if (totalVal === 0) {
       return <MatQuantity val={0} icon={defaultIcon} color={`text-${defaultColor}`} category="Talent Material" />;
    }

    const firstBookName = resolvedMats?.talent?.tiers?.[`${tierStar}_star`]?.name;

    return (
      <div className="group/book relative inline-flex items-center justify-center">
        <MatQuantity val={totalVal} icon={defaultIcon} color={`text-${defaultColor}`} nameKey={firstBookName} category="Talent Material" isStacked={true} />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/book:block w-max bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 shadow-xl z-50 text-left">
          <p className="text-xs font-semibold text-[var(--text)] mb-2 border-b border-[var(--border)] pb-1">
            {tierStar === 2 ? 'Teachings' : tierStar === 3 ? 'Guides' : 'Philosophies'} ({tierStar}★)
          </p>
          <div className="flex flex-col gap-1 mt-1">
            {breakdown.map(b => (
              <div key={b.family} className="flex justify-between gap-4 text-xs">
                <span className="text-[var(--muted)]">{b.family}</span>
                <span className={`font-mono text-${defaultColor}`}>×{b.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const columns = useMemo(() => [
    // ──────────────── IDENTITY ────────────────
    {
      id: 'Identity',
      header: 'Identity',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)] sticky left-0 z-30 bg-[var(--elevated)] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]" },
      columns: [
        {
          id: 'select',
          header: ({ table }) => (
            <div className="w-full h-full flex items-center justify-center cursor-pointer pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (table.getFilteredRowModel().rows.length > 0 && selectedNames.length === table.getFilteredRowModel().rows.length) {
                     setSelectedNames([]);
                   } else {
                     setSelectedNames(table.getFilteredRowModel().rows.map(r => r.original.name));
                   }
                 }}>
              <input 
                type="checkbox" 
                checked={table.getFilteredRowModel().rows.length > 0 && selectedNames.length === table.getFilteredRowModel().rows.length}
                readOnly
                className="w-5 h-5 pointer-events-none rounded border-gray-600 bg-gray-800/50 text-[var(--gold)] focus:ring-0 focus:ring-offset-0"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="w-full h-full flex items-center justify-center cursor-pointer pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   const name = row.original.name;
                   if (selectedNames.includes(name)) {
                     setSelectedNames(prev => prev.filter(n => n !== name));
                   } else {
                     setSelectedNames(prev => [...prev, name]);
                   }
                 }}>
              <input 
                type="checkbox" 
                checked={selectedNames.includes(row.original.name)}
                readOnly
                className="w-5 h-5 pointer-events-none rounded border-gray-600 bg-gray-800/50 text-[var(--gold)] focus:ring-0 focus:ring-offset-0"
              />
            </div>
          ),
          meta: {
            thClassName: "w-16 px-2 py-2 sticky left-0 z-20 bg-[var(--surface)] border-r border-gray-700/50",
            tdClassName: "w-16 px-4 py-2 sticky left-0 z-20 bg-inherit border-r border-gray-700/50"
          },
          enableSorting: false, enableColumnFilter: false
        },
        {
          id: 'sl',
          header: 'Sl',
          accessorFn: (_, i) => i + 1,
          meta: {
            thClassName: "text-center px-2 py-2 font-semibold sticky left-[64px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px]",
            tdClassName: "px-4 py-2 text-center text-xs text-[var(--muted)] sticky left-[64px] z-10 bg-inherit border-r border-[var(--border)] w-[48px] min-w-[48px] max-w-[48px] cursor-pointer"
          },
          enableSorting: false, enableColumnFilter: false,
          cell: info => <span className="text-[var(--muted)]">{info.getValue()}</span>
        },
        {
          id: 'character',
          header: 'Character',
          accessorFn: row => row.name,
          meta: {
            filterType: 'text',
            thClassName: "text-left px-2 py-2 font-semibold sticky left-[112px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]",
            tdClassName: "px-4 py-2 sticky left-[112px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const char = row.original;
            const elCfg = ELEMENTS[char.element] || ELEMENTS.Unknown;
            return (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow relative overflow-hidden" style={{ background: elCfg.avatarGradient }}>
                  <GenshinImage 
                    src={getCharacterAvatar(char.name)} 
                    alt={char.name} 
                    className="w-full h-full object-cover absolute inset-0 z-10" 
                    fallback={<span className="text-xs relative z-10" style={{ color: elCfg.color }}>{getInitials(char.name)}</span>} 
                  />
                </div>
                <div className="truncate">
                  <p className={`text-xs font-semibold ${getRarityColorClass(char.data?.rarity || char.rarity)} truncate`}>{formatName(char.name)}</p>
                  <p className={`text-xs ${getRarityClass(char.rarity)}`}>{getStars(char.rarity)}</p>
                </div>
              </div>
            );
          }
        },
        {
          id: 'element',
          header: 'Element',
          accessorFn: row => row.element,
          meta: {
            filterType: 'text',
            thClassName: "text-center px-2 py-2 font-semibold sticky left-[312px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]",
            tdClassName: "px-4 py-2 text-center sticky left-[312px] z-10 bg-inherit w-[82px] min-w-[82px] max-w-[82px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ getValue }) => {
            const el = getValue();
            const elCfg = ELEMENTS[el] || ELEMENTS.Unknown;
            return (
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border overflow-hidden" style={{ background: elCfg.colorDim, borderColor: elCfg.color + '50', color: elCfg.color }} title={el}>
                <GenshinImage src={getElementIcon(el)} alt={el} className="w-8 h-8 object-contain shrink-0" fallback={elCfg.emoji} />
              </span>
            );
          }
        },
        {
          id: 'weapon',
          header: 'Weapon',
          accessorFn: row => row.weapon_type || row.weapon,
          meta: {
            filterType: 'text',
            thClassName: "text-center px-2 py-2 font-semibold sticky left-[394px] z-20 bg-[var(--surface)] w-[80px] min-w-[80px] max-w-[80px]",
            tdClassName: "px-4 py-2 text-center sticky left-[394px] z-10 bg-inherit w-[80px] min-w-[80px] max-w-[80px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ getValue }) => {
            const wp = getValue();
            const wpCfg = WEAPON_TYPES[wp];
            return <GenshinImage src={getWeaponTypeIcon(wp)} alt={wp} className="w-8 h-8 object-contain inline-block shrink-0" fallback={<span>{wpCfg?.emoji}</span>} />;
          }
        },
        {
          id: 'equipped',
          header: 'Equipped',
          accessorFn: row => row.eqWeapon?.tracked?.weaponName || 'None',
          meta: {
            filterType: 'text',
            thClassName: "text-left px-2 py-2 font-semibold sticky left-[474px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]",
            tdClassName: "px-4 py-2 sticky left-[474px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const eqWeapon = row.original.eqWeapon;
            if (!eqWeapon) return <span className="text-xs text-[var(--muted)] italic">None</span>;
            const eqRarityColor = getRarityColorClass(eqWeapon.data?.rarity);
            return (
              <div className="flex items-center gap-3">
                <GenshinImage 
                  src={getWeaponIcon(eqWeapon.tracked.weaponName)} 
                  alt={eqWeapon.tracked.weaponName} 
                  className="w-8 h-8 object-contain shrink-0" 
                  fallback={<span className="text-xl shrink-0">{WEAPON_TYPES[eqWeapon.data?.type]?.emoji || '⚔️'}</span>} 
                />
                <div className="truncate min-w-0">
                  <p className={`text-xs font-semibold ${eqRarityColor} truncate`}>{formatName(eqWeapon.tracked.weaponName)}</p>
                  <p className="text-xs text-[var(--muted)]">Lv{eqWeapon.tracked.level}→{eqWeapon.tracked.targetLevel}</p>
                </div>
              </div>
            );
          }
        }
      ]
    },
    // ──────────────── CURRENT STATE ────────────────
    {
      id: 'Current State',
      header: 'Current State',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'current_lv', header: 'Lv', accessorFn: row => row.entry?.level ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const char = row.original;
            const entry = char.entry;
            const level = getValue();
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={level} min={1} max={90} onChangeSubmit={(val) => updateCharacter(char.name, { level: val })} className="text-xs text-[var(--text)]" />
                {isAscended(level, entry?.ascension ?? 0) && level < 90 && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Ascended" className={`w-3 h-3 object-contain ml-1 select-none transition-colors ${isMilestone(level) ? 'cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-100' : 'cursor-default text-white/30 opacity-80'}`} onClick={(e) => { e.stopPropagation(); if (isMilestone(level)) updateCharacter(char.name, { ascension: toggleMilestoneAscension(level, entry?.ascension ?? 0) }); }} />
                )}
                {!isAscended(level, entry?.ascension ?? 0) && isMilestone(level) && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Unascended" className="w-3 h-3 object-contain ml-1 select-none transition-colors cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-50 grayscale" onClick={(e) => { e.stopPropagation(); updateCharacter(char.name, { ascension: toggleMilestoneAscension(level, entry?.ascension ?? 0) }); }} />
                )}
              </div>
            );
          }
        },
        {
          id: 'current_na', header: 'NA', accessorFn: row => row.entry?.talents?.normal ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { talents: { ...row.original.entry?.talents, normal: val } })} className="text-xs text-[var(--muted)]" /></div>
        },
        {
          id: 'current_skill', header: 'Skill', accessorFn: row => row.entry?.talents?.skill ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { talents: { ...row.original.entry?.talents, skill: val } })} className="text-xs text-[var(--muted)]" /></div>
        },
        {
          id: 'current_burst', header: 'Burst', accessorFn: row => row.entry?.talents?.burst ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { talents: { ...row.original.entry?.talents, burst: val } })} className="text-xs text-[var(--muted)]" /></div>
        }
      ]
    },
    // ──────────────── TARGET STATE ────────────────
    {
      id: 'Target State',
      header: 'Target State',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[var(--gold)] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'target_lv', header: 'Lv', accessorFn: row => row.entry?.targetLevel ?? 90,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)]", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const char = row.original;
            const entry = char.entry;
            const level = getValue();
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={level} min={1} max={90} onChangeSubmit={(val) => updateCharacter(char.name, { targetLevel: val })} className="text-xs text-[var(--gold)]" />
                {isAscended(level, entry?.targetAscension ?? 6) && level < 90 && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Ascended" className={`w-3 h-3 object-contain ml-1 select-none transition-colors ${isMilestone(level) ? 'cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-100' : 'cursor-default text-white/30 opacity-80'}`} onClick={(e) => { e.stopPropagation(); if (isMilestone(level)) updateCharacter(char.name, { targetAscension: toggleMilestoneAscension(level, entry?.targetAscension ?? 6) }); }} />
                )}
                {!isAscended(level, entry?.targetAscension ?? 6) && isMilestone(level) && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Unascended" className="w-3 h-3 object-contain ml-1 select-none transition-colors cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-50 grayscale" onClick={(e) => { e.stopPropagation(); updateCharacter(char.name, { targetAscension: toggleMilestoneAscension(level, entry?.targetAscension ?? 6) }); }} />
                )}
              </div>
            );
          }
        },
        {
          id: 'target_na', header: 'NA', accessorFn: row => row.entry?.targetTalents?.normal ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { targetTalents: { ...row.original.entry?.targetTalents, normal: val } })} className="text-xs text-[var(--gold)]" /></div>
        },
        {
          id: 'target_skill', header: 'Skill', accessorFn: row => row.entry?.targetTalents?.skill ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { targetTalents: { ...row.original.entry?.targetTalents, skill: val } })} className="text-xs text-[var(--gold)]" /></div>
        },
        {
          id: 'target_burst', header: 'Burst', accessorFn: row => row.entry?.targetTalents?.burst ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => <div onClick={e => e.stopPropagation()}><InlineNumberInput value={getValue()} min={1} max={10} onChangeSubmit={(val) => updateCharacter(row.original.name, { targetTalents: { ...row.original.entry?.targetTalents, burst: val } })} className="text-xs text-[var(--gold)]" /></div>
        }
      ]
    },
    // ──────────────── ASCENSION REQUIREMENTS ────────────────
    {
      id: 'Ascension Requirements',
      header: 'Ascension Requirements',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'asc_wit', header: 'Wit', accessorFn: row => row.ascCosts?.heros_wit || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-purple-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.ascCosts?.heros_wit || 0} icon="📘" color="text-purple-400" nameKey="Hero's Wit" category="Experience" />
        },
        {
          id: 'asc_nboss', header: 'N.Boss',
          accessorFn: row => resolveCharacterMaterials(row)?.worldBoss?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.boss_material || 0) - (rowB.original.ascCosts?.boss_material || 0),
          filterFn: universalFilterFn,
          meta: { filterType: 'text', thClassName: "text-purple-400 text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.boss_material || 0} icon="👹" color="text-purple-400" nameKey={resolvedMats?.worldBoss?.name || ''} category="Normal Boss Material" />;
          }
        },
        {
          id: 'asc_local', header: 'Local',
          accessorFn: row => resolveCharacterMaterials(row)?.localSpecialty?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.local_specialty || 0) - (rowB.original.ascCosts?.local_specialty || 0),
          meta: { filterType: 'text', thClassName: "text-gray-400 text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.local_specialty || 0} icon="🌸" color="text-gray-400" nameKey={resolvedMats?.localSpecialty?.name || ''} category="Local Specialty" />;
          }
        },
        {
          id: 'asc_gem_5', header: 'Gemstone',
          accessorFn: row => resolveCharacterMaterials(row)?.gem?.tiers?.['4_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.gem_gemstone || 0) - (rowB.original.ascCosts?.gem_gemstone || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-[#FBBF24]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.gem_gemstone || 0} icon="💎" color="text-amber-400" nameKey={resolvedMats?.gem?.tiers?.['4_star']?.name} category="Character Ascension Gem" />;
          }
        },
        {
          id: 'asc_gem_4', header: 'Chunk',
          accessorFn: row => resolveCharacterMaterials(row)?.gem?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.gem_chunk || 0) - (rowB.original.ascCosts?.gem_chunk || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-[#A78BFA]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.gem_chunk || 0} icon="💎" color="text-purple-400" nameKey={resolvedMats?.gem?.tiers?.['3_star']?.name} category="Character Ascension Gem" />;
          }
        },
        {
          id: 'asc_gem_3', header: 'Fragment',
          accessorFn: row => resolveCharacterMaterials(row)?.gem?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.gem_fragment || 0) - (rowB.original.ascCosts?.gem_fragment || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-[#60A5FA]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.gem_fragment || 0} icon="💎" color="text-blue-400" nameKey={resolvedMats?.gem?.tiers?.['2_star']?.name} category="Character Ascension Gem" />;
          }
        },
        {
          id: 'asc_gem_2', header: 'Sliver',
          accessorFn: row => resolveCharacterMaterials(row)?.gem?.tiers?.['1_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.gem_sliver || 0) - (rowB.original.ascCosts?.gem_sliver || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-[#4ADE80]", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.gem_sliver || 0} icon="💎" color="text-green-400" nameKey={resolvedMats?.gem?.tiers?.['1_star']?.name} category="Character Ascension Gem" />;
          }
        },        {
          id: 'asc_enh3', header: 'Enh 3★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.['3_star_enemy_material'] || 0) - (rowB.original.ascCosts?.['3_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.['3_star_enemy_material'] || 0} icon="💧" color="text-blue-400" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'asc_enh2', header: 'Enh 2★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.['2_star_enemy_material'] || 0) - (rowB.original.ascCosts?.['2_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.['2_star_enemy_material'] || 0} icon="💧" color="text-green-400" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'asc_enh1', header: 'Enh 1★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['1_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.ascCosts?.['1_star_enemy_material'] || 0) - (rowB.original.ascCosts?.['1_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-gray-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.ascCosts?.['1_star_enemy_material'] || 0} icon="💧" color="text-gray-400" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'asc_stella', header: 'Stella', accessorFn: row => row.ascCosts?.masterless_stella_fortuna || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-amber-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.ascCosts?.masterless_stella_fortuna || 0} icon="⭐" color="text-amber-400" nameKey="Masterless Stella Fortuna" category="others" />
        },
        {
          id: 'asc_mora', header: 'Asc. Mora', accessorFn: row => row.ascCosts?.mora || 0,
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-right border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.ascCosts?.mora || 0} icon="🪙" color="text-blue-400" align="right" nameKey="Mora" category="Currency" />
        }
      ]
    },
    // ──────────────── TALENT REQUIREMENTS ────────────────
    {
      id: 'Talent Requirements',
      header: 'Talent Requirements',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'tal_4', header: 'Tal 4★',
          accessorFn: row => resolveCharacterMaterials(row)?.talent?.tiers?.['4_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['4_star_talent_material'] || 0) - (rowB.original.talentCosts?.['4_star_talent_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-purple-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => renderTalentCell(row, 4, 'purple-400', '📜')
        },
        {
          id: 'tal_3', header: 'Tal 3★',
          accessorFn: row => resolveCharacterMaterials(row)?.talent?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['3_star_talent_material'] || 0) - (rowB.original.talentCosts?.['3_star_talent_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => renderTalentCell(row, 3, 'blue-400', '📜')
        },
        {
          id: 'tal_2', header: 'Tal 2★',
          accessorFn: row => resolveCharacterMaterials(row)?.talent?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['2_star_talent_material'] || 0) - (rowB.original.talentCosts?.['2_star_talent_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => renderTalentCell(row, 2, 'green-400', '📜')
        },
        {
          id: 'tal_wk', header: 'Wk.Boss',
          accessorFn: row => resolveCharacterMaterials(row)?.weeklyBoss?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.weekly_boss_material || 0) - (rowB.original.talentCosts?.weekly_boss_material || 0),
          meta: { filterType: 'text', thClassName: "text-amber-400 text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.talentCosts?.weekly_boss_material || 0} icon="🐉" color="text-amber-400" nameKey={resolvedMats?.weeklyBoss?.name || ''} category="Weekly Boss Material" />;
          }
        },
        {
          id: 'tal_crown', header: 'Crown', accessorFn: row => row.talentCosts?.crown || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-amber-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.talentCosts?.crown || 0} icon="👑" color="text-amber-400" nameKey="Crown of Insight" category="Experience" />
        },
        {
          id: 'tal_enh3', header: 'Enh 3★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['3_star_enemy_material'] || 0) - (rowB.original.talentCosts?.['3_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.talentCosts?.['3_star_enemy_material'] || 0} icon="⚔️" color="text-blue-400" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'tal_enh2', header: 'Enh 2★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['2_star_enemy_material'] || 0) - (rowB.original.talentCosts?.['2_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.talentCosts?.['2_star_enemy_material'] || 0} icon="⚔️" color="text-green-400" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'tal_enh1', header: 'Enh 1★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['1_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.talentCosts?.['1_star_enemy_material'] || 0) - (rowB.original.talentCosts?.['1_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-gray-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={row.original.talentCosts?.['1_star_enemy_material'] || 0} icon="⚔️" color="text-gray-400" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'tal_na_mora', header: 'NA Mora', accessorFn: row => row.talentCosts?.mora_na || 0,
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-right" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2 text-blue-400">
              <span className="text-xs font-bold">{formatNumber(row.original.talentCosts?.mora_na || 0)}</span>
              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-6 h-6 object-contain shrink-0" />
            </div>
          )
        },
        {
          id: 'tal_skill_mora', header: 'Skill Mora', accessorFn: row => row.talentCosts?.mora_skill || 0,
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-right" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2 text-blue-400">
              <span className="text-xs font-bold">{formatNumber(row.original.talentCosts?.mora_skill || 0)}</span>
              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-6 h-6 object-contain shrink-0" />
            </div>
          )
        },
        {
          id: 'tal_burst_mora', header: 'Burst Mora', accessorFn: row => row.talentCosts?.mora_burst || 0,
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-right" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2 text-blue-400">
              <span className="text-xs font-bold">{formatNumber(row.original.talentCosts?.mora_burst || 0)}</span>
              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-6 h-6 object-contain shrink-0" />
            </div>
          )
        },
        {
          id: 'tal_mora', header: 'Talent Mora', accessorFn: row => row.talentCosts?.mora || 0,
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-right border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2 text-blue-400">
              <span className="text-xs font-bold">{formatNumber(row.original.talentCosts?.mora || 0)}</span>
              <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-6 h-6 object-contain shrink-0" />
            </div>
          )
        }
      ]
    },
    // ──────────────── GRAND TOTALS ────────────────
    {
      id: 'Grand Totals',
      header: 'Grand Totals',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-green-400 border-r border-[var(--border)]" },
      columns: [
        {
          id: 'grand_enh3', header: 'Enh 3★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => {
            const a = (rowA.original.ascCosts?.['3_star_enemy_material'] || 0) + (rowA.original.talentCosts?.['3_star_enemy_material'] || 0);
            const b = (rowB.original.ascCosts?.['3_star_enemy_material'] || 0) + (rowB.original.talentCosts?.['3_star_enemy_material'] || 0);
            return a - b;
          },
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const asc = row.original.ascCosts;
            const tal = row.original.talentCosts;
            const grandEnh3 = (asc?.['3_star_enemy_material'] || 0) + (tal?.['3_star_enemy_material'] || 0);
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={grandEnh3} icon="⚔️" color="text-blue-400" nameKey={resolvedMats?.enemy?.tiers?.['3_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'grand_enh2', header: 'Enh 2★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => {
            const a = (rowA.original.ascCosts?.['2_star_enemy_material'] || 0) + (rowA.original.talentCosts?.['2_star_enemy_material'] || 0);
            const b = (rowB.original.ascCosts?.['2_star_enemy_material'] || 0) + (rowB.original.talentCosts?.['2_star_enemy_material'] || 0);
            return a - b;
          },
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const asc = row.original.ascCosts;
            const tal = row.original.talentCosts;
            const grandEnh2 = (asc?.['2_star_enemy_material'] || 0) + (tal?.['2_star_enemy_material'] || 0);
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={grandEnh2} icon="⚔️" color="text-green-400" nameKey={resolvedMats?.enemy?.tiers?.['2_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'grand_enh1', header: 'Enh 1★',
          accessorFn: row => resolveCharacterMaterials(row)?.enemy?.tiers?.['1_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => {
            const a = (rowA.original.ascCosts?.['1_star_enemy_material'] || 0) + (rowA.original.talentCosts?.['1_star_enemy_material'] || 0);
            const b = (rowB.original.ascCosts?.['1_star_enemy_material'] || 0) + (rowB.original.talentCosts?.['1_star_enemy_material'] || 0);
            return a - b;
          },
          meta: { filterType: 'text', thClassName: "text-center px-2 py-2 font-semibold text-gray-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const asc = row.original.ascCosts;
            const tal = row.original.talentCosts;
            const grandEnh1 = (asc?.['1_star_enemy_material'] || 0) + (tal?.['1_star_enemy_material'] || 0);
            const resolvedMats = resolveCharacterMaterials(row.original);
            return <MatQuantity val={grandEnh1} icon="⚔️" color="text-[#9CA3AF]" nameKey={resolvedMats?.enemy?.tiers?.['1_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'grand_mora', header: 'Total Mora', accessorFn: row => (row.ascCosts?.mora || 0) + (row.talentCosts?.mora || 0),
          meta: { filterType: 'number', thClassName: "text-right px-2 py-2 font-semibold text-blue-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-right border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const asc = row.original.ascCosts;
            const tal = row.original.talentCosts;
            const grandMora = (asc?.mora || 0) + (tal?.mora || 0);
            return (
              <div className="flex items-center justify-end gap-2 text-blue-400">
                <span className="text-xs font-bold">{formatNumber(grandMora)}</span>
                <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/Mora.png" alt="Mora" className="w-6 h-6 object-contain shrink-0" />
              </div>
            );
          }
        },
        {
          id: 'actions',
          header: '',
          meta: { thClassName: "px-2 py-2", tdClassName: "px-4 py-2 text-center" }, enableSorting: false, enableColumnFilter: false,
          cell: ({ row }) => (
            <div className="flex justify-center" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => removeCharacter(row.original.name)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
              >
                ✕
              </button>
            </div>
          )
        }
      ]
    }
  ], [selectedNames, setSelectedNames, setEditingChar, updateCharacter, removeCharacter]);

  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md relative pb-10">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm border-collapse whitespace-nowrap min-w-max">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="bg-[var(--elevated)] border-b border-[var(--border)]">
                {headerGroup.headers.map((header) => {
                  const isInteractive = header.column.getCanSort() || header.column.getCanFilter();
                  const thClass = header.column.columnDef.meta?.thClassName || "";
                  
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`${thClass} relative ${isInteractive ? 'cursor-pointer hover:bg-[var(--surface)] transition-colors select-none' : ''}`}
                      onClick={(e) => {
                        if (isInteractive) {
                          e.stopPropagation();
                          if (activeMenu === header.column.id) {
                            setActiveMenu(null);
                            setMenuAnchorEl(null);
                          } else {
                            setActiveMenu(header.column.id);
                            setMenuAnchorEl(e.currentTarget);
                          }
                        }
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center justify-center gap-2 w-full h-full pointer-events-none">
                          <span className="truncate text-[11px]">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          
                          {header.column.getIsSorted() && (
                            <span className="text-[var(--gold)] text-[10px]">
                              {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                          
                          {header.column.getIsFiltered() && (
                            <span className="text-[var(--gold)] text-[10px]">●</span>
                          )}
                        </div>
                      )}
                      
                      {activeMenu === header.column.id && isInteractive && (
                        <UnifiedHeaderMenu column={header.column} table={table} closeMenu={() => { setActiveMenu(null); setMenuAnchorEl(null); }} anchorEl={menuAnchorEl} menuRef={menuRef} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx) => {
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] transition-colors ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                  onClick={() => setEditingChar(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const tdClass = cell.column.columnDef.meta?.tdClassName || "px-3 py-2 border-r border-[var(--border)]/50";
                    return (
                      <td key={cell.id} className={tdClass}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="p-8 text-center text-[var(--muted)]">No characters found matching current filters.</div>
        )}
      </div>
    </div>
  );
}

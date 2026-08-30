import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel, 
  flexRender 
} from '@tanstack/react-table';
import { ELEMENTS, WEAPON_TYPES, formatName, getInitials, getStars, getRarityClass, getRarityBg } from '../utils/gameData';
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon, getMaterialIcon } from '../utils/assetHelper';
import GenshinImage from './GenshinImage';
import useStore from '../store/useStore';
import MatQuantity from './MatQuantity';
import InlineNumberInput from './InlineNumberInput';
import { resolveWeaponMaterials } from '../utils/dataManager';
import { formatNumber, toggleMilestoneAscension, isMilestone } from '../utils/calculator';
import { universalFilterFn, UnifiedHeaderMenu } from './Table/UnifiedHeaderMenu';
import forgingData from '../data/weapon_forging.json';
import { calculateForgingCost } from '../utils/aggregator';
import weaponsData from '../data/weapons.json';

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

export default function WeaponsTable({
  data,
  selectedIds,
  setSelectedIds,
  setEditingWeapon,
  updateWeapon,
  removeWeapon
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
                   if (table.getFilteredRowModel().rows.length > 0 && selectedIds.length === table.getFilteredRowModel().rows.length) {
                     setSelectedIds([]);
                   } else {
                     setSelectedIds(table.getFilteredRowModel().rows.map(r => r.original.id));
                   }
                 }}>
              <input 
                type="checkbox" 
                checked={table.getFilteredRowModel().rows.length > 0 && selectedIds.length === table.getFilteredRowModel().rows.length}
                readOnly
                className="w-5 h-5 pointer-events-none rounded border-gray-600 bg-gray-800/50 text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="w-full h-full flex items-center justify-center cursor-pointer pointer-events-auto"
                 onClick={(e) => {
                   e.stopPropagation();
                   const id = row.original.id;
                   if (selectedIds.includes(id)) {
                     setSelectedIds(prev => prev.filter(n => n !== id));
                   } else {
                     setSelectedIds(prev => [...prev, id]);
                   }
                 }}>
              <input 
                type="checkbox" 
                checked={selectedIds.includes(row.original.id)}
                readOnly
                className="w-5 h-5 pointer-events-none rounded border-gray-600 bg-gray-800/50 text-blue-500 focus:ring-0 focus:ring-offset-0"
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
          id: 'weapon_name',
          header: 'Weapon',
          accessorFn: row => row.weaponName,
          meta: {
            filterType: 'text',
            thClassName: "text-left px-2 py-2 font-semibold sticky left-[112px] z-20 bg-[var(--surface)] w-[200px] min-w-[200px] max-w-[200px]",
            tdClassName: "px-4 py-2 sticky left-[112px] z-10 bg-inherit border-r border-transparent w-[200px] min-w-[200px] max-w-[200px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const wp = row.original;
            return (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow relative overflow-hidden ${getRarityBg(wp.data?.rarity)}`}>
                  <GenshinImage 
                    src={getWeaponIcon(wp.weaponName)} 
                    alt={wp.weaponName} 
                    className="w-8 h-8 object-contain absolute inset-0 m-auto z-10" 
                    fallback={<span className="text-xs relative z-10 text-white drop-shadow-md">{getInitials(wp.weaponName)}</span>} 
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`font-bold text-sm truncate ${getRarityColorClass(wp.data?.rarity)}`}>{formatName(wp.weaponName)}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${getRarityClass(wp.data?.rarity)}`}>{getStars(wp.data?.rarity)}</span>
                  </div>
                </div>
              </div>
            );
          }
        },
        {
          id: 'weapon_type',
          header: 'Type',
          accessorFn: row => row.data?.type || 'Unknown',
          meta: {
            filterType: 'text',
            thClassName: "text-center px-2 py-2 font-semibold sticky left-[312px] z-20 bg-[var(--surface)] w-[82px] min-w-[82px] max-w-[82px]",
            tdClassName: "px-4 py-2 text-center sticky left-[312px] z-10 bg-inherit w-[82px] min-w-[82px] max-w-[82px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const type = row.getValue('weapon_type');
            const wpCfg = WEAPON_TYPES[type] || { emoji: '⚔️' };
            return (
              <div className="flex justify-center" title={type}>
                <GenshinImage src={getWeaponTypeIcon(type)} alt={type} className="w-6 h-6 object-contain opacity-80" fallback={<span>{wpCfg.emoji}</span>} />
              </div>
            );
          }
        },
        {
          id: 'equipped_char',
          header: 'Equipped',
          accessorFn: row => row.assignedTo || 'None',
          meta: {
            filterType: 'text',
            thClassName: "text-left px-2 py-2 font-semibold sticky left-[394px] z-20 bg-[var(--surface)] border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.5)]",
            tdClassName: "px-4 py-2 sticky left-[394px] z-10 bg-inherit border-r border-[var(--border)] w-[160px] min-w-[160px] max-w-[160px] cursor-pointer"
          },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const assignedTo = row.getValue('equipped_char');
            if (!assignedTo || assignedTo === 'None') return <span className="text-[var(--muted)] opacity-50 italic text-xs">Unassigned</span>;
            const assignedChar = row.original.assignedChar;
            const elCfg = assignedChar ? (ELEMENTS[assignedChar.element] || ELEMENTS.Unknown) : null;
            return (
              <div className="flex items-center gap-2 overflow-hidden">
                <GenshinImage src={getCharacterAvatar(assignedTo)} alt={assignedTo} className="w-6 h-6 rounded-full object-cover shrink-0 border border-gray-700" fallback={<span className="text-xs text-[var(--muted)]">{getInitials(assignedTo)}</span>} />
                <span className={`text-xs truncate ${getRarityColorClass(assignedChar?.rarity)}`}>{assignedTo}</span>
              </div>
            );
          }
        }
      ]
    },
    // ──────────────── STATE ────────────────
    {
      id: 'State',
      header: 'State',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[var(--muted)] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'current_lv', header: 'Lv', accessorFn: row => row.level ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const wp = row.original;
            const level = getValue();
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={level} min={1} max={90} onChangeSubmit={(val) => updateWeapon(wp.id, { level: val })} className="text-xs text-[var(--text)]" />
                {isAscended(level, wp.ascension ?? 0) && level < 90 && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Ascended" className={`w-3 h-3 object-contain ml-1 select-none transition-colors ${isMilestone(level) ? 'cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-100' : 'cursor-default text-white/30 opacity-80'}`} onClick={(e) => { e.stopPropagation(); if (isMilestone(level)) updateWeapon(wp.id, { ascension: toggleMilestoneAscension(level, wp.ascension ?? 0) }); }} />
                )}
                {!isAscended(level, wp.ascension ?? 0) && isMilestone(level) && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Unascended" className="w-3 h-3 object-contain ml-1 select-none transition-colors cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-50 grayscale" onClick={(e) => { e.stopPropagation(); updateWeapon(wp.id, { ascension: toggleMilestoneAscension(level, wp.ascension ?? 0) }); }} />
                )}
              </div>
            );
          }
        },
        {
          id: 'current_refine', header: 'R', accessorFn: row => row.currentRefinement ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-blue-300", tdClassName: "px-3 py-2 text-center" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const wp = row.original;
            const refine = getValue();
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={refine} min={0} max={5} onChangeSubmit={(val) => updateWeapon(wp.id, { currentRefinement: val })} className="text-xs text-blue-300" />
              </div>
            );
          }
        },
        {
          id: 'target_lv', header: '→ Lv', accessorFn: row => row.targetLevel ?? 90,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const wp = row.original;
            const level = getValue();
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={level} min={1} max={90} onChangeSubmit={(val) => updateWeapon(wp.id, { targetLevel: val })} className="text-xs text-[var(--gold)]" />
                {isAscended(level, wp.targetAscension ?? 6) && level < 90 && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Ascended" className={`w-3 h-3 object-contain ml-1 select-none transition-colors ${isMilestone(level) ? 'cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-100' : 'cursor-default text-white/30 opacity-80'}`} onClick={(e) => { e.stopPropagation(); if (isMilestone(level)) updateWeapon(wp.id, { targetAscension: toggleMilestoneAscension(level, wp.targetAscension ?? 6) }); }} />
                )}
                {!isAscended(level, wp.targetAscension ?? 6) && isMilestone(level) && (
                  <img src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png" alt="Unascended" className="w-3 h-3 object-contain ml-1 select-none transition-colors cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-50 grayscale" onClick={(e) => { e.stopPropagation(); updateWeapon(wp.id, { targetAscension: toggleMilestoneAscension(level, wp.targetAscension ?? 6) }); }} />
                )}
              </div>
            );
          }
        },
        {
          id: 'target_refine', header: '→ R', accessorFn: row => row.targetRefinement ?? 1,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-[var(--gold)] border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" },
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row, getValue }) => {
            const wp = row.original;
            const refine = getValue();
            const originalWeapon = weaponsData.find(w => w.name === wp.weaponName);
            const isCraftable = originalWeapon ? !!(forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : false;
            if (!isCraftable) return <span className="text-gray-500/50 text-xs" title="Not a craftable weapon">—</span>;
            return (
              <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                <InlineNumberInput value={refine} min={0} max={5} onChangeSubmit={(val) => updateWeapon(wp.id, { targetRefinement: val })} className="text-xs text-[var(--gold)]" />
              </div>
            );
          }
        }
      ]
    },
    // ──────────────── FORGING ────────────────
    {
      id: 'Forging',
      header: 'Forging',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#d8b575] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'forging_billet', header: 'Billet', 
          accessorFn: row => {
            const originalWeapon = weaponsData.find(w => w.name === row.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            return recipe?.billet?.name || 'Unknown';
          },
          sortingFn: (rowA, rowB) => {
            const originalA = weaponsData.find(w => w.name === rowA.original.weaponName);
            const originalB = weaponsData.find(w => w.name === rowB.original.weaponName);
            const recipeA = originalA ? (forgingData[originalA.id] || forgingData[originalA.name]) : null;
            const recipeB = originalB ? (forgingData[originalB.id] || forgingData[originalB.name]) : null;
            const costA = calculateForgingCost(rowA.original, rowA.original.currentRefinement ?? 1, rowA.original.targetRefinement ?? 1, forgingData);
            const costB = calculateForgingCost(rowB.original, rowB.original.currentRefinement ?? 1, rowB.original.targetRefinement ?? 1, forgingData);
            return (recipeA && costA[recipeA.billet.id] ? costA[recipeA.billet.id] : 0) - (recipeB && costB[recipeB.billet.id] ? costB[recipeB.billet.id] : 0);
          },
          meta: { filterType: 'text', thClassName: "text-amber-300 px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" }, 
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const originalWeapon = weaponsData.find(w => w.name === row.original.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            if (!recipe) return <span className="text-gray-500/50 text-xs">—</span>;
            const cost = calculateForgingCost(row.original, row.original.currentRefinement ?? 1, row.original.targetRefinement ?? 1, forgingData);
            if (!cost[recipe.billet.id]) return <span className="text-gray-500/50 text-xs">—</span>;
            return <MatQuantity val={cost[recipe.billet.id]} icon="📜" color="text-amber-300" nameKey={recipe.billet.name} category="billet" />;
          }
        },
        {
          id: 'forging_ore_regional', header: 'Regional Ore', 
          accessorFn: row => {
            const originalWeapon = weaponsData.find(w => w.name === row.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            return recipe?.ores?.find(o => o.kind === 'regional')?.name || 'Unknown';
          },
          sortingFn: (rowA, rowB) => {
            const originalA = weaponsData.find(w => w.name === rowA.original.weaponName);
            const originalB = weaponsData.find(w => w.name === rowB.original.weaponName);
            const recipeA = originalA ? (forgingData[originalA.id] || forgingData[originalA.name]) : null;
            const recipeB = originalB ? (forgingData[originalB.id] || forgingData[originalB.name]) : null;
            const costA = calculateForgingCost(rowA.original, rowA.original.currentRefinement ?? 1, rowA.original.targetRefinement ?? 1, forgingData);
            const costB = calculateForgingCost(rowB.original, rowB.original.currentRefinement ?? 1, rowB.original.targetRefinement ?? 1, forgingData);
            const oreA = recipeA?.ores?.find(o => o.kind === 'regional');
            const oreB = recipeB?.ores?.find(o => o.kind === 'regional');
            return (oreA && costA[oreA.id] ? costA[oreA.id] : 0) - (oreB && costB[oreB.id] ? costB[oreB.id] : 0);
          },
          meta: { filterType: 'text', thClassName: "text-purple-300 px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" }, 
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const originalWeapon = weaponsData.find(w => w.name === row.original.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            if (!recipe || !recipe.ores) return <span className="text-gray-500/50 text-xs">—</span>;
            const cost = calculateForgingCost(row.original, row.original.currentRefinement ?? 1, row.original.targetRefinement ?? 1, forgingData);
            const ore = recipe.ores.find(o => o.kind === 'regional');
            if (!ore || !cost[ore.id]) return <span className="text-gray-500/50 text-xs">—</span>;
            return <MatQuantity val={cost[ore.id]} icon="💎" color="text-purple-300" nameKey={ore.name} category="forgingOre" />;
          }
        },
        {
          id: 'forging_ore_common', header: 'Common Ore', 
          accessorFn: row => {
            const originalWeapon = weaponsData.find(w => w.name === row.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            return recipe?.ores?.find(o => o.kind === 'common')?.name || 'Unknown';
          },
          sortingFn: (rowA, rowB) => {
            const originalA = weaponsData.find(w => w.name === rowA.original.weaponName);
            const originalB = weaponsData.find(w => w.name === rowB.original.weaponName);
            const recipeA = originalA ? (forgingData[originalA.id] || forgingData[originalA.name]) : null;
            const recipeB = originalB ? (forgingData[originalB.id] || forgingData[originalB.name]) : null;
            const costA = calculateForgingCost(rowA.original, rowA.original.currentRefinement ?? 1, rowA.original.targetRefinement ?? 1, forgingData);
            const costB = calculateForgingCost(rowB.original, rowB.original.currentRefinement ?? 1, rowB.original.targetRefinement ?? 1, forgingData);
            const oreA = recipeA?.ores?.find(o => o.kind === 'common');
            const oreB = recipeB?.ores?.find(o => o.kind === 'common');
            return (oreA && costA[oreA.id] ? costA[oreA.id] : 0) - (oreB && costB[oreB.id] ? costB[oreB.id] : 0);
          },
          meta: { filterType: 'text', thClassName: "text-blue-300 px-2 py-2 font-semibold", tdClassName: "px-3 py-2 text-center" }, 
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const originalWeapon = weaponsData.find(w => w.name === row.original.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            if (!recipe || !recipe.ores) return <span className="text-gray-500/50 text-xs">—</span>;
            const cost = calculateForgingCost(row.original, row.original.currentRefinement ?? 1, row.original.targetRefinement ?? 1, forgingData);
            const ore = recipe.ores.find(o => o.kind === 'common');
            if (!ore || !cost[ore.id]) return <span className="text-gray-500/50 text-xs">—</span>;
            return <MatQuantity val={cost[ore.id]} icon="💎" color="text-blue-300" nameKey={ore.name} category="forgingOre" />;
          }
        },
        {
          id: 'forging_mora', header: 'Mora', 
          accessorFn: row => {
            const originalWeapon = weaponsData.find(w => w.name === row.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            if (!recipe || !recipe.mora) return 0;
            const cost = calculateForgingCost(row, row.currentRefinement ?? 1, row.targetRefinement ?? 1, forgingData);
            return cost['mora'] || 0;
          },
          meta: { filterType: 'number', thClassName: "text-yellow-400 px-2 py-2 font-semibold border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" }, 
          enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const originalWeapon = weaponsData.find(w => w.name === row.original.weaponName);
            const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
            if (!recipe) return <span className="text-gray-500/50 text-xs">—</span>;
            const cost = calculateForgingCost(row.original, row.original.currentRefinement ?? 1, row.original.targetRefinement ?? 1, forgingData);
            if (!cost['mora']) return <span className="text-gray-500/50 text-xs">—</span>;
            return <MatQuantity val={cost['mora']} icon="🪙" color="text-yellow-400" align="right" nameKey="Mora" category="Currency" />;
          }
        }
      ]
    },
    // ──────────────── ENHANCEMENT ────────────────

    {
      id: 'Enhancement',
      header: 'Enhancement',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'mystic_ore', header: 'Mystic Ore', accessorFn: row => row.costs?.mystic_ore || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.costs?.mystic_ore || 0} icon="🔮" color="text-blue-400" nameKey="Mystic Enhancement Ore" category="Experience" />
        },
        {
          id: 'fine_ore', header: 'Fine Ore', accessorFn: row => row.costs?.fine_ore || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.costs?.fine_ore || 0} icon="🔮" color="text-green-400" nameKey="Fine Enhancement Ore" category="Experience" />
        },
        {
          id: 'normal_ore', header: 'Normal Ore', accessorFn: row => row.costs?.normal_ore || 0,
          meta: { filterType: 'number', thClassName: "text-center px-2 py-2 font-semibold text-gray-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.costs?.normal_ore || 0} icon="🔮" color="text-gray-400" nameKey="Enhancement Ore" category="Experience" />
        },
        {
          id: 'wasted_exp', header: 'Wasted EXP', accessorFn: row => row.costs?.wasted_exp || 0,
          meta: { filterType: 'number', thClassName: "text-gray-400 px-2 py-2 font-semibold text-gray-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.costs?.wasted_exp || 0} icon="🗑️" color="text-gray-400" />
        },
        {
          id: 'total_mora', header: 'Mora', accessorFn: row => row.costs?.total_mora || 0,
          meta: { filterType: 'number', thClassName: "text-blue-400 px-2 py-2 font-semibold text-blue-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-right border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => <MatQuantity val={row.original.costs?.total_mora || 0} icon="🪙" color="text-blue-400" align="right" nameKey="Mora" category="Currency" />
        }
      ]
    },
    // ──────────────── ASCENSION ────────────────
    {
      id: 'Ascension',
      header: 'Weapon Ascension Material',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-blue-400 border-r border-[var(--border)]" },
      columns: [
        {
          id: 'asc_5', header: 'Asc 5★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.ascensionFamily?.tiers?.['5_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['5_star_ascension_material'] || 0) - (rowB.original.costs?.['5_star_ascension_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-amber-400 px-2 py-2 font-semibold text-amber-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['5_star_ascension_material'] || 0} icon="🛡️" color="text-amber-400" nameKey={resolvedMats?.ascensionFamily?.tiers?.['5_star']?.name} category="Weapon Ascension Material" />;
          }
        },
        {
          id: 'asc_4', header: 'Asc 4★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.ascensionFamily?.tiers?.['4_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['4_star_ascension_material'] || 0) - (rowB.original.costs?.['4_star_ascension_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-purple-400 px-2 py-2 font-semibold text-purple-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['4_star_ascension_material'] || 0} icon="🛡️" color="text-purple-400" nameKey={resolvedMats?.ascensionFamily?.tiers?.['4_star']?.name} category="Weapon Ascension Material" />;
          }
        },
        {
          id: 'asc_3', header: 'Asc 3★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.ascensionFamily?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['3_star_ascension_material'] || 0) - (rowB.original.costs?.['3_star_ascension_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-blue-400 px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['3_star_ascension_material'] || 0} icon="🛡️" color="text-blue-400" nameKey={resolvedMats?.ascensionFamily?.tiers?.['3_star']?.name} category="Weapon Ascension Material" />;
          }
        },
        {
          id: 'asc_2', header: 'Asc 2★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.ascensionFamily?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['2_star_ascension_material'] || 0) - (rowB.original.costs?.['2_star_ascension_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-green-400 px-2 py-2 font-semibold text-green-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['2_star_ascension_material'] || 0} icon="🛡️" color="text-green-400" nameKey={resolvedMats?.ascensionFamily?.tiers?.['2_star']?.name} category="Weapon Ascension Material" />;
          }
        }
      ]
    },
    // ──────────────── ELITE ────────────────
    {
      id: 'Elite',
      header: 'Elite Enhancement Material',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'elite_4', header: 'Elite 4★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.eliteFamily?.tiers?.['4_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['4_star_enhancement_material'] || 0) - (rowB.original.costs?.['4_star_enhancement_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-purple-400 px-2 py-2 font-semibold text-purple-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['4_star_enhancement_material'] || 0} icon="⚔️" color="text-purple-400" nameKey={resolvedMats?.eliteFamily?.tiers?.['4_star']?.name} category="Elite Enhancement Material" />;
          }
        },
        {
          id: 'elite_3', header: 'Elite 3★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.eliteFamily?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['3_star_enhancement_material'] || 0) - (rowB.original.costs?.['3_star_enhancement_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-blue-400 px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['3_star_enhancement_material'] || 0} icon="⚔️" color="text-blue-400" nameKey={resolvedMats?.eliteFamily?.tiers?.['3_star']?.name} category="Elite Enhancement Material" />;
          }
        },
        {
          id: 'elite_2', header: 'Elite 2★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.eliteFamily?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['2_star_enhancement_material'] || 0) - (rowB.original.costs?.['2_star_enhancement_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-green-400 px-2 py-2 font-semibold text-green-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['2_star_enhancement_material'] || 0} icon="⚔️" color="text-green-400" nameKey={resolvedMats?.eliteFamily?.tiers?.['2_star']?.name} category="Elite Enhancement Material" />;
          }
        }
      ]
    },
    // ──────────────── COMMON ────────────────
    {
      id: 'Common',
      header: 'Common Enhancement Material',
      meta: { thClassName: "px-2 py-2 text-center text-xs uppercase tracking-widest text-[#A07840] border-r border-[var(--border)]" },
      columns: [
        {
          id: 'mob_3', header: 'Enh 3★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.commonFamily?.tiers?.['3_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['3_star_enemy_material'] || 0) - (rowB.original.costs?.['3_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-blue-400 px-2 py-2 font-semibold text-blue-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['3_star_enemy_material'] || 0} icon="💧" color="text-blue-400" nameKey={resolvedMats?.commonFamily?.tiers?.['3_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'mob_2', header: 'Enh 2★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.commonFamily?.tiers?.['2_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['2_star_enemy_material'] || 0) - (rowB.original.costs?.['2_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-green-400 px-2 py-2 font-semibold text-green-400", tdClassName: "px-3 py-2 text-center" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['2_star_enemy_material'] || 0} icon="💧" color="text-green-400" nameKey={resolvedMats?.commonFamily?.tiers?.['2_star']?.name} category="Common Enhancement Material" />;
          }
        },
        {
          id: 'mob_1', header: 'Enh 1★',
          accessorFn: row => resolveWeaponMaterials(row.data)?.commonFamily?.tiers?.['1_star']?.name || 'Unknown',
          sortingFn: (rowA, rowB) => (rowA.original.costs?.['1_star_enemy_material'] || 0) - (rowB.original.costs?.['1_star_enemy_material'] || 0),
          meta: { filterType: 'text', thClassName: "text-gray-400 px-2 py-2 font-semibold text-gray-400 border-r border-[var(--border)]", tdClassName: "px-3 py-2 text-center border-r border-[var(--border)]" }, enableSorting: true, enableColumnFilter: true, filterFn: universalFilterFn,
          cell: ({ row }) => {
            const resolvedMats = resolveWeaponMaterials(row.original.data);
            return <MatQuantity val={row.original.costs?.['1_star_enemy_material'] || 0} icon="💧" color="text-gray-400" nameKey={resolvedMats?.commonFamily?.tiers?.['1_star']?.name} category="Common Enhancement Material" />;
          }
        }
      ]
    }
  ], [selectedIds, setSelectedIds, setEditingWeapon, updateWeapon, removeWeapon]);

  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const roster = useStore(state => state.roster);

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

  const totals = useMemo(() => {
    const sums = {
      costs: {},
      forging: {}
    };
    
    const add = (target, key, val) => {
      if (!val) return;
      target[key] = (target[key] || 0) + val;
    };

    table.getRowModel().rows.forEach(r => {
      const costs = r.original.costs || {};
      Object.entries(costs).forEach(([k, v]) => add(sums.costs, k, v));

      const forgeCost = calculateForgingCost(r.original, r.original.currentRefinement ?? 1, r.original.targetRefinement ?? 1, forgingData);
      const originalWeapon = weaponsData.find(w => w.name === r.original.weaponName);
      const recipe = originalWeapon ? (forgingData[originalWeapon.id] || forgingData[originalWeapon.name]) : null;
      Object.entries(forgeCost).forEach(([k, v]) => {
        add(sums.forging, k, v);
        if (recipe && recipe.ores) {
          const oreItem = recipe.ores.find(o => o.id === k);
          if (oreItem) {
            if (oreItem.kind === 'regional') add(sums, 'forging_regional_total', v);
            if (oreItem.kind === 'common') add(sums, 'forging_common_total', v);
          }
        }
      });
    });

    return sums;
  }, [table.getRowModel().rows]);

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
                <th className="px-4 py-2 border-b border-[var(--border)]"></th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 && (
              <tr className="bg-[var(--surface)] font-bold border-b-2 border-slate-600 sticky top-0 z-10 shadow-sm pointer-events-none">
                {table.getVisibleLeafColumns().map((column) => {
                  const tdClass = column.columnDef.meta?.tdClassName || "px-3 py-2 border-r border-[var(--border)]/50";
                  
                  if (column.id === 'weapon_name') {
                    return <td key={column.id} className={`${tdClass} text-right pr-4`}><span className="text-amber-400 text-sm tracking-widest font-bold">TOTALS</span></td>;
                  }
                  
                  const isIdentity = ['select', 'sl', 'type', 'rarity', 'current_lv', 'target_lv'].includes(column.id);
                  if (isIdentity) {
                    return <td key={column.id} className={tdClass}></td>;
                  }

                  const renderTotalItem = (val, iconOrNameKey, colorClass, isGameIcon, align = 'center') => {
                    const justify = align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center';
                    const imgContent = isGameIcon 
                      ? <GenshinImage src={getMaterialIcon(iconOrNameKey, 'others')} alt={iconOrNameKey} className="w-6 h-6 object-contain shrink-0" />
                      : <span className="text-[14px] leading-none">{iconOrNameKey}</span>;
                      
                    return (
                      <div className={`flex items-center ${justify} gap-1.5 text-xs font-bold ${colorClass}`}>
                        {align === 'right' ? (
                          <><span>{formatNumber(val)}</span>{imgContent}</>
                        ) : (
                          <>{imgContent}<span>{formatNumber(val)}</span></>
                        )}
                      </div>
                    );
                  };

                  let cellContent = null;
                  switch(column.id) {
                    // Forging (Summed by iterating the available materials)
                    case 'forging_billet': {
                      const matEntries = Object.entries(totals.forging).filter(([k,v]) => k.includes('billet'));
                      if (matEntries.length > 0) {
                        const total = matEntries.reduce((acc, [k, v]) => acc + v, 0);
                        cellContent = renderTotalItem(total, '📜', 'text-amber-300', false);
                      }
                      break;
                    }
                    case 'forging_ore_regional': {
                      if (totals.forging_regional_total > 0) {
                        cellContent = renderTotalItem(totals.forging_regional_total, '💎', 'text-purple-300', false);
                      }
                      break;
                    }
                    case 'forging_ore_common': {
                      if (totals.forging_common_total > 0) {
                        cellContent = renderTotalItem(totals.forging_common_total, 'WhiteIronChunk', 'text-blue-300', true);
                      }
                      break;
                    }
                    case 'forging_mora': {
                      if (totals.forging['mora']) {
                        cellContent = renderTotalItem(totals.forging['mora'], 'Mora', 'text-yellow-400', true, 'right');
                      }
                      break;
                    }
                    case 'mystic_ore': cellContent = renderTotalItem(totals.costs.mystic_ore, 'MysticEnhancementOre', 'text-blue-400', true); break;
                    case 'fine_ore': cellContent = renderTotalItem(totals.costs.fine_ore, 'FineEnhancementOre', 'text-green-400', true); break;
                    case 'normal_ore': cellContent = renderTotalItem(totals.costs.normal_ore, 'EnhancementOre', 'text-gray-400', true); break;
                    case 'wasted_exp': cellContent = renderTotalItem(totals.costs.wasted_exp, '🗑️', 'text-gray-400', false); break;
                    case 'total_mora': cellContent = renderTotalItem(totals.costs.total_mora, 'Mora', 'text-blue-400', true, 'right'); break;
                    case 'asc_5': cellContent = renderTotalItem(totals.costs['5_star_ascension_material'], '🏺', 'text-amber-400', false); break;
                    case 'asc_4': cellContent = renderTotalItem(totals.costs['4_star_ascension_material'], '🏺', 'text-purple-400', false); break;
                    case 'asc_3': cellContent = renderTotalItem(totals.costs['3_star_ascension_material'], '🏺', 'text-blue-400', false); break;
                    case 'asc_2': cellContent = renderTotalItem(totals.costs['2_star_ascension_material'], '🏺', 'text-green-400', false); break;
                    case 'elite_4': cellContent = renderTotalItem(totals.costs['4_star_enhancement_material'], '⚔️', 'text-purple-400', false); break;
                    case 'elite_3': cellContent = renderTotalItem(totals.costs['3_star_enhancement_material'], '⚔️', 'text-blue-400', false); break;
                    case 'elite_2': cellContent = renderTotalItem(totals.costs['2_star_enhancement_material'], '⚔️', 'text-green-400', false); break;
                    case 'mob_3': cellContent = renderTotalItem(totals.costs['3_star_enemy_material'], '🎭', 'text-blue-400', false); break;
                    case 'mob_2': cellContent = renderTotalItem(totals.costs['2_star_enemy_material'], '🎭', 'text-green-400', false); break;
                    case 'mob_1': cellContent = renderTotalItem(totals.costs['1_star_enemy_material'], '🎭', 'text-gray-400', false); break;
                    default: cellContent = null;
                  }

                  return (
                    <td key={column.id} className={tdClass}>
                      {cellContent}
                    </td>
                  );
                })}
                <td className="px-4 py-2 border-b border-[var(--border)]"></td>
              </tr>
            )}
            {table.getRowModel().rows.map((row, idx) => {
              return (
                <tr 
                  key={row.id} 
                  className={`border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--elevated)] cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'}`}
                  onClick={() => setEditingWeapon(row.original)}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={cell.column.columnDef.meta?.tdClassName || ""}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeWeapon(row.original.id); }}
                      className="text-red-400 hover:text-red-300 p-1 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.reduce((acc, g) => acc + (g.columns ? g.columns.length : 1), 1)} className="px-6 py-8 text-center text-[var(--muted)]">
                  No weapons match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender
} from '@tanstack/react-table';
import { getMaterialIcon } from '../utils/assetHelper';
import GenshinImage from './GenshinImage';
import { formatNumber } from '../utils/calculator';
import { UnifiedHeaderMenu } from './Table/UnifiedHeaderMenu';
import forgingData from '../data/weapon_forging.json';
import { calculateForgingCost } from '../utils/aggregator';
import weaponsData from '../data/weapons.json';
import useWeaponColumns from './Table/weapons/useWeaponColumns';

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

  const columns = useWeaponColumns({
    selectedIds,
    setSelectedIds,
    updateWeapon,
    removeWeapon
  });

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

                  const isIdentity = ['select', 'sl', 'weapon_type', 'equipped_char', 'current_lv', 'target_lv', 'current_refine', 'target_refine'].includes(column.id);
                  if (isIdentity) {
                    return <td key={column.id} className={tdClass}></td>;
                  }

                  const renderTotalItem = (val, iconOrNameKey, colorClass, isGameIcon, align = 'center') => {
                    const justify = align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center';
                    const imgContent = typeof iconOrNameKey === 'string' && iconOrNameKey.includes('.png')
                      ? <img src={iconOrNameKey} alt="icon" className="w-5 h-5 object-contain shrink-0 drop-shadow-md" />
                      : isGameIcon
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
                        cellContent = renderTotalItem(total, '/Forging.png', 'text-amber-300', false);
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
                    case 'asc_5': cellContent = renderTotalItem(totals.costs['5_star_ascension_material'], '/WeaponAscMats.png', 'text-amber-400', false); break;
                    case 'asc_4': cellContent = renderTotalItem(totals.costs['4_star_ascension_material'], '/WeaponAscMats.png', 'text-purple-400', false); break;
                    case 'asc_3': cellContent = renderTotalItem(totals.costs['3_star_ascension_material'], '/WeaponAscMats.png', 'text-blue-400', false); break;
                    case 'asc_2': cellContent = renderTotalItem(totals.costs['2_star_ascension_material'], '/WeaponAscMats.png', 'text-green-400', false); break;
                    case 'elite_4': cellContent = renderTotalItem(totals.costs['4_star_enhancement_material'], '/EliteEnemy.png', 'text-purple-400', false); break;
                    case 'elite_3': cellContent = renderTotalItem(totals.costs['3_star_enhancement_material'], '/EliteEnemy.png', 'text-blue-400', false); break;
                    case 'elite_2': cellContent = renderTotalItem(totals.costs['2_star_enhancement_material'], '/EliteEnemy.png', 'text-green-400', false); break;
                    case 'mob_3': cellContent = renderTotalItem(totals.costs['3_star_enemy_material'], '/CommonEnemy.png', 'text-blue-400', false); break;
                    case 'mob_2': cellContent = renderTotalItem(totals.costs['2_star_enemy_material'], '/CommonEnemy.png', 'text-green-400', false); break;
                    case 'mob_1': cellContent = renderTotalItem(totals.costs['1_star_enemy_material'], '/CommonEnemy.png', 'text-gray-400', false); break;
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

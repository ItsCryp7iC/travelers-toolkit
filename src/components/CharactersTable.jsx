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
import useCharacterColumns from './Table/characters/useCharacterColumns';
import { FloatingHorizontalScrollbar } from './Table/FloatingHorizontalScrollbar';

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
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setActiveMenu(null);
      setMenuAnchorEl(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const columns = useCharacterColumns({
    selectedNames,
    setSelectedNames,
    updateCharacter,
    removeCharacter
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
      ascCosts: {},
      talentCosts: {}
    };

    const add = (target, key, val) => {
      if (!val) return;
      target[key] = (target[key] || 0) + val;
    };

    table.getRowModel().rows.forEach(r => {
       const asc = r.original.ascCosts || {};
       const tal = r.original.talentCosts || {};

       Object.entries(asc).forEach(([k, v]) => add(sums.ascCosts, k, v));

       const isTraveler = !!r.original.materials?.talent_material_family_ids;
       const filterValue = table.getColumn('tal_4')?.getFilterValue();
       const hasActiveFilter = filterValue && (filterValue.text || (filterValue.selection && filterValue.selection.length > 0));
       let specificFilters = [];

       if (isTraveler && hasActiveFilter) {
          const families = r.original.materials.talent_material_family_ids;
          specificFilters = families.filter(f => {
             const matchesSelection = filterValue.selection && filterValue.selection.some(s => s.includes(f));
             const matchesText = filterValue.text && f.toLowerCase().includes(filterValue.text.toLowerCase());
             return matchesSelection || matchesText;
          });
       }
       const familiesToRender = (isTraveler && hasActiveFilter) ? specificFilters : (r.original.materials?.talent_material_family_ids || []);

       Object.entries(tal).forEach(([k, v]) => {
          if (!isTraveler) {
             add(sums.talentCosts, k, v);
          } else {
             if (!k.includes('_star_talent_material')) {
                add(sums.talentCosts, k, v);
                return;
             }

             let shouldInclude = false;
             let genericKey = '';
             familiesToRender.forEach(f => {
                if (k.startsWith(`${f}_4_star`)) { shouldInclude = true; genericKey = '4_star_talent_material'; }
                if (k.startsWith(`${f}_3_star`)) { shouldInclude = true; genericKey = '3_star_talent_material'; }
                if (k.startsWith(`${f}_2_star`)) { shouldInclude = true; genericKey = '2_star_talent_material'; }
             });

             if (shouldInclude) {
               add(sums.talentCosts, genericKey, sums.talentCosts[k]);
             }
             delete sums.talentCosts[k];
          }
       });
    });

    return sums;
  }, [table.getRowModel().rows]);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md relative pb-10">
      <div className="overflow-x-auto custom-scrollbar table-horizontal-scroll-source" ref={scrollContainerRef}>
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
            {table.getRowModel().rows.length > 0 && (
              <tr className="bg-[var(--surface)] font-bold border-b-2 border-slate-600 sticky top-0 z-10 shadow-sm pointer-events-none">
                {table.getVisibleLeafColumns().map((column) => {
                  const tdClass = column.columnDef.meta?.tdClassName || "px-3 py-2 border-r border-[var(--border)]/50";

                  if (column.id === 'character') {
                    return <td key={column.id} className={`${tdClass} text-right pr-4`}><span className="text-amber-400 text-sm tracking-widest font-bold">TOTALS</span></td>;
                  }

                  const isIdentity = ['select', 'sl', 'element', 'weapon', 'equipped', 'current_lv', 'current_na', 'current_skill', 'current_burst', 'target_lv', 'target_na', 'target_skill', 'target_burst'].includes(column.id);
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
                    case 'asc_wit': cellContent = renderTotalItem(totals.ascCosts.heros_wit, 'HerosWit', 'text-purple-400', true); break;
                    case 'asc_nboss': cellContent = renderTotalItem(totals.ascCosts.boss_material, '/NormalBoss.png', 'text-purple-400', false); break;
                    case 'asc_local': cellContent = renderTotalItem(totals.ascCosts.local_specialty, '/LocalSpecialties.png', 'text-gray-400', false); break;
                    case 'asc_gem_5': cellContent = renderTotalItem(totals.ascCosts.gem_gemstone, '/Gems.png', 'text-amber-400', false); break;
                    case 'asc_gem_4': cellContent = renderTotalItem(totals.ascCosts.gem_chunk, '/Gems.png', 'text-purple-400', false); break;
                    case 'asc_gem_3': cellContent = renderTotalItem(totals.ascCosts.gem_fragment, '/Gems.png', 'text-blue-400', false); break;
                    case 'asc_gem_2': cellContent = renderTotalItem(totals.ascCosts.gem_sliver, '/Gems.png', 'text-green-400', false); break;
                    case 'asc_enh3': cellContent = renderTotalItem(totals.ascCosts['3_star_enemy_material'], '/CommonEnemy.png', 'text-blue-400', false); break;
                    case 'asc_enh2': cellContent = renderTotalItem(totals.ascCosts['2_star_enemy_material'], '/CommonEnemy.png', 'text-green-400', false); break;
                    case 'asc_enh1': cellContent = renderTotalItem(totals.ascCosts['1_star_enemy_material'], '/CommonEnemy.png', 'text-gray-400', false); break;
                    case 'asc_stella': cellContent = renderTotalItem(totals.ascCosts.masterless_stella_fortuna, 'MasterlessStellaFortuna', 'text-amber-400', true); break;
                    case 'asc_mora': cellContent = renderTotalItem(totals.ascCosts.mora, 'Mora', 'text-blue-400', true, 'right'); break;

                    case 'tal_4': cellContent = renderTotalItem(totals.talentCosts['4_star_talent_material'], '/TalentMats.png', 'text-purple-400', false); break;
                    case 'tal_3': cellContent = renderTotalItem(totals.talentCosts['3_star_talent_material'], '/TalentMats.png', 'text-blue-400', false); break;
                    case 'tal_2': cellContent = renderTotalItem(totals.talentCosts['2_star_talent_material'], '/TalentMats.png', 'text-green-400', false); break;
                    case 'tal_wk': cellContent = renderTotalItem(totals.talentCosts.weekly_boss_material, '/WeeklyBoss.png', 'text-amber-400', false); break;
                    case 'tal_crown': cellContent = renderTotalItem(totals.talentCosts.crown, 'CrownOfInsight', 'text-amber-400', true); break;
                    case 'tal_enh3': cellContent = renderTotalItem(totals.talentCosts['3_star_enemy_material'], '/CommonEnemy.png', 'text-blue-400', false); break;
                    case 'tal_enh2': cellContent = renderTotalItem(totals.talentCosts['2_star_enemy_material'], '/CommonEnemy.png', 'text-green-400', false); break;
                    case 'tal_enh1': cellContent = renderTotalItem(totals.talentCosts['1_star_enemy_material'], '/CommonEnemy.png', 'text-gray-400', false); break;
                    case 'tal_na_mora': cellContent = renderTotalItem(totals.talentCosts.mora_na, 'Mora', 'text-blue-400', true, 'right'); break;
                    case 'tal_skill_mora': cellContent = renderTotalItem(totals.talentCosts.mora_skill, 'Mora', 'text-blue-400', true, 'right'); break;
                    case 'tal_burst_mora': cellContent = renderTotalItem(totals.talentCosts.mora_burst, 'Mora', 'text-blue-400', true, 'right'); break;
                    case 'tal_mora': cellContent = renderTotalItem(totals.talentCosts.mora, 'Mora', 'text-blue-400', true, 'right'); break;

                    case 'grand_enh3': cellContent = renderTotalItem((totals.ascCosts['3_star_enemy_material']||0) + (totals.talentCosts['3_star_enemy_material']||0), '/CommonEnemy.png', 'text-blue-400', false); break;
                    case 'grand_enh2': cellContent = renderTotalItem((totals.ascCosts['2_star_enemy_material']||0) + (totals.talentCosts['2_star_enemy_material']||0), '/CommonEnemy.png', 'text-green-400', false); break;
                    case 'grand_enh1': cellContent = renderTotalItem((totals.ascCosts['1_star_enemy_material']||0) + (totals.talentCosts['1_star_enemy_material']||0), '/CommonEnemy.png', 'text-[#9CA3AF]', false); break;
                    case 'grand_mora': cellContent = renderTotalItem((totals.ascCosts.mora||0) + (totals.talentCosts.mora||0), 'Mora', 'text-blue-400', true, 'right'); break;
                    default: cellContent = null;
                  }

                  return (
                    <td key={column.id} className={tdClass}>
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            )}
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
      <FloatingHorizontalScrollbar scrollContainerRef={scrollContainerRef} />
    </div>
  );
}

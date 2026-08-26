import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GenshinImage from '../GenshinImage';
import { getCharacterAvatar, getElementIcon, getWeaponIcon, getWeaponTypeIcon, getMaterialIcon } from '../../utils/assetHelper';

export const universalFilterFn = (row, columnId, filterValue) => {
  if (!filterValue) return true;
  
  const val = row.getValue(columnId);
  const { text, min, max, selection } = filterValue;
  
  const isArr = Array.isArray(val);

  if (text) {
    if (isArr) {
      if (!val.some(v => String(v).toLowerCase().includes(text.toLowerCase()))) return false;
    } else {
      if (!String(val).toLowerCase().includes(text.toLowerCase())) return false;
    }
  }
  
  if (min !== undefined && min !== '') {
    if (!isArr && parseFloat(val) < parseFloat(min)) return false;
  }
  if (max !== undefined && max !== '') {
    if (!isArr && parseFloat(val) > parseFloat(max)) return false;
  }
  
  if (selection && selection.length > 0) {
    if (isArr) {
      if (!val.some(v => selection.includes(v))) return false;
    } else {
      if (!selection.includes(val)) return false;
    }
  }
  
  return true;
};

export function UnifiedHeaderMenu({ column, table, closeMenu, anchorEl, menuRef }) {
  const canSort = column.getCanSort();
  const filterType = column.columnDef.meta?.filterType;
  const isSorted = column.getIsSorted();
  const filterValue = column.getFilterValue() || {};

  const [style, setStyle] = useState({});
  
  useEffect(() => {
    if (anchorEl) {
       const updatePos = () => {
          const rect = anchorEl.getBoundingClientRect();
          setStyle({ top: rect.bottom, left: rect.left });
       };
       updatePos();
       const handleScroll = (e) => {
         if (menuRef.current && menuRef.current.contains(e.target)) return;
         closeMenu();
       };
       window.addEventListener('scroll', handleScroll, true);
       window.addEventListener('resize', closeMenu);
       return () => {
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', closeMenu);
       };
    }
  }, [anchorEl, closeMenu]);

  const uniqueValues = useMemo(() => {
    const values = new Set();
    table.getPreFilteredRowModel().flatRows.forEach(row => {
      const val = row.getValue(column.id);
      if (Array.isArray(val)) {
        val.forEach(v => {
          if (v !== undefined && v !== null && v !== '') values.add(v);
        });
      } else if (val !== undefined && val !== null && val !== '') {
        values.add(val);
      }
    });
    const arr = Array.from(values);
    if (arr.length > 0 && typeof arr[0] === 'number') {
       return arr.sort((a,b) => a - b);
    }
    return arr.sort();
  }, [table, column.id]);

  const updateFilter = (updates) => {
    const newState = { ...filterValue, ...updates };
    if (!newState.text && !newState.min && !newState.max && !newState.selection) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue(newState);
    }
  };

  const toggleArrayFilter = (val) => {
    const active = new Set(filterValue.selection || []);
    if (active.has(val)) active.delete(val);
    else active.add(val);
    updateFilter({ selection: active.size ? Array.from(active) : undefined });
  };


  const getIconForValue = (val) => {
    const colId = column.id;
    if (colId === 'character' || colId === 'equipped_char') return <GenshinImage src={getCharacterAvatar(val)} alt={val} className="w-5 h-5 object-cover rounded shadow shrink-0" />;
    if (colId === 'element') return <GenshinImage src={getElementIcon(val)} alt={val} className="w-5 h-5 object-contain shrink-0" />;
    if (colId === 'weapon' || colId === 'weapon_type') return <GenshinImage src={getWeaponTypeIcon(val)} alt={val} className="w-5 h-5 object-contain shrink-0 opacity-70" />;
    if (colId === 'equipped' || colId === 'weapon_name') return <GenshinImage src={getWeaponIcon(val)} alt={val} className="w-5 h-5 object-contain shrink-0" />;
    
    if (typeof val === 'number') return null;
    return <GenshinImage src={getMaterialIcon(val)} alt={val} className="w-5 h-5 object-contain shrink-0" />;
  };

  const hasActiveFilter = filterValue.text || (filterValue.min !== undefined && filterValue.min !== '') || (filterValue.max !== undefined && filterValue.max !== '') || (filterValue.selection && filterValue.selection.length > 0);

  return createPortal(
    <div ref={menuRef} className="fixed bg-[var(--elevated)] border border-[var(--border)] rounded-xl p-3 shadow-2xl z-[9999] min-w-[180px] animate-fade-in flex flex-col gap-2 cursor-default" style={style} onClick={e => e.stopPropagation()}>
      {canSort && (
        <>
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => { column.toggleSorting(false); closeMenu(); }}
              className={`text-left px-2 py-1.5 rounded hover:bg-[var(--surface)] text-xs transition-colors ${isSorted === 'asc' ? 'text-[var(--gold)] font-bold bg-[var(--surface)]' : 'text-[var(--text)]'}`}
            >
              Highest / A-Z ↑
            </button>
            <button 
              onClick={() => { column.toggleSorting(true); closeMenu(); }}
              className={`text-left px-2 py-1.5 rounded hover:bg-[var(--surface)] text-xs transition-colors ${isSorted === 'desc' ? 'text-[var(--gold)] font-bold bg-[var(--surface)]' : 'text-[var(--text)]'}`}
            >
              Lowest / Z-A ↓
            </button>
            {isSorted && (
              <button 
                onClick={() => { column.clearSorting(); closeMenu(); }}
                className="text-left px-2 py-1.5 rounded hover:bg-red-500/20 text-xs text-red-400 transition-colors"
              >
                Clear Sort
              </button>
            )}
          </div>
          {filterType && <hr className="border-[var(--border)] my-1" />}
        </>
      )}

      {filterType === 'number' && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filterValue.min ?? ''}
            onChange={e => updateFilter({ min: e.target.value })}
            placeholder="Min"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--gold)]"
          />
          <span className="text-[var(--muted)]">-</span>
          <input
            type="number"
            value={filterValue.max ?? ''}
            onChange={e => updateFilter({ max: e.target.value })}
            placeholder="Max"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--gold)]"
          />
        </div>
      )}

      {filterType === 'text' && (
        <input
          type="text"
          value={filterValue.text ?? ''}
          onChange={e => updateFilter({ text: e.target.value })}
          placeholder="Search..."
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--gold)]"
        />
      )}

      {filterType && (
        <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-1 mt-1">
          {uniqueValues.map(val => (
            <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--surface)] rounded cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={(filterValue.selection || []).includes(val)}
                onChange={() => toggleArrayFilter(val)}
                className="rounded border-gray-600 bg-gray-800/50 text-[var(--gold)] focus:ring-0 focus:ring-offset-0"
              />
              {getIconForValue(val)}
              <span className="text-xs text-[var(--text)] truncate">{typeof val === 'number' && val > 1000 ? val.toLocaleString() : val}</span>
            </label>
          ))}
          {uniqueValues.length === 0 && <span className="text-xs text-[var(--muted)] p-2">No items</span>}
        </div>
      )}

      {hasActiveFilter && (
        <button 
          onClick={() => { column.setFilterValue(undefined); closeMenu(); }}
          className="text-center px-2 py-1.5 rounded hover:bg-[var(--surface)] text-xs text-[var(--muted)] mt-1 transition-colors"
        >
          Clear Filter
        </button>
      )}
    </div>,
    document.body
  );
}


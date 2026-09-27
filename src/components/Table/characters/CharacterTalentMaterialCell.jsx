import React from 'react';
import MatQuantity from '../../MatQuantity';
import { resolveCharacterMaterials } from '../../../utils/dataManager';

export default function CharacterTalentMaterialCell({ row, column, tierStar, defaultColor, defaultIcon }) {
  const isTraveler = !!row.original.materials?.talent_material_family_ids;
  const resolvedMats = resolveCharacterMaterials(row.original);

  const filterValue = column.getFilterValue();
  const hasActiveFilter = filterValue && (filterValue.text || (filterValue.selection && filterValue.selection.length > 0));
  let specificFilters = [];

  if (isTraveler && hasActiveFilter) {
    const families = row.original.materials.talent_material_family_ids;
    specificFilters = families.filter(f => {
      const prefix = tierStar === 2 ? 'Teachings of ' : tierStar === 3 ? 'Guide to ' : 'Philosophies of ';
      const fullName = `${prefix}${f}`;
      const matchesSelection = filterValue.selection && filterValue.selection.includes(fullName);
      const matchesText = filterValue.text && fullName.toLowerCase().includes(filterValue.text.toLowerCase());
      return matchesSelection || matchesText;
    });
  }

  if (!isTraveler) {
    const val = row.original.talentCosts?.[`${tierStar}_star_talent_material`] || 0;
    return <MatQuantity val={val} icon={defaultIcon} color={`text-${defaultColor}`} nameKey={resolvedMats?.talent?.tiers?.[`${tierStar}_star`]?.name} category="Talent Material" />;
  }

  // Traveler Logic
  const families = row.original.materials.talent_material_family_ids;
  const familiesToRender = hasActiveFilter ? specificFilters : families;

  const breakdown = [];
  let totalVal = 0;

  familiesToRender.forEach(family => {
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

  if (familiesToRender.length === 1) {
    const specificFilter = familiesToRender[0];
    let prefix = tierStar === 2 ? 'Teachings of ' : tierStar === 3 ? 'Guide to ' : 'Philosophies of ';
    return <MatQuantity val={totalVal} icon={defaultIcon} color={`text-${defaultColor}`} nameKey={`${prefix}${specificFilter}`} category="Talent Material" />;
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
}

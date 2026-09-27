import React from 'react';
import PlannerItemCard from './PlannerItemCard';

export default function PlannerCategorySection({ icon, title, items, accent, emptyMsg, maxCols = 5 }) {
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
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }}>
          {items.length} items
        </span>
      </div>
      <div className={`grid gap-4 ${maxCols === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
        {items.map((item) => (
          <PlannerItemCard key={item.name} item={item} accent={accent} />
        ))}
      </div>
    </div>
  )
}

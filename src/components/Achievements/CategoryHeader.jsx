import React from 'react';
import { getAchievementCategoryIconUrl } from '../../utils/achievementCategoryIcon';

export default function CategoryHeader({
  category,
  stats,
  categoryRecon,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus
}) {
  if (!category) return null;

  return (
    <div className="flex flex-col bg-[#0d1421]/60 backdrop-blur-sm border-b border-primary/20 shrink-0 shadow-sm relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      <div className="p-3 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center p-1.5 shrink-0 shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-5 h-5 md:w-6 md:h-6 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            </div>
            <img src={getAchievementCategoryIconUrl(category.id)} alt="" className="w-full h-full object-contain drop-shadow-md relative z-10 bg-[#0a0f18] rounded" onError={(e) => e.target.style.display = 'none'} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-white text-base md:text-lg tracking-wide leading-tight mb-0.5 md:mb-1">{category.name}</h3>
            <div className="flex items-center flex-wrap gap-2 md:gap-3 text-[11px] md:text-xs font-medium text-white/60">
              <span className="flex items-center gap-1.5">
                <span className={stats.completedCount === stats.totalCount && stats.totalCount > 0 ? "text-cyan-400" : "text-white"}>{stats.completedCount}</span>
                <span className="text-white/30">/</span> {stats.totalCount} Complete
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20"></span>
              <span className="text-primary">{stats.percentage.toFixed(0)}%</span>
              <span className="w-1 h-1 rounded-full bg-white/20"></span>
              <span className="text-[#FDE047]/80 flex items-center gap-0.5">
                {stats.earnedPrimogems} <span className="text-[10px]">✦</span>
              </span>

              {categoryRecon && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20 hidden sm:block"></span>
                  <span className="hidden sm:inline-flex items-center gap-1">
                    {categoryRecon.difference === 0 ? (
                      <span className="text-teal-400 font-bold uppercase tracking-wider text-[11px] bg-teal-900/20 px-2 py-0.5 rounded">Synced</span>
                    ) : categoryRecon.difference > 0 ? (
                      <span className="text-primary font-bold uppercase tracking-wider text-[11px] bg-primary/20 px-2 py-0.5 rounded">+{categoryRecon.difference} HoYoLAB</span>
                    ) : (
                      <span className="text-yellow-400 font-bold uppercase tracking-wider text-[11px] bg-yellow-900/20 px-2 py-0.5 rounded">+{ -categoryRecon.difference} Toolkit</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="relative flex-1 sm:w-64 group">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-black/60 transition-all shadow-inner"
              aria-label="Search achievements"
            />
          </div>

          <div className="flex bg-black/40 border border-white/10 rounded-lg p-1 shadow-inner shrink-0 justify-between sm:justify-start">
            {['All', 'Incomplete', 'Completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  filterStatus === status
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

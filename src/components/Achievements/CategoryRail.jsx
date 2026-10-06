import React from 'react';
import { getAchievementCategoryIconUrl } from '../../utils/achievementCategoryIcon';

export default function CategoryRail({
  categories,
  selectedCategory,
  setSelectedCategory,
  getCategoryStats,
  getCategoryReconciliation,
  achievementProgress,
  hoyolabData
}) {
  return (
    <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4">
      {/* Desktop Rail */}
      <div className="hidden lg:flex flex-col gap-2 bg-[#0d1421]/90 backdrop-blur-md border border-primary/20 rounded-2xl p-3 h-[calc(100vh-220px)] sticky top-6 overflow-y-auto custom-scrollbar shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {categories.map(category => {
          const stats = getCategoryStats(category.id, achievementProgress);
          const isSelected = selectedCategory === category.id;
          const catRecon = getCategoryReconciliation(category.id, achievementProgress, hoyolabData);
          const isDone = stats.completedCount === stats.totalCount && stats.totalCount > 0;

          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`group flex flex-col text-left p-3 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected 
                  ? 'bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/40 shadow-[inset_4px_0_0_var(--color-primary)]' 
                  : 'bg-transparent border border-transparent hover:bg-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center p-0.5 shrink-0 shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-4 h-4 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                  </div>
                  <img src={getAchievementCategoryIconUrl(category.id)} alt="" className={`w-full h-full object-contain transition-opacity relative z-10 bg-[#0d1421] rounded-md ${isSelected ? 'opacity-100 drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]' : 'opacity-70 group-hover:opacity-90'}`} onError={(e) => e.target.style.display = 'none'} />
                </div>
                <div className={`flex-1 font-bold text-sm leading-tight transition-colors ${isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                  {category.name}
                </div>
              </div>
              
              <div className="flex items-end justify-between px-1">
                <span className="text-[10px] text-white/50 font-semibold tracking-wide">
                  <span className={isDone ? "text-cyan-400" : isSelected ? "text-white" : ""}>{stats.completedCount}</span> / {stats.totalCount}
                </span>
                {(() => {
                  if (catRecon) {
                    if (catRecon.difference === 0) return <span className="text-[11px] text-teal-400 font-bold uppercase tracking-wider">Synced</span>;
                    if (catRecon.difference > 0) return <span className="text-[11px] text-primary font-bold uppercase tracking-wider">+{catRecon.difference}</span>;
                    return <span className="text-[11px] text-yellow-400 font-bold uppercase tracking-wider">+{ -catRecon.difference} Toolkit</span>;
                  }
                  if (isDone) {
                    return <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">Done</span>;
                  }
                  return <span className="text-[11px] text-white/30 font-bold uppercase tracking-wider">{stats.percentage.toFixed(0)}%</span>;
                })()}
              </div>
              
              <div className="w-full h-1 bg-black/60 rounded-full mt-2 overflow-hidden shadow-inner relative">
                <div 
                  className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out rounded-full ${isSelected ? 'bg-primary shadow-[0_0_8px_var(--color-primary)]' : isDone ? 'bg-cyan-500' : 'bg-white/40'}`} 
                  style={{ width: `${stats.percentage}%` }} 
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Mobile Rail (Dropdown/Horizontal scroll) */}
      <div className="lg:hidden relative">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full appearance-none bg-[#0d1421]/90 backdrop-blur-md border border-primary/30 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary shadow-lg"
          aria-label="Select category"
        >
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name} ({getCategoryStats(category.id, achievementProgress).completedCount}/{getCategoryStats(category.id, achievementProgress).totalCount})
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

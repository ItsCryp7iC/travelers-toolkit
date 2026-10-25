import React, { useMemo, useState, useRef, useEffect } from 'react';
import { getAchievementCategoryIconUrl } from '../../utils/achievementCategoryIcon';

export default function CategoryRail({
  categories,
  selectedCategory,
  setSelectedCategory,
  getCategoryStats,
  getCategoryReconciliation,
  achievementProgress,
  hoyolabData,
  hideCompleted,
  setHideCompleted
}) {
  const [isMobilePickerOpen, setIsMobilePickerOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    if (!isMobilePickerOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMobilePickerOpen(false);
    };
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsMobilePickerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobilePickerOpen]);

  const visibleCategories = useMemo(() => {
    return categories.filter(cat => {
      // Rule: Keep currently selected category visible until user navigates away
      if (cat.id === selectedCategory) return true;
      if (hideCompleted) {
        const stats = getCategoryStats(cat.id, achievementProgress);
        if (stats.completedCount === stats.totalCount && stats.totalCount > 0) return false;
      }
      return true;
    });
  }, [categories, hideCompleted, selectedCategory, achievementProgress, getCategoryStats]);

  const filteredMobileCategories = useMemo(() => {
    if (!mobileSearchQuery.trim()) return visibleCategories;
    const q = mobileSearchQuery.toLowerCase();
    return visibleCategories.filter(cat => cat.name.toLowerCase().includes(q));
  }, [visibleCategories, mobileSearchQuery]);

  const activeCategoryObj = useMemo(() => {
    return categories.find(cat => cat.id === selectedCategory) || categories[0];
  }, [categories, selectedCategory]);

  const activeStats = useMemo(() => {
    return activeCategoryObj ? getCategoryStats(activeCategoryObj.id, achievementProgress) : { completedCount: 0, totalCount: 0, percentage: 0 };
  }, [activeCategoryObj, getCategoryStats, achievementProgress]);

  return (
    <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4">
      {/* Desktop Rail */}
      <div className="hidden lg:flex flex-col gap-2 bg-[#0d1421]/90 backdrop-blur-md border border-primary/20 rounded-2xl p-3 h-[calc(100vh-220px)] sticky top-[var(--topbar-h,64px)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {visibleCategories.map(category => {
            const stats = getCategoryStats(category.id, achievementProgress);
            const isSelected = selectedCategory === category.id;
            const catRecon = getCategoryReconciliation(category.id, achievementProgress, hoyolabData);
            const isDone = stats.completedCount === stats.totalCount && stats.totalCount > 0;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`group flex flex-col text-left p-3 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 ${
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
        <div className="pt-2 border-t border-white/10 mt-auto shrink-0">
          <label className="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs text-white/50 hover:text-white/80 transition-colors w-max">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-black/40 text-primary focus:ring-primary focus:ring-offset-0 focus:ring-offset-[#0d1421] cursor-pointer"
            />
            Hide completed categories
          </label>
        </div>
      </div>

      {/* Mobile Category Navigation (< 1024px) */}
      <div ref={dropdownRef} className="lg:hidden relative z-30">
        <button
          id="mobile-category-selector-btn"
          type="button"
          onClick={() => setIsMobilePickerOpen(prev => !prev)}
          aria-expanded={isMobilePickerOpen}
          aria-controls="mobile-category-panel"
          aria-label="Select achievement category"
          className="w-full flex items-center justify-between p-3 bg-[#0d1421]/95 backdrop-blur-md border border-primary/40 rounded-xl shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary min-h-[52px]"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center p-0.5 shrink-0 shadow-inner">
              <img
                src={getAchievementCategoryIconUrl(activeCategoryObj?.id)}
                alt=""
                className="w-full h-full object-contain drop-shadow"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span className="font-bold text-sm text-white truncate">
                {activeCategoryObj?.name}
              </span>
              <span className="text-[11px] text-white/60 font-medium">
                {activeStats.completedCount} / {activeStats.totalCount} ({activeStats.percentage.toFixed(0)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-2 text-white/50">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
              Switch
            </span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isMobilePickerOpen ? 'rotate-180 text-primary' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Mobile Dropdown Panel */}
        {isMobilePickerOpen && (
          <div
            id="mobile-category-panel"
            className="absolute left-0 right-0 top-full mt-2 bg-[#0d1421]/95 backdrop-blur-xl border border-primary/30 rounded-xl p-3 shadow-2xl flex flex-col gap-2 z-50 animate-fade-in max-w-full"
          >
            {/* Search input inside dropdown */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="mobile-category-search-input"
                type="text"
                placeholder="Search 73 categories..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                className="search-input w-full bg-black/60 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary min-h-[38px]"
                aria-label="Filter categories"
                autoFocus
              />
              {mobileSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMobileSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  aria-label="Clear category search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Hide completed categories toggle */}
            <div className="flex items-center justify-between px-1 py-1 border-b border-white/5">
              <span className="text-[11px] text-white/50">{filteredMobileCategories.length} categories</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-white/60 hover:text-white/80 transition-colors">
                <input
                  type="checkbox"
                  checked={hideCompleted}
                  onChange={(e) => setHideCompleted(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary focus:ring-offset-0 focus:ring-offset-[#0d1421] cursor-pointer"
                />
                Hide completed
              </label>
            </div>

            {/* Category list */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 py-1">
              {filteredMobileCategories.length === 0 ? (
                <div className="py-6 text-center text-xs text-white/40">
                  No categories found matching "{mobileSearchQuery}"
                </div>
              ) : (
                filteredMobileCategories.map(category => {
                  const stats = getCategoryStats(category.id, achievementProgress);
                  const isSelected = selectedCategory === category.id;
                  const catRecon = getCategoryReconciliation(category.id, achievementProgress, hoyolabData);
                  const isDone = stats.completedCount === stats.totalCount && stats.totalCount > 0;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setIsMobilePickerOpen(false);
                        setMobileSearchQuery('');
                      }}
                      className={`flex flex-col text-left p-2.5 rounded-lg transition-all min-h-[44px] ${
                        isSelected
                          ? 'bg-primary/20 border border-primary/40 text-white'
                          : 'bg-black/20 hover:bg-white/5 text-white/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={getAchievementCategoryIconUrl(category.id)}
                            alt=""
                            className="w-5 h-5 object-contain shrink-0"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-white/90'}`}>
                            {category.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/50 shrink-0 font-medium">
                          {stats.completedCount} / {stats.totalCount}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${isSelected ? 'bg-primary' : isDone ? 'bg-cyan-500' : 'bg-white/30'}`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Accessible fallback select */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="sr-only"
          aria-label="Select category"
          tabIndex={-1}
        >
          {visibleCategories.map(category => {
            const stats = getCategoryStats(category.id, achievementProgress);
            return (
              <option key={category.id} value={category.id}>
                {category.name} ({stats.completedCount}/{stats.totalCount})
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

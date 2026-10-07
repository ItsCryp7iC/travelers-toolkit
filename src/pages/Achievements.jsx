import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../store/useStore';
import categoriesData from '../data/achievements/categories.json';
import { getAchievementsByCategory, getOverallStats, getCategoryStats } from '../utils/achievementStats';
import { getOverallReconciliation, getCategoryReconciliation } from '../utils/achievementReconciliation';
import { groupAchievements } from '../utils/achievementGrouping';
import { applyStageCompletionChange } from '../utils/achievementStageProgress';
import allAchievementsData from '../data/achievements/achievements.json';
import commissionsData from '../data/achievements/commissions.json';
import { getAchievementCategoryIconUrl } from '../utils/achievementCategoryIcon';

import AchievementHero from '../components/Achievements/AchievementHero';
import CategoryRail from '../components/Achievements/CategoryRail';
import CategoryHeader from '../components/Achievements/CategoryHeader';
import AchievementCard from '../components/Achievements/AchievementCard';
import AchievementGroup from '../components/Achievements/AchievementGroup';

export default function Achievements() {
  const achievementProgress = useStore((s) => s.achievementProgress);
  const setAchievementProgress = useStore((s) => s.setAchievementProgress);
  const hoyolabConnected = useStore((s) => s.hoyolabConnected);

  const [reconciliationStatus, setReconciliationStatus] = useState('idle');
  const [hoyolabData, setHoyolabData] = useState(null);
  const [hoyolabError, setHoyolabError] = useState(null);

  const fetchHoyolabData = async () => {
    if (!hoyolabConnected) return;
    setReconciliationStatus('loading');
    setHoyolabError(null);
    try {
      const res = await fetch('/api/hoyolab/achievements', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHoyolabData(data);
        setReconciliationStatus('success');
      } else if (res.status === 401) {
        setHoyolabError('Session expired. Please reconnect HoYoLAB.');
        setReconciliationStatus('error');
        useStore.getState().setHoyolabConnected(false);
      } else if (res.status === 403) {
        setHoyolabError("Achievement data isn't available from HoYoLAB. Check your Battle Chronicle privacy settings.");
        setReconciliationStatus('error');
      } else {
        setHoyolabError("Couldn't load HoYoLAB achievement data. Try again.");
        setReconciliationStatus('error');
      }
    } catch (err) {
      setHoyolabError("Couldn't load HoYoLAB achievement data. Try again.");
      setReconciliationStatus('error');
    }
  };

  useEffect(() => {
    if (hoyolabConnected && reconciliationStatus === 'idle') {
      fetchHoyolabData();
    }
  }, [hoyolabConnected, reconciliationStatus]);

  // Initialize selected category from URL or default to '0' (Wonders of the World)
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    // Ensure category exists
    if (cat && categoriesData.some(c => c.id === cat)) {
      return cat;
    }
    return categoriesData[0]?.id || '0';
  });

  // Update URL when category changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedCategory) {
      params.set('category', selectedCategory);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedCategory]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Completed', 'Incomplete'
  const [filterVersion, setFilterVersion] = useState('All');
  const [hideCompletedCategories, setHideCompletedCategories] = useState(false);

  const availableVersions = useMemo(() => {
    const versions = new Set();
    allAchievementsData.forEach(ach => {
      if (ach.version) versions.add(ach.version);
    });
    // Sort descending using numeric semantic comparison
    return Array.from(versions).sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return bVal - aVal;
      }
      return 0;
    });
  }, []);

  // Computed data
  const overallStats = useMemo(() => getOverallStats(achievementProgress), [achievementProgress]);
  const overallRecon = useMemo(() => getOverallReconciliation(achievementProgress, hoyolabData), [achievementProgress, hoyolabData]);
  const achievementsByCat = useMemo(() => getAchievementsByCategory(), []);

  const validCategoryIds = useMemo(() => {
    if (filterVersion === 'All' && filterStatus === 'All') {
      return new Set(categoriesData.map(c => c.id));
    }
    const valid = new Set();
    allAchievementsData.forEach(ach => {
      if (filterStatus === 'Completed' && !achievementProgress[ach.id]?.completed) return;
      if (filterStatus === 'Incomplete' && achievementProgress[ach.id]?.completed) return;
      if (filterVersion !== 'All' && ach.version !== filterVersion) return;
      valid.add(ach.categoryId);
    });
    return valid;
  }, [achievementProgress, filterVersion, filterStatus]);

  const filteredCategoriesForRail = useMemo(() => {
    return categoriesData.filter(c => validCategoryIds.has(c.id));
  }, [validCategoryIds]);

  useEffect(() => {
    if (searchQuery) return;
    if (!validCategoryIds.has(selectedCategory)) {
      if (filteredCategoriesForRail.length > 0) {
        setSelectedCategory(filteredCategoriesForRail[0].id);
      }
    }
  }, [validCategoryIds, selectedCategory, searchQuery, filteredCategoriesForRail]);

  const currentCategoryObj = useMemo(() => categoriesData.find(c => c.id === selectedCategory), [selectedCategory]);
  const currentCategoryAchievements = achievementsByCat[selectedCategory] || [];

  const baseAchievements = searchQuery ? allAchievementsData : currentCategoryAchievements;

  const filteredAchievements = useMemo(() => {
    return baseAchievements.filter((ach) => {
      if (filterStatus === 'Completed' && !achievementProgress[ach.id]?.completed) return false;
      if (filterStatus === 'Incomplete' && achievementProgress[ach.id]?.completed) return false;
      if (filterVersion !== 'All' && ach.version !== filterVersion) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        let commsMatch = false;
        if (commissionsData[ach.id]) {
          commsMatch = commissionsData[ach.id].some(comm => comm.name.toLowerCase().includes(q));
        }

        return ach.name.toLowerCase().includes(q) ||
               ach.description.toLowerCase().includes(q) ||
               String(ach.id).includes(q) ||
               commsMatch;
      }
      return true;
    });
  }, [baseAchievements, achievementProgress, filterStatus, filterVersion, searchQuery]);

  const renderableItems = useMemo(() => {
    if (searchQuery) {
      // Group by category first
      const byCategory = {};
      filteredAchievements.forEach(ach => {
        if (!byCategory[ach.categoryId]) byCategory[ach.categoryId] = [];
        byCategory[ach.categoryId].push(ach);
      });
      // Sort categories by their order, and inside, group them into stages
      const sortedCatIds = Object.keys(byCategory).sort((a, b) => {
        const cA = categoriesData.find(c => c.id === a);
        const cB = categoriesData.find(c => c.id === b);
        return (cA?.order || 0) - (cB?.order || 0);
      });
      return sortedCatIds.map(catId => {
        const catObj = categoriesData.find(c => c.id === catId);
        return {
          isCategoryGroup: true,
          category: catObj,
          items: groupAchievements(byCategory[catId])
        };
      });
    } else {
      return groupAchievements(filteredAchievements);
    }
  }, [filteredAchievements, searchQuery]);

  const handleToggle = (id, checked) => {
    const nextProgress = applyStageCompletionChange(
      achievementProgress,
      allAchievementsData,
      id,
      checked,
      new Date().toISOString()
    );
    setAchievementProgress(nextProgress, { mode: 'replace' });
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-[1600px] mx-auto">
      {/* Header Summary */}
      <AchievementHero
        overallStats={overallStats}
        overallRecon={overallRecon}
        hoyolabConnected={hoyolabConnected}
        reconciliationStatus={reconciliationStatus}
        hoyolabError={hoyolabError}
        fetchHoyolabData={fetchHoyolabData}
        hoyolabData={hoyolabData}
      />

      {/* Global Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center bg-[#0d1421]/60 backdrop-blur-sm border border-white/5 rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden z-20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

        {/* Search */}
        <div className="relative flex-1 group z-10">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search all achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary/50 focus:bg-black/60 transition-all shadow-inner"
              aria-label="Search all achievements"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors" aria-label="Clear search">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto z-10">
          {/* Version Filter */}
          <div className="relative flex-1 md:flex-none md:w-36 shrink-0">
            <select
              value={filterVersion}
              onChange={(e) => setFilterVersion(e.target.value)}
              className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-black/60 transition-all shadow-inner cursor-pointer"
              aria-label="Filter by version"
            >
              <option value="All">All Versions</option>
              {availableVersions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex bg-black/40 border border-white/10 rounded-lg p-1 shadow-inner shrink-0 justify-between flex-1 md:flex-none">
            {['All', 'Incomplete', 'Completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
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

      {filteredCategoriesForRail.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1421]/60 backdrop-blur-md border border-white/5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-12 text-center min-h-[500px]">
          <h3 className="text-xl font-bold text-white mb-2">No achievements match the current filters.</h3>
          <p className="text-sm text-white/50 max-w-md mx-auto">
            Try changing the Version or Status filters above to see more achievements.
          </p>
        </div>
      ) : (
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-6 flex-1 min-h-[500px]">
        {/* Category List */}
        <CategoryRail
          categories={filteredCategoriesForRail}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          getCategoryStats={getCategoryStats}
          getCategoryReconciliation={getCategoryReconciliation}
          achievementProgress={achievementProgress}
          hoyolabData={hoyolabData}
          hideCompleted={hideCompletedCategories}
          setHideCompleted={setHideCompletedCategories}
        />

        {/* Achievements List */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d1421]/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-[600px] lg:h-[calc(100vh-220px)]">

          {!searchQuery && (
            <CategoryHeader
              category={currentCategoryObj}
              stats={getCategoryStats(selectedCategory, achievementProgress)}
              categoryRecon={getCategoryReconciliation(selectedCategory, achievementProgress, hoyolabData)}
            />
          )}

          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0" />

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative z-10">

            {searchQuery ? (
              <div className="flex flex-col gap-6 relative z-10">
                <div className="mb-2">
                  <h3 className="text-xl font-bold text-white">Search Results</h3>
                  <p className="text-sm text-white/50">{filteredAchievements.length} {filteredAchievements.length === 1 ? 'match' : 'matches'}</p>
                </div>
                {renderableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-white/40 py-8">
                    <p className="text-sm font-medium">No achievements found for "{searchQuery}".</p>
                    <p className="text-xs mt-1">Try changing the status or version filter.</p>
                  </div>
                ) : (
                  renderableItems.map(catGroup => (
                    <div key={catGroup.category.id} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={getAchievementCategoryIconUrl(catGroup.category.id)} className="w-6 h-6 object-contain drop-shadow-md" alt="" onError={(e) => e.target.style.display='none'} />
                        <h4 className="text-white font-semibold text-sm">{catGroup.category.name}</h4>
                        <span className="text-xs text-white/40 ml-1">({catGroup.items.reduce((acc, item) => acc + (item.isGroup ? item.stages.length : 1), 0)})</span>
                      </div>
                      {catGroup.items.map(item => {
                        if (item.isGroup) {
                          return <AchievementGroup key={`group-${item.stageGroupId}`} item={item} achievementProgress={achievementProgress} handleToggle={handleToggle} />;
                        } else {
                          return <AchievementCard key={item.achievement.id} ach={item.achievement} isCompleted={!!achievementProgress[item.achievement.id]?.completed} handleToggle={handleToggle} />;
                        }
                      })}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:gap-4 relative z-10">
                {renderableItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/40 py-12 relative z-10">
                    <p className="text-sm font-medium">No achievements found matching your criteria.</p>
                  </div>
                ) : (
                  renderableItems.map(item => {
                    if (item.isGroup) {
                      return (
                        <AchievementGroup
                          key={`group-${item.stageGroupId}`}
                          item={item}
                          achievementProgress={achievementProgress}
                          handleToggle={handleToggle}
                        />
                      );
                    } else {
                      return (
                        <AchievementCard
                          key={item.achievement.id}
                          ach={item.achievement}
                          isCompleted={!!achievementProgress[item.achievement.id]?.completed}
                          handleToggle={handleToggle}
                        />
                      );
                    }
                  })
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

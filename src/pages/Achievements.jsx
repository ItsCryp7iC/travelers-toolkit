import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../store/useStore';
import categoriesData from '../data/achievements/categories.json';
import { getAchievementsByCategory, getOverallStats, getCategoryStats } from '../utils/achievementStats';
import { getOverallReconciliation, getCategoryReconciliation } from '../utils/achievementReconciliation';
import { groupAchievements } from '../utils/achievementGrouping';
import { applyStageCompletionChange } from '../utils/achievementStageProgress';
import allAchievementsData from '../data/achievements/achievements.json';

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

  // Computed data
  const overallStats = useMemo(() => getOverallStats(achievementProgress), [achievementProgress]);
  const overallRecon = useMemo(() => getOverallReconciliation(achievementProgress, hoyolabData), [achievementProgress, hoyolabData]);
  const achievementsByCat = useMemo(() => getAchievementsByCategory(), []);

  const currentCategoryObj = useMemo(() => categoriesData.find(c => c.id === selectedCategory), [selectedCategory]);
  const currentCategoryAchievements = achievementsByCat[selectedCategory] || [];

  const filteredAchievements = useMemo(() => {
    return currentCategoryAchievements.filter((ach) => {
      if (filterStatus === 'Completed' && !achievementProgress[ach.id]?.completed) return false;
      if (filterStatus === 'Incomplete' && achievementProgress[ach.id]?.completed) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return ach.name.toLowerCase().includes(q) || ach.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [currentCategoryAchievements, achievementProgress, filterStatus, searchQuery]);

  const renderableItems = useMemo(() => {
    return groupAchievements(filteredAchievements);
  }, [filteredAchievements]);

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
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-6 flex-1 min-h-[500px]">
        {/* Category List */}
        <CategoryRail
          categories={categoriesData}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          getCategoryStats={getCategoryStats}
          getCategoryReconciliation={getCategoryReconciliation}
          achievementProgress={achievementProgress}
          hoyolabData={hoyolabData}
        />

        {/* Achievements List */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d1421]/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-[600px] lg:h-[calc(100vh-220px)]">
          {/* Controls */}
          <CategoryHeader
            category={currentCategoryObj}
            stats={getCategoryStats(selectedCategory, achievementProgress)}
            categoryRecon={getCategoryReconciliation(selectedCategory, achievementProgress, hoyolabData)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />

          <div className="relative flex-1 flex flex-col min-h-0">
            {/* Very subtle background gradient pinned to the container */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0" />

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative z-10">

            {renderableItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 py-12 relative z-10">
                <p className="text-sm font-medium">No achievements found matching your criteria.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:gap-4 relative z-10">
                {renderableItems.map(item => {
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
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

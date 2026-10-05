import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../store/useStore';
import categoriesData from '../data/achievements/categories.json';
import { getAchievementsByCategory, getOverallStats, getCategoryStats } from '../utils/achievementStats';
import { getOverallReconciliation, getCategoryReconciliation } from '../utils/achievementReconciliation';
import { groupAchievements } from '../utils/achievementGrouping';
import { applyStageCompletionChange } from '../utils/achievementStageProgress';
import allAchievementsData from '../data/achievements/achievements.json';

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
      <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-xl p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text)] mb-1">Achievements</h2>
          <p className="text-[var(--muted)] text-sm">Track your completion progress and Primogem rewards.</p>
        </div>
        <div className="flex flex-wrap gap-8 bg-black/20 p-4 rounded-lg border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-widest mb-1">Progress</span>
            <span className="text-xl font-bold text-[var(--text)]">
              {overallStats.completedCount.toLocaleString()} <span className="text-sm text-[var(--muted)] font-normal">/ {overallStats.totalCount.toLocaleString()}</span>
            </span>
            <span className="text-sm font-semibold text-primary mt-0.5">{overallStats.percentage.toFixed(1)}% complete</span>
          </div>
          <div className="w-px bg-[var(--border)] hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-widest mb-1">Primogems</span>
            <span className="text-xl font-bold text-[#FDE047] flex items-center gap-1.5">
              <span>✦</span>
              {overallStats.earnedPrimogems.toLocaleString()} <span className="text-sm text-[var(--muted)] font-normal text-[#FDE047]/60">/ {overallStats.totalPrimogems.toLocaleString()}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col bg-black/20 p-4 rounded-lg border border-[var(--border)] max-w-sm mt-4 md:mt-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-widest">HoYoLAB Sync</span>
            {hoyolabConnected && (
              <button
                onClick={fetchHoyolabData}
                disabled={reconciliationStatus === 'loading'}
                className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-[var(--border)] transition-colors disabled:opacity-50"
              >
                Refresh HoYoLAB
              </button>
            )}
          </div>
          <div className="text-sm mt-1">
            {!hoyolabConnected ? (
              <span className="text-[var(--muted)]">Connect HoYoLAB to compare your achievement totals.</span>
            ) : reconciliationStatus === 'loading' ? (
              <span className="text-[var(--muted)]">Loading...</span>
            ) : reconciliationStatus === 'error' ? (
              <span className="text-red-400">{hoyolabError}</span>
            ) : overallRecon ? (
              overallRecon.difference === 0 ? (
                <span className="text-green-400">Toolkit matches HoYoLAB</span>
              ) : overallRecon.difference > 0 ? (
                <span className="text-primary">HoYoLAB has {overallRecon.difference} more completed achievements</span>
              ) : (
                <span className="text-yellow-400">Toolkit is {-overallRecon.difference} ahead of HoYoLAB</span>
              )
            ) : (
              <span className="text-[var(--muted)]">No data</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[500px]">
        {/* Category List */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-[var(--elevated)] border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2 max-h-[350px] lg:max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar shadow-lg">
            {categoriesData.map(category => {
              const stats = getCategoryStats(category.id, achievementProgress);
              const isSelected = selectedCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex flex-col text-left p-3 rounded-lg transition-all border outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'bg-primary/10 border-primary/50 shadow-md shadow-primary/5' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className={`flex-1 font-semibold text-sm leading-tight transition-colors ${isSelected ? 'text-[var(--text)]' : 'text-[var(--text)]/80'}`}>{category.name}</div>
                    {category.icon && (
                      <img src={category.icon} alt="" className="w-8 h-8 object-contain opacity-90 rounded shrink-0 bg-black/20" onError={(e) => e.target.style.display = 'none'} />
                    )}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[11px] text-[var(--muted)] font-medium">
                      {stats.completedCount} / {stats.totalCount} <span className="opacity-70 ml-1">({stats.percentage.toFixed(0)}%)</span>
                    </span>
                    {(() => {
                      const catRecon = getCategoryReconciliation(category.id, achievementProgress, hoyolabData);
                      if (catRecon) {
                        if (catRecon.difference === 0) return <span className="text-[10px] text-green-400 font-bold tracking-wide uppercase">Matched</span>;
                        if (catRecon.difference > 0) return <span className="text-[10px] text-primary font-bold tracking-wide uppercase">+{catRecon.difference} HoYoLAB</span>;
                        return <span className="text-[10px] text-yellow-400 font-bold tracking-wide uppercase">Toolkit +{-catRecon.difference}</span>;
                      }
                      if (stats.completedCount === stats.totalCount && stats.totalCount > 0) {
                        return <span className="text-[10px] text-green-400 font-bold tracking-wide uppercase">Done</span>;
                      }
                      return null;
                    })()}
                  </div>
                  <div className="w-full h-1 bg-black/30 rounded-full mt-2.5 overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${isSelected ? 'bg-primary' : 'bg-[var(--text)]/30'}`} style={{ width: `${stats.percentage}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--elevated)] border border-[var(--border)] rounded-xl overflow-hidden shadow-lg h-[600px] lg:h-[calc(100vh-250px)]">
          {/* Controls */}
          <div className="p-4 border-b border-[var(--border)] bg-black/10 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
            <h3 className="font-bold text-[var(--text)] truncate w-full sm:w-auto text-lg flex items-center gap-2">
              {currentCategoryObj?.icon && (
                <img src={currentCategoryObj.icon} alt="" className="w-6 h-6 object-contain rounded" onError={(e) => e.target.style.display = 'none'} />
              )}
              {currentCategoryObj?.name || 'Category'}
            </h3>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search achievements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/20 border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-primary flex-1 sm:w-56 transition-colors"
                aria-label="Search achievements"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[var(--elevated)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-primary cursor-pointer transition-colors"
                aria-label="Filter by status"
              >
                <option value="All">All Status</option>
                <option value="Incomplete">Incomplete</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {renderableItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] py-12">
                <p className="text-sm">No achievements found matching your criteria.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {renderableItems.map(item => {
                  if (item.isGroup) {
                    const completedCount = item.stages.filter(s => achievementProgress[s.id]?.completed).length;

                    return (
                      <div key={`group-${item.stageGroupId}`} className="flex flex-col bg-white/5 border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--border-light)] transition-all">
                        {/* Group Header */}
                        {item.commonName && (
                          <div className="px-4 py-3 bg-black/20 border-b border-[var(--border)]/50 flex justify-between items-center">
                            <span className="font-bold text-[var(--text)]">{item.commonName}</span>
                            <span className="text-xs font-semibold text-[var(--muted)] bg-black/30 px-2 py-1 rounded">
                              {completedCount} / {item.stages.length} complete
                            </span>
                          </div>
                        )}

                        {/* Stages */}
                        <div className="flex flex-col divide-y divide-[var(--border)]/30">
                          {item.stages.map((ach, idx) => {
                            const isCompleted = !!achievementProgress[ach.id]?.completed;
                            return (
                              <label
                                key={ach.id}
                                className={`relative flex gap-4 p-4 transition-all cursor-pointer group ${
                                  isCompleted ? 'bg-green-900/5' : 'hover:bg-white/5'
                                }`}
                              >
                                <div className="flex-shrink-0 pt-0.5">
                                  <div className="relative flex items-center justify-center w-5 h-5">
                                    <input
                                      type="checkbox"
                                      checked={isCompleted}
                                      onChange={(e) => handleToggle(ach.id, e.target.checked)}
                                      className={`w-5 h-5 rounded border-2 cursor-pointer appearance-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--elevated)] ${isCompleted ? 'bg-green-500 border-green-500 focus-visible:ring-green-500' : 'bg-black/30 border-gray-600 focus-visible:ring-primary group-hover:border-gray-500'}`}
                                      aria-label={`Mark ${ach.name} as complete`}
                                    />
                                    {isCompleted && (
                                      <svg className="absolute w-3.5 h-3.5 text-black pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col">
                                  <div className="flex items-start justify-between gap-4 mb-1.5 flex-wrap">
                                    {!item.commonName && (
                                      <div className={`font-semibold text-base transition-colors ${isCompleted ? 'text-[var(--text)]/60 line-through' : 'text-[var(--text)]'}`}>
                                        {ach.name}
                                      </div>
                                    )}
                                    <div className={`flex items-center gap-2 shrink-0 ${!item.commonName ? '' : 'w-full justify-end'}`}>
                                      {ach.hidden && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-purple-900/20 text-purple-300 border-purple-500/20 whitespace-nowrap">
                                          Secret
                                        </span>
                                      )}
                                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-900/20 text-blue-300 border-blue-500/20 whitespace-nowrap">
                                        Stage {ach.stageIndex}/{ach.stageCount}
                                      </span>
                                      <div className="flex items-center gap-1 text-[#FDE047] font-semibold text-sm bg-black/20 px-2 py-0.5 rounded border border-[#FDE047]/20">
                                        <span>{ach.primogems}</span>
                                        <span className="text-xs">✦</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={`text-sm leading-relaxed mb-3 ${isCompleted ? 'text-[var(--muted)]/60' : 'text-[var(--muted)]'}`}>
                                    {ach.description}
                                  </div>
                                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--border)] border-opacity-40">
                                    <span className="text-[11px] text-[var(--muted)]/60 font-mono tracking-wide">ID: {ach.id}</span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/20 border border-[var(--border)]/50 text-[var(--muted)]">v{ach.version}</span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    const ach = item.achievement;
                    const isCompleted = !!achievementProgress[ach.id]?.completed;

                    return (
                      <label
                        key={ach.id}
                        className={`relative flex gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${
                          isCompleted
                            ? 'bg-green-900/10 border-green-500/30 hover:border-green-500/40'
                            : 'bg-white/5 border-[var(--border)] hover:border-[var(--border-light)]'
                        }`}
                      >
                        <div className="flex-shrink-0 pt-0.5">
                          <div className="relative flex items-center justify-center w-5 h-5">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={(e) => handleToggle(ach.id, e.target.checked)}
                              className={`w-5 h-5 rounded border-2 cursor-pointer appearance-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--elevated)] ${isCompleted ? 'bg-green-500 border-green-500 focus-visible:ring-green-500' : 'bg-black/30 border-gray-600 focus-visible:ring-primary group-hover:border-gray-500'}`}
                              aria-label={`Mark ${ach.name} as complete`}
                            />
                            {isCompleted && (
                              <svg className="absolute w-3.5 h-3.5 text-black pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-4 mb-1.5 flex-wrap">
                            <div className={`font-semibold text-base transition-colors ${isCompleted ? 'text-[var(--text)]/60 line-through' : 'text-[var(--text)]'}`}>
                              {ach.name}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
                              {ach.hidden && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-purple-900/20 text-purple-300 border-purple-500/20 whitespace-nowrap">
                                  Secret
                                </span>
                              )}
                              {ach.stageGroupId && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-blue-900/20 text-blue-300 border-blue-500/20 whitespace-nowrap">
                                  Stage {ach.stageIndex}/{ach.stageCount}
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-[#FDE047] font-semibold text-sm bg-black/20 px-2 py-0.5 rounded border border-[#FDE047]/20">
                                <span>{ach.primogems}</span>
                                <span className="text-xs">✦</span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm leading-relaxed mb-3 ${isCompleted ? 'text-[var(--muted)]/60' : 'text-[var(--muted)]'}`}>
                            {ach.description}
                          </div>
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--border)] border-opacity-40">
                            <span className="text-[11px] text-[var(--muted)]/60 font-mono tracking-wide">ID: {ach.id}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/20 border border-[var(--border)]/50 text-[var(--muted)]">v{ach.version}</span>
                          </div>
                        </div>
                      </label>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

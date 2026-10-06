import React from 'react';

export default function AchievementHero({
  overallStats,
  overallRecon,
  hoyolabConnected,
  reconciliationStatus,
  hoyolabError,
  fetchHoyolabData
}) {
  return (
    <div className="relative bg-[#0d1421]/90 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Decorative radial background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -left-32 -top-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-between">

        {/* Left: Title & Subtitle */}
        <div className="flex-1 min-w-0 text-center md:text-left z-10 md:max-w-[280px]">
          <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 mb-1 md:mb-1.5 tracking-wide">Achievements</h2>
          <p className="text-[var(--muted)] text-xs md:text-sm font-medium tracking-wide">Track your completion progress and Primogem rewards.</p>
        </div>

        {/* Center: Radial Progress & Stats */}
        <div className="flex-[1.5] flex flex-row items-center justify-center gap-4 md:gap-6 z-10 w-full md:w-auto">
          <div className="flex-shrink-0 relative">
            <div
              className="w-[82px] h-[82px] md:w-[110px] md:h-[110px] rounded-full flex flex-col items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.5),0_0_15px_rgba(0,240,255,0.15)] bg-black/40 border border-black/50"
              style={{
                background: `conic-gradient(var(--color-primary) ${overallStats.percentage}%, rgba(255,255,255,0.05) ${overallStats.percentage}%)`
              }}
            >
              <div className="w-[66px] h-[66px] md:w-[90px] md:h-[90px] rounded-full bg-[#0d1421] flex flex-col items-center justify-center border border-white/5 shadow-[inset_0_4px_10px_rgba(0,0,0,0.4)]">
                <span className="text-lg md:text-2xl font-bold text-white tracking-tight">{overallStats.percentage.toFixed(1)}<span className="text-[10px] md:text-xs text-white/70 ml-0.5">%</span></span>
              </div>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 md:p-3.5 flex flex-col justify-center gap-2 md:gap-3 shadow-inner min-w-[120px] md:min-w-[140px]">
            <div className="flex flex-col">
              <span className="text-[9px] text-[var(--muted)] font-bold uppercase tracking-widest mb-0.5">Progress</span>
              <span className="text-base md:text-lg font-bold text-white leading-none">
                {overallStats.completedCount.toLocaleString()} <span className="text-[10px] md:text-xs text-white/50 font-medium">/ {overallStats.totalCount.toLocaleString()}</span>
              </span>
            </div>
            <div className="w-full h-px bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#FDE047]/70 font-bold uppercase tracking-widest mb-0.5">Primogems</span>
              <span className="text-base md:text-lg font-bold text-[#FDE047] leading-none flex items-center gap-1.5">
                <span className="text-[10px] md:text-[11px] drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">✦</span>
                {overallStats.earnedPrimogems.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: HoYoLAB */}
        <div className="flex-1 flex justify-center md:justify-end w-full md:w-auto z-10 md:max-w-[280px]">
            <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 md:p-3 flex flex-row md:flex-col items-center md:items-stretch justify-between shadow-inner relative overflow-hidden w-full">
              {hoyolabConnected && reconciliationStatus === 'loading' && (
                <div className="absolute inset-0 bg-primary/5 animate-pulse" />
              )}
              <div className="flex items-center md:justify-between md:mb-1 relative z-10 mr-3 md:mr-0">
                <span className="text-[10px] md:text-[11px] text-[var(--muted)] font-bold uppercase tracking-widest">HoYoLAB Sync</span>
                {hoyolabConnected && (
                  <button
                    onClick={fetchHoyolabData}
                    disabled={reconciliationStatus === 'loading'}
                    className="hidden md:block text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-[var(--text)] px-2 py-0.5 rounded border border-white/10 transition-colors disabled:opacity-50"
                  >
                    Refresh
                  </button>
                )}
              </div>
              <div className="text-xs md:text-sm font-medium relative z-10 flex items-center justify-end md:justify-start flex-1 gap-2">
                {!hoyolabConnected ? (
                  <span className="text-white/50">Connect HoYoLAB to sync.</span>
                ) : reconciliationStatus === 'loading' ? (
                  <span className="text-white/70 flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : reconciliationStatus === 'error' ? (
                  <span className="text-red-400 truncate max-w-[120px] md:max-w-none">{hoyolabError}</span>
                ) : overallRecon ? (
                  overallRecon.difference === 0 ? (
                    <span className="text-teal-400 flex items-center gap-1.5 font-semibold">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Synced perfectly
                    </span>
                  ) : overallRecon.difference > 0 ? (
                    <span className="text-primary flex items-center gap-1.5 font-semibold">
                      <span className="bg-primary/20 px-2 py-0.5 rounded text-xs md:text-sm">+{overallRecon.difference}</span> <span className="hidden sm:inline">HoYoLAB</span>
                    </span>
                  ) : (
                    <span className="text-yellow-400 flex items-center gap-1.5 font-semibold">
                      <span className="bg-yellow-400/20 px-2 py-0.5 rounded text-xs md:text-sm">+{-overallRecon.difference}</span> <span className="hidden sm:inline">Toolkit</span>
                    </span>
                  )
                ) : (
                  <span className="text-white/50">No data</span>
                )}
                {hoyolabConnected && (
                  <button
                    onClick={fetchHoyolabData}
                    disabled={reconciliationStatus === 'loading'}
                    className="md:hidden text-[10px] font-semibold bg-white/5 hover:bg-white/10 text-[var(--text)] px-2 py-0.5 rounded border border-white/10 transition-colors disabled:opacity-50 ml-auto"
                  >
                    Refresh
                  </button>
                )}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

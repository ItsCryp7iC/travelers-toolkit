import React from 'react';

export default function AchievementCard({ ach, isCompleted, handleToggle }) {
  return (
    <label
      className={`relative flex gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-all duration-200 cursor-pointer group shadow-sm overflow-hidden ${
        isCompleted
          ? 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-900/20'
          : 'bg-black/20 border-white/5 hover:border-white/15 hover:bg-black/30'
      }`}
    >
      {/* Optional success glow */}
      {isCompleted && (
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
      )}

      {/* Checkbox */}
      <div className="flex-shrink-0 pt-0.5 md:pt-1 relative z-10">
        <div className="relative flex items-center justify-center w-6 h-6">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(e) => handleToggle(ach.id, e.target.checked)}
            className={`w-6 h-6 rounded-md border-2 cursor-pointer appearance-none transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 ${
              isCompleted
                ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-black/40 border-white/20 focus-visible:ring-primary group-hover:border-white/40'
            }`}
            aria-label={`Mark ${ach.name} as complete`}
          />
          {isCompleted && (
            <svg className="absolute w-4 h-4 text-black pointer-events-none drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">

        {/* Title Row */}
        <div className="flex items-start justify-between gap-2 md:gap-4 mb-1 md:mb-2">
          <div className={`font-bold text-sm md:text-base leading-tight md:leading-normal transition-colors duration-200 ${
            isCompleted ? 'text-white/70 line-through decoration-white/30' : 'text-white drop-shadow-sm'
          }`}>
            {ach.name}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center gap-1 text-[#FDE047] font-bold text-xs md:text-sm bg-black/40 px-2 md:px-3 py-0.5 md:py-1 rounded-md border border-[#FDE047]/20 shadow-inner min-w-[48px] md:min-w-[56px]">
              <span className="text-[9px] md:text-[10px] drop-shadow-[0_0_6px_rgba(253,224,71,0.5)]">✦</span>
              <span>{ach.primogems}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className={`text-[13px] md:text-sm leading-snug md:leading-relaxed mb-2.5 md:mb-4 transition-colors duration-200 ${
          isCompleted ? 'text-white/60' : 'text-white/70'
        }`}>
          {ach.description}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between mt-auto pt-2.5 md:pt-3 border-t border-white/5">
          <span className="text-[10px] text-white/30 font-mono tracking-wider">ID: {ach.id}</span>
          <div className="flex items-center gap-2">
            {ach.hidden && (
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-sm bg-purple-900/30 text-purple-300 border border-purple-500/20 whitespace-nowrap shadow-inner">
                Hidden
              </span>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-white/40">v{ach.version}</span>
          </div>
        </div>

      </div>
    </label>
  );
}

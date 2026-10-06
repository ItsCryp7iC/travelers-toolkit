import React from 'react';

export default function AchievementGroup({ item, achievementProgress, handleToggle }) {
  const completedCount = item.stages.filter(s => achievementProgress[s.id]?.completed).length;
  const isAllComplete = completedCount === item.stages.length;

  return (
    <div className={`flex flex-col bg-black/20 border rounded-xl overflow-hidden shadow-sm transition-colors duration-200 ${
      isAllComplete ? 'border-cyan-500/20' : 'border-white/5 hover:border-white/10'
    }`}>

      {/* Group Header */}
      {item.commonName && (
        <div className={`px-4 md:px-5 py-2.5 md:py-3 border-b flex justify-between items-center transition-colors duration-200 ${
          isAllComplete ? 'bg-cyan-950/30 border-cyan-500/20' : 'bg-black/40 border-white/5'
        }`}>
          <span className={`font-bold tracking-wide text-base md:text-lg ${isAllComplete ? 'text-white/80' : 'text-white drop-shadow-sm'}`}>
            {item.commonName}
          </span>
          <div className="flex items-center gap-2">
            {/* Dots representation */}
            <div className="hidden sm:flex gap-1.5 mr-2">
              {item.stages.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < completedCount ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]' : 'bg-white/20'}`} />
              ))}
            </div>
            <span className={`text-[11px] md:text-xs font-bold px-2 py-1 rounded shadow-inner ${
              isAllComplete ? 'bg-cyan-900/30 text-cyan-400' : 'bg-white/10 text-white/60'
            }`}>
              {completedCount} / {item.stages.length} Complete
            </span>
          </div>
        </div>
      )}

      {/* Stages list */}
      <div className="flex flex-col relative">
        {/* Subtle connecting line for stages */}
        <div className="absolute left-[29px] md:left-[33px] top-8 bottom-8 w-px bg-white/10 pointer-events-none z-0" />

        <div className="flex flex-col divide-y divide-white/5">
          {item.stages.map((ach, idx) => {
            const isCompleted = !!achievementProgress[ach.id]?.completed;

            return (
              <label
                key={ach.id}
                className={`relative z-10 flex gap-3 md:gap-4 p-3 md:p-4 transition-all duration-200 cursor-pointer group ${
                  isCompleted ? 'bg-cyan-950/10 hover:bg-cyan-950/20' : 'hover:bg-white/5'
                }`}
              >
                {/* Node indicator on the line */}
                <div className="absolute left-[31px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-black border border-white/20 z-0 hidden sm:block" />

                <div className="flex-shrink-0 pt-0.5 md:pt-1 relative z-10">
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      onChange={(e) => handleToggle(ach.id, e.target.checked)}
                      className={`w-6 h-6 rounded-md border-2 cursor-pointer appearance-none transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 ${
                        isCompleted
                          ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                          : 'bg-black/60 border-white/20 focus-visible:ring-primary group-hover:border-white/40'
                      }`}
                      aria-label={`Mark Stage ${ach.stageIndex} as complete`}
                    />
                    {isCompleted && (
                      <svg className="absolute w-4 h-4 text-black pointer-events-none drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2 md:gap-4 mb-1 md:mb-2">

                    {/* Only show title if it doesn't match the group commonName */}
                    {!item.commonName && (
                      <div className={`font-bold text-sm md:text-base leading-tight md:leading-normal transition-colors duration-200 ${
                        isCompleted ? 'text-white/70 line-through decoration-white/30' : 'text-white drop-shadow-sm'
                      }`}>
                        {ach.name}
                      </div>
                    )}

                    <div className={`flex items-center gap-1.5 md:gap-2 shrink-0 flex-wrap sm:flex-nowrap ${!item.commonName ? 'justify-end sm:justify-start' : 'justify-end w-full'}`}>
                      {ach.hidden && (
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-sm bg-purple-900/30 text-purple-300 border border-purple-500/20 whitespace-nowrap shadow-inner">
                          Secret
                        </span>
                      )}
                      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-1.5 md:px-2 py-0.5 rounded-sm bg-blue-900/30 text-blue-300 border border-blue-500/20 whitespace-nowrap shadow-inner">
                        Stage {ach.stageIndex}/{ach.stageCount}
                      </span>
                      <div className="flex items-center justify-center gap-1 text-[#FDE047] font-bold text-xs md:text-sm bg-black/40 px-2 md:px-3 py-0.5 md:py-1 rounded-md border border-[#FDE047]/20 shadow-inner min-w-[48px] md:min-w-[56px]">
                        <span className="text-[9px] md:text-[10px] drop-shadow-[0_0_6px_rgba(253,224,71,0.5)]">✦</span>
                        <span>{ach.primogems}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`text-[13px] md:text-sm leading-snug md:leading-relaxed mb-2.5 md:mb-3 transition-colors duration-200 ${
                    isCompleted ? 'text-white/60' : 'text-white/70'
                  }`}>
                    {ach.description}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2.5 md:pt-3 border-t border-white/5 border-opacity-50">
                    <span className="text-[10px] text-white/30 font-mono tracking-wider">ID: {ach.id}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 text-white/40">v{ach.version}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

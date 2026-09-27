import React from 'react';
import InlineNumberInput from '../../InlineNumberInput';
import { toggleMilestoneAscension, isMilestone } from '../../../utils/calculator';
import { isAscended } from './tableDisplayUtils';

export default function AscensionLevelCell({
  level,
  ascension,
  onLevelChange,
  onAscensionChange,
  inputClassName = "text-xs text-[var(--text)]"
}) {
  return (
    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
      <InlineNumberInput
        value={level}
        min={1}
        max={90}
        onChangeSubmit={onLevelChange}
        className={inputClassName}
      />

      {isAscended(level, ascension) && level < 90 && (
        <img
          src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png"
          alt="Ascended"
          className={`w-3 h-3 object-contain ml-1 select-none transition-colors ${
            isMilestone(level)
              ? 'cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-100'
              : 'cursor-default text-white/30 opacity-80'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (isMilestone(level)) {
              onAscensionChange(toggleMilestoneAscension(level, ascension));
            }
          }}
        />
      )}

      {!isAscended(level, ascension) && isMilestone(level) && (
        <img
          src="https://raw.githubusercontent.com/ItsCryp7iC/travelers-toolkit-image-resources/refs/heads/main/others/AscensionWhite.png"
          alt="Unascended"
          className="w-3 h-3 object-contain ml-1 select-none transition-colors cursor-pointer text-white hover:text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.8)] opacity-50 grayscale"
          onClick={(e) => {
            e.stopPropagation();
            onAscensionChange(toggleMilestoneAscension(level, ascension));
          }}
        />
      )}
    </div>
  );
}

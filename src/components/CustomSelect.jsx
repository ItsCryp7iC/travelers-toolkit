import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyles, setDropdownStyles] = useState({});
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.id === value) || null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyles({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  const getStarCount = (rarity) => {
    if (typeof rarity === 'string') {
      const match = rarity.match(/★/g);
      if (match) return match.length;
      return parseInt(rarity.match(/\d+/)?.[0]) || 0;
    }
    return parseInt(rarity) || 0;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Selected Value Display */}
      <div 
        className="w-full px-3 py-2.5 bg-[#161B22] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] flex items-center justify-between cursor-pointer focus:outline-none hover:border-gray-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <img src={selectedOption.icon} alt={selectedOption.name} className="w-6 h-6 object-contain rounded" />
              )}
              <div className="flex flex-col">
                <span className="text-sm text-gray-200">{selectedOption.name}</span>
                {selectedOption.subtitle && <span className="text-xs text-gray-500">{selectedOption.subtitle}</span>}
              </div>
            </>
          ) : (
            <span className="text-gray-500 text-sm">{placeholder || 'Select an option...'}</span>
          )}
        </div>
        <span className="text-gray-400 text-xs">&#9662;</span>
      </div>

      {/* Dropdown Menu via Portal */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={dropdownStyles}
          className="max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-md shadow-2xl custom-scrollbar"
        >
          {options.map((option) => {
            const stars = getStarCount(option.rarity);
            return (
              <div 
                key={option.id} 
                className={`flex items-center justify-between p-2 hover:bg-white/10 cursor-pointer transition-colors border-b border-gray-800 last:border-0 ${value === option.id ? 'bg-white/5' : ''}`}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
              >
                {/* Left Side */}
                <div className="flex items-center gap-3 flex-1">
                  {/* Icon & Rarity Column */}
                  {option.icon ? (
                    <div className="flex flex-col items-center w-10">
                      <img src={option.icon} alt={option.name} className="w-8 h-8 object-contain rounded" />
                      {/* Render stars */}
                      {stars > 0 && (
                        <div className="text-[8px] text-yellow-400 tracking-tighter mt-1 leading-none text-center w-full">
                          {'★'.repeat(stars)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 flex justify-center items-center">
                      <div className="w-8 h-8 bg-black/20 rounded border border-gray-700"></div>
                    </div>
                  )}
                  
                  {/* Name & Extra Info */}
                  <div className="flex flex-col justify-center">
                    <span className="text-sm text-gray-200">{option.name}</span>
                    {option.subtitle && <span className="text-xs text-gray-500">{option.subtitle}</span>}
                  </div>
                </div>

                {/* Right Side: Secondary Icon */}
                {option.secondaryIcon && (
                  <div className="flex-shrink-0 ml-3">
                    <img src={option.secondaryIcon} alt="Secondary" className="w-8 h-8 object-contain rounded opacity-80" />
                  </div>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

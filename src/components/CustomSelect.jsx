import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyles, setDropdownStyles] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

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
      // Assume a max height of 320px if ref isn't ready yet
      const dropdownHeight = dropdownRef.current ? dropdownRef.current.getBoundingClientRect().height : 320;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + 4;
      let bottom = 'auto';
      let maxHeight = 320; // 320px = 20rem (max-h-80)

      // If there's not enough room below, but there is more room above than below, flip upward
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = 'auto';
        bottom = window.innerHeight - rect.top + 4;
        maxHeight = Math.min(320, spaceAbove - 8);
      } else {
        // Open downward, but constrain height if space is very tight
        maxHeight = Math.min(320, spaceBelow - 8);
      }

      setDropdownStyles({
        position: 'fixed',
        top,
        bottom,
        left: rect.left,
        width: rect.width,
        maxHeight: `${maxHeight}px`,
        zIndex: 99999,
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      // Call it a second time just in case rendering the children changed the height
      requestAnimationFrame(updatePosition);
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      // Auto-focus input when opened
      if (inputRef.current) setTimeout(() => inputRef.current.focus(), 50);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setSearchQuery('');
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

  const filteredOptions = options.filter(opt => 
    opt.id === '' || // always show "Unassigned" option if present
    (opt.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          className="max-h-80 flex flex-col bg-gray-900 border border-gray-700 rounded-md shadow-2xl overflow-hidden"
        >
          <div className="sticky top-0 z-10 p-2 bg-gray-900 border-b border-gray-800">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#161B22] border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No results found.</div>
            ) : (
              filteredOptions.map((option) => {
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
                            <div className="text-xs text-yellow-400 tracking-tighter mt-1 leading-none text-center w-full">
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
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

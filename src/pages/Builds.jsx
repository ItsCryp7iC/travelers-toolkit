import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  loadBuildsCatalog,
  findCharacterBuild,
  getDefaultRoleId,
} from '../services/buildsCatalogService';
import GenshinImage from '../components/GenshinImage';
import {
  getCharacterAvatar,
  getElementIcon,
  getWeaponTypeIcon,
} from '../utils/assetHelper';
import { ELEMENTS } from '../utils/gameData';
import WeaponRecommendations from '../components/builds/WeaponRecommendations';
import ArtifactRecommendations from '../components/builds/ArtifactRecommendations';
import ArtifactStatPriorities from '../components/builds/ArtifactStatPriorities';
import TalentPriorities from '../components/builds/TalentPriorities';
import BuildEditorialNotes from '../components/builds/BuildEditorialNotes';

export default function Builds() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Catalog loading state
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Combobox state
  const [comboboxQuery, setComboboxQuery] = useState('');
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Refs for click outside and scrolling
  const comboboxRef = useRef(null);
  const listboxRef = useRef(null);

  // 1. Load catalog on mount
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    loadBuildsCatalog()
      .then((data) => {
        if (isMounted) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load Character Builds catalog');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Read selections from URL search params
  const characterParam = searchParams.get('character');
  const roleParam = searchParams.get('role');

  // 3. Resolve active character
  const selectedCharacter = useMemo(() => {
    if (!catalog || !characterParam) return null;
    return findCharacterBuild(catalog, characterParam);
  }, [catalog, characterParam]);

  // 4. Resolve active role
  const selectedRole = useMemo(() => {
    if (
      !selectedCharacter ||
      !Array.isArray(selectedCharacter.roles) ||
      selectedCharacter.roles.length === 0
    ) {
      return null;
    }
    // If an explicit roleParam is provided, check if it matches a valid role
    if (roleParam) {
      const match = selectedCharacter.roles.find(
        (r) => r.roleId.toLowerCase() === roleParam.toLowerCase(),
      );
      if (match) return match;
    }
    // If roleParam is missing or invalid, resolve the recommended default role
    const defaultRoleId = getDefaultRoleId(selectedCharacter);
    if (defaultRoleId) {
      const match = selectedCharacter.roles.find(
        (r) => r.roleId.toLowerCase() === defaultRoleId.toLowerCase(),
      );
      if (match) return match;
    }
    return selectedCharacter.roles[0] || null;
  }, [selectedCharacter, roleParam]);

  // 5. Canonicalize URL when character is selected but roleParam is missing or invalid
  useEffect(() => {
    if (!selectedCharacter || !selectedRole) return;
    if (roleParam !== selectedRole.roleId) {
      setSearchParams(
        { character: selectedCharacter.characterId, role: selectedRole.roleId },
        { replace: true },
      );
    }
  }, [selectedCharacter, selectedRole, roleParam, setSearchParams]);

  // Click outside listener for combobox
  useEffect(() => {
    function handleClickOutside(e) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsComboboxOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filtered characters for combobox
  const filteredCharacters = useMemo(() => {
    if (!catalog || !Array.isArray(catalog.characters)) return [];
    const q = comboboxQuery.trim().toLowerCase();
    if (!q) return catalog.characters;

    return catalog.characters.filter((char) => {
      const matchName = char.characterName.toLowerCase().includes(q);
      const matchId = char.characterId.toLowerCase().includes(q);
      const matchSlug = char.characterSlug.toLowerCase().includes(q);
      const matchElem = char.element.toLowerCase().includes(q);
      const matchWeapon = char.weaponType.toLowerCase().includes(q);
      const matchRole = char.roles.some((r) =>
        r.displayName.toLowerCase().includes(q),
      );
      return matchName || matchId || matchSlug || matchElem || matchWeapon || matchRole;
    });
  }, [catalog, comboboxQuery]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isComboboxOpen && listboxRef.current) {
      const item = listboxRef.current.children[highlightedIndex];
      if (item && typeof item.scrollIntoView === 'function') {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isComboboxOpen]);

  // Select character handler
  const handleSelectCharacter = useCallback(
    (char) => {
      if (!char) {
        setSearchParams({}, { replace: false });
        setComboboxQuery('');
        setIsComboboxOpen(false);
        return;
      }

      const defaultRoleId = getDefaultRoleId(char);
      const nextParams = { character: char.characterId };
      if (defaultRoleId) {
        nextParams.role = defaultRoleId;
      }

      setSearchParams(nextParams, { replace: false });
      setComboboxQuery('');
      setIsComboboxOpen(false);
    },
    [setSearchParams],
  );

  // Clear character selection
  const handleClearCharacter = useCallback(() => {
    setSearchParams({}, { replace: false });
    setComboboxQuery('');
    setIsComboboxOpen(false);
  }, [setSearchParams]);

  // Select role handler
  const handleSelectRole = useCallback(
    (roleId) => {
      if (!selectedCharacter) return;
      if (!roleId) {
        const defaultRoleId = getDefaultRoleId(selectedCharacter);
        if (defaultRoleId) {
          setSearchParams(
            { character: selectedCharacter.characterId, role: defaultRoleId },
            { replace: false },
          );
        } else {
          setSearchParams({ character: selectedCharacter.characterId }, { replace: false });
        }
      } else {
        setSearchParams(
          { character: selectedCharacter.characterId, role: roleId },
          { replace: false },
        );
      }
    },
    [selectedCharacter, setSearchParams],
  );

  // Combobox keyboard navigation
  const handleComboboxKeyDown = (e) => {
    if (!isComboboxOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsComboboxOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCharacters.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(filteredCharacters.length - 1, 0),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCharacters.length > 0 && filteredCharacters[highlightedIndex]) {
        handleSelectCharacter(filteredCharacters[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsComboboxOpen(false);
      setComboboxQuery('');
    } else if (e.key === 'Tab') {
      setIsComboboxOpen(false);
    }
  };

  // Determine combobox input value
  const displayInputValue = isComboboxOpen
    ? comboboxQuery
    : selectedCharacter
      ? selectedCharacter.characterName
      : '';

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center w-full min-h-[60vh] gap-3 px-4"
      >
        <div className="w-10 h-10 border-4 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm animate-pulse">
          Loading Character Builds catalog...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-8 max-w-lg mx-auto">
          <div className="text-red-400 text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Unable to Load Character Builds
          </h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const attributionUrl =
    catalog?.sourceAttribution ||
    'https://genshin-impact-helper-team.github.io/genshin-builds/';

  const elConfig = selectedCharacter
    ? ELEMENTS[selectedCharacter.element] || ELEMENTS.Unknown
    : null;

  const guideRoleUrl = selectedRole?.guideUrl
    ? selectedRole.guideUrl
    : selectedCharacter?.guideUrl
      ? `${selectedCharacter.guideUrl}${selectedRole ? `?build=${selectedRole.roleId}` : ''}`
      : attributionUrl;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page Header & Attribution ── */}
      <header className="border-b border-white/10 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl" aria-hidden="true">
                📖
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Character Build Sheet
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Select a character and playstyle role to view curated equipment priorities,
              weapon rankings, artifact stats, and talent sequences.
            </p>
          </div>

          {/* Attribution Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-900/60 border border-white/10 rounded-lg px-3.5 py-2 text-xs">
            <span className="text-slate-400">Recommendations by</span>
            <a
              href={attributionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 underline underline-offset-2 transition-colors"
            >
              Genshin Impact Helper Team
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Selector Toolbar (Searchable Combobox & Role Buttons) ── */}
      {/* High z-index stacking context ensures combobox dropdown floats above all content */}
      <section
        aria-label="Character and Role Selectors"
        className="relative z-30 bg-slate-900/80 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* 1. Character Combobox */}
          <div className="space-y-1.5 relative z-20" ref={comboboxRef}>
            <label
              id="char-combobox-label"
              htmlFor="character-combobox-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              1. Select Character
            </label>

            <div className="relative">
              {/* Character thumbnail or Search icon */}
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {selectedCharacter ? (
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-white/20 bg-slate-800 flex-shrink-0">
                    <GenshinImage
                      src={getCharacterAvatar(selectedCharacter.characterId)}
                      alt=""
                      className="w-full h-full object-cover object-top"
                      fallback={<span>👤</span>}
                    />
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm" aria-hidden="true">
                    🔍
                  </span>
                )}
              </div>

              <input
                id="character-combobox-input"
                role="combobox"
                aria-labelledby="char-combobox-label"
                aria-expanded={isComboboxOpen}
                aria-autocomplete="list"
                aria-controls="character-listbox"
                aria-activedescendant={
                  isComboboxOpen && filteredCharacters[highlightedIndex]
                    ? `char-option-${filteredCharacters[highlightedIndex].characterId}`
                    : undefined
                }
                type="text"
                value={displayInputValue}
                onChange={(e) => {
                  setComboboxQuery(e.target.value);
                  setIsComboboxOpen(true);
                  setHighlightedIndex(0);
                }}
                onFocus={() => {
                  setIsComboboxOpen(true);
                  setComboboxQuery('');
                }}
                onKeyDown={handleComboboxKeyDown}
                placeholder="Type character name (e.g. Raiden, Ayaka, Furina)..."
                className={`w-full pl-11 pr-16 py-2.5 bg-slate-950/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition ${selectedCharacter
                  ? 'border-sky-500/50 ring-1 ring-sky-500/30'
                  : 'border-white/10 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30'
                  }`}
                autoComplete="off"
              />

              {/* Action buttons (Clear and Dropdown Toggle) */}
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
                {selectedCharacter && (
                  <button
                    type="button"
                    onClick={handleClearCharacter}
                    className="p-1 text-slate-400 hover:text-white rounded transition"
                    aria-label="Clear selected character"
                    title="Clear selection"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsComboboxOpen((prev) => !prev);
                    if (!isComboboxOpen) setComboboxQuery('');
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded transition"
                  aria-label="Toggle character list"
                  tabIndex={-1}
                >
                  <span
                    className={`inline-block transition-transform duration-200 text-xs ${isComboboxOpen ? 'rotate-180' : ''}`}
                  >
                    ▼
                  </span>
                </button>
              </div>
            </div>

            {/* Combobox Dropdown Listbox (renders above all cards via parent z-30 and local z-30) */}
            {isComboboxOpen && (
              <ul
                id="character-listbox"
                role="listbox"
                aria-labelledby="char-combobox-label"
                ref={listboxRef}
                className="absolute left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto bg-slate-950 border border-white/15 rounded-xl shadow-2xl z-30 py-1 divide-y divide-white/5"
              >
                {filteredCharacters.length === 0 ? (
                  <li className="px-4 py-4 text-center text-xs text-slate-400">
                    No characters found matching &ldquo;{comboboxQuery}&rdquo;
                  </li>
                ) : (
                  filteredCharacters.map((char, index) => {
                    const isSelected =
                      selectedCharacter?.characterId === char.characterId;
                    const isHighlighted = highlightedIndex === index;
                    const cElem = ELEMENTS[char.element] || ELEMENTS.Unknown;

                    return (
                      <li
                        key={char.characterId}
                        id={`char-option-${char.characterId}`}
                        role="option"
                        aria-selected={isSelected}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCharacter(char);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${isHighlighted
                          ? 'bg-sky-600/20 text-white'
                          : isSelected
                            ? 'bg-slate-800/80 text-sky-300'
                            : 'text-slate-200 hover:bg-slate-900'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Portrait Thumbnail */}
                          <div
                            className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative"
                            style={{
                              background:
                                cElem.avatarGradient ||
                                'linear-gradient(145deg, #1e293b, #0f172a)',
                            }}
                          >
                            <GenshinImage
                              src={getCharacterAvatar(char.characterId)}
                              alt=""
                              className="w-full h-full object-cover object-top"
                              fallback={
                                <span className="flex items-center justify-center w-full h-full text-[10px] font-bold text-white/50">
                                  {char.characterName.slice(0, 2)}
                                </span>
                              }
                            />
                          </div>

                          {/* Name and Meta */}
                          <div className="truncate">
                            <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                              <span>{char.characterName}</span>
                              {isSelected && (
                                <span
                                  className="text-sky-400 text-xs"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <span style={{ color: cElem.color }}>
                                {char.element}
                              </span>
                              <span>•</span>
                              <span>{char.weaponType}</span>
                            </div>
                          </div>
                        </div>

                        {/* Rarity & Role Count Badge */}
                        <div className="flex flex-col items-end flex-shrink-0 text-right">
                          <span
                            className={`text-[10px] font-bold ${char.rarity === 5
                              ? 'text-amber-400'
                              : 'text-purple-400'
                              }`}
                          >
                            {char.rarity === 5 ? '★★★★★' : '★★★★'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {char.roles.length}{' '}
                            {char.roles.length === 1 ? 'role' : 'roles'}
                          </span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          {/* 2. Build Role Selection — Fast Buttons */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                id="role-selection-label"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                2. Select Build Role / Playstyle
              </label>
              {selectedCharacter && (
                <span className="text-[11px] text-slate-500">
                  {selectedCharacter.roles.length}{' '}
                  {selectedCharacter.roles.length === 1
                    ? 'build available'
                    : 'builds available'}
                </span>
              )}
            </div>

            {!selectedCharacter ? (
              // Disabled state: prompt user to pick character first
              <div
                aria-disabled="true"
                className="w-full min-h-[42px] px-3.5 py-2.5 bg-slate-950/40 border border-dashed border-white/10 rounded-xl text-xs text-slate-500 flex items-center justify-between"
              >
                <span>Select a character to view available builds.</span>
                <span className="text-xs text-slate-600" aria-hidden="true">
                  🔒
                </span>
              </div>
            ) : (
              // Active state: accessible role button group
              <div
                role="group"
                aria-labelledby="role-selection-label"
                className="flex flex-wrap gap-2 pt-0.5"
              >
                {selectedCharacter.roles.map((role) => {
                  const isActive = selectedRole?.roleId === role.roleId;

                  return (
                    <button
                      key={role.roleId}
                      id={`role-btn-${role.roleId}`}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleSelectRole(role.roleId)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-400/50 ${isActive
                        ? 'bg-sky-500 text-white font-semibold shadow-md shadow-sky-500/25 border border-sky-400'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                        }`}
                    >
                      <span className="whitespace-normal text-left">
                        {role.displayName}
                      </span>

                      {role.isBest && (
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          title="Recommended Best Build"
                        >
                          ★ Best
                        </span>
                      )}

                      {role.status === 'wip' && (
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          title="Work in Progress"
                        >
                          WIP
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── State 1: Invalid Character Fallback ── */}
      {characterParam && !selectedCharacter && (
        <section
          aria-label="Character Not Found"
          className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 max-w-lg mx-auto text-center space-y-4 my-8"
        >
          <div className="text-4xl" aria-hidden="true">
            🔎
          </div>
          <h2 className="text-xl font-bold text-white">Character Not Found</h2>
          <p className="text-slate-400 text-sm">
            No build recommendations were found for identifier &ldquo;{characterParam}&rdquo;.
          </p>
          <button
            type="button"
            onClick={handleClearCharacter}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ← Clear and Choose from All Characters
          </button>
        </section>
      )}

      {/* ── State 2: Welcome / Initial Empty State (No Character Selected) ── */}
      {!characterParam && (
        <section
          aria-label="Welcome Guide"
          className="bg-slate-900/40 border border-white/10 rounded-2xl p-8 sm:p-12 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            📖
          </div>
          <div className="max-w-xl mx-auto space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Select a Character to View Recommended Builds
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Use the searchable dropdown above to select any of the 129 playable characters.
              Once selected, choose an available build role button to view curated weapon rankings,
              artifact sets, main stats, and talent priority sequences.
            </p>
          </div>

          {/* Quick-Select Popular Suggestions */}
          <div className="pt-4 border-t border-white/5 max-w-2xl mx-auto space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Popular Quick Selections:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'RaidenShogun', name: 'Raiden Shogun' },
                { id: 'KamisatoAyaka', name: 'Kamisato Ayaka' },
                { id: 'Bennett', name: 'Bennett' },
                { id: 'Furina', name: 'Furina' },
                { id: 'Nahida', name: 'Nahida' },
                { id: 'Kazuha', name: 'Kaedehara Kazuha' },
                { id: 'TravelerAnemo', name: 'Anemo Traveler' },
              ].map((quick) => (
                <button
                  key={quick.id}
                  type="button"
                  onClick={() => {
                    const match = findCharacterBuild(catalog, quick.id);
                    if (match) handleSelectCharacter(match);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs font-medium text-slate-200 transition"
                >
                  {quick.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── State 3: Character Selected, Role Not Yet Selected ── */}
      {selectedCharacter && !selectedRole && (
        <section aria-label="Role Selection Prompt" className="space-y-6">
          {/* Character Identity Banner */}
          <div className="relative bg-slate-900/70 border border-white/10 rounded-2xl p-5 sm:p-6 overflow-hidden">
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: elConfig?.color || '#38bdf8' }}
              aria-hidden="true"
            />
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/20 shadow-md relative"
                style={{
                  background:
                    elConfig?.avatarGradient ||
                    'linear-gradient(145deg, #1e293b, #0f172a)',
                }}
              >
                <GenshinImage
                  src={getCharacterAvatar(selectedCharacter.characterId)}
                  alt={selectedCharacter.characterName}
                  className="w-full h-full object-cover object-top"
                  fallback={
                    <span className="flex items-center justify-center w-full h-full text-xl font-bold text-white/50">
                      {selectedCharacter.characterName.slice(0, 2)}
                    </span>
                  }
                />
                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-white/10 shadow-sm">
                  <GenshinImage
                    src={getElementIcon(selectedCharacter.element)}
                    alt={selectedCharacter.element}
                    className="w-3.5 h-3.5 object-contain"
                    fallback={<span>{elConfig?.emoji}</span>}
                  />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {selectedCharacter.characterName}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-medium">
                    {selectedCharacter.rarity === 5
                      ? '★★★★★ 5-Star'
                      : '★★★★ 4-Star'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: elConfig?.color }}
                  >
                    <span>{elConfig?.emoji}</span>
                    <span>{selectedCharacter.element}</span>
                  </span>
                  <span>•</span>
                  <span>{selectedCharacter.weaponType}</span>
                  <span>•</span>
                  <span>
                    {selectedCharacter.roles?.length || 0} Available Roles
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt Card with Clickable Role Cards */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 sm:p-8 text-center space-y-4">
            <div className="text-3xl" aria-hidden="true">
              🎯
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-bold text-white">
                {selectedCharacter.roles?.length === 0
                  ? `No Builds Available for ${selectedCharacter.characterName}`
                  : `Select a Build Role for ${selectedCharacter.characterName}`}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedCharacter.roles?.length === 0
                  ? 'No build recommendations have been published for this character yet.'
                  : 'Choose an available playstyle role button above or below to load the complete build sheet.'}
              </p>
            </div>

            {/* Clickable Role Cards */}
            {selectedCharacter.roles?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 max-w-3xl mx-auto text-left">
                {selectedCharacter.roles.map((role) => (
                  <button
                    key={role.roleId}
                    type="button"
                    onClick={() => handleSelectRole(role.roleId)}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 hover:border-sky-400/50 hover:bg-slate-900 transition flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                        {role.displayName}
                      </span>
                      {role.isBest && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                          ★ Best
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
                      <span>
                        {role.reviewedVersion
                          ? `v${role.reviewedVersion}`
                          : 'Reviewed'}
                      </span>
                      {role.status === 'wip' && (
                        <span className="text-amber-400 font-medium">WIP</span>
                      )}
                      <span className="text-sky-400 text-xs group-hover:translate-x-0.5 transition-transform">
                        Select →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── State 4: Character AND Role Both Selected (Full Continuous Build Sheet) ── */}
      {selectedCharacter && selectedRole && (
        <main
          role="region"
          aria-label={`Build Sheet for ${selectedCharacter.characterName} (${selectedRole.displayName})`}
          className="space-y-6"
        >
          {/* Section A: Character & Role Identity Header */}
          <section
            aria-label="Character Header"
            className="relative bg-slate-900/70 border border-white/10 rounded-2xl p-5 sm:p-6 overflow-hidden shadow-lg"
          >
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: elConfig?.color || '#38bdf8' }}
              aria-hidden="true"
            />

            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5 relative z-10">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                {/* Character Portrait */}
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/20 shadow-md relative"
                  style={{
                    background:
                      elConfig?.avatarGradient ||
                      'linear-gradient(145deg, #1e293b, #0f172a)',
                  }}
                >
                  <GenshinImage
                    src={getCharacterAvatar(selectedCharacter.characterId)}
                    alt={selectedCharacter.characterName}
                    className="w-full h-full object-cover object-top"
                    fallback={
                      <span className="flex items-center justify-center w-full h-full text-xl font-bold text-white/50">
                        {selectedCharacter.characterName.slice(0, 2)}
                      </span>
                    }
                  />
                  <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-white/10 shadow-sm">
                    <GenshinImage
                      src={getElementIcon(selectedCharacter.element)}
                      alt={selectedCharacter.element}
                      className="w-3.5 h-3.5 object-contain"
                      fallback={<span>{elConfig?.emoji}</span>}
                    />
                  </div>
                </div>

                {/* Character Meta & Role Title */}
                <div className="text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {selectedCharacter.characterName}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white font-medium">
                      {selectedCharacter.rarity === 5
                        ? '★★★★★ 5-Star'
                        : '★★★★ 4-Star'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-400">
                    <span
                      className="inline-flex items-center gap-1 font-medium"
                      style={{ color: elConfig?.color }}
                    >
                      <span>{elConfig?.emoji}</span>
                      <span>{selectedCharacter.element}</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <GenshinImage
                        src={getWeaponTypeIcon(selectedCharacter.weaponType)}
                        alt=""
                        className="w-3.5 h-3.5 object-contain"
                        fallback={null}
                      />
                      <span>{selectedCharacter.weaponType}</span>
                    </span>
                    <span>•</span>
                    <span className="text-sky-300 font-semibold">
                      Role: {selectedRole.displayName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                    {selectedRole.isBest && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        ★ Recommended Role
                      </span>
                    )}
                    {selectedRole.status === 'wip' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        Work In Progress
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {selectedRole.reviewedVersion
                        ? `Reviewed for Game Version: ${selectedRole.reviewedVersion}`
                        : 'Reviewed by Helper Team contributors.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Guide Link Button */}
              <div className="flex-shrink-0 pt-2 sm:pt-0">
                <a
                  href={guideRoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-medium transition-colors"
                  title="Open original guide on Genshin Impact Helper Team website"
                >
                  <span>Helper Team Guide</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>

            {/* WIP Communication Notice */}
            {selectedRole.status === 'wip' && (
              <div
                role="note"
                className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs"
              >
                <span className="text-amber-400 text-base leading-none">⚠️</span>
                <div>
                  <strong className="font-semibold">Work In Progress Notice:</strong>{' '}
                  This playstyle recommendation is currently marked as WIP by the
                  Genshin Impact Helper Team. Calculations, talent priorities, and
                  weapon tiers are undergoing active verification.
                </div>
              </div>
            )}
          </section>

          {/* Section B: Primary Equipment Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <WeaponRecommendations
              weapons={selectedRole.weapons}
              weaponType={selectedCharacter.weaponType}
            />
            <ArtifactRecommendations artifacts={selectedRole.artifacts} />
          </div>

          {/* Section C: Optimization Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ArtifactStatPriorities artifacts={selectedRole.artifacts} />
            <TalentPriorities talents={selectedRole.talents} />
          </div>

          {/* Section D: Editorial Guidance, Gameplay Tips & Credits */}
          <BuildEditorialNotes
            notes={selectedRole.notes}
            gameplayTips={selectedRole.gameplayTips}
            calculationCredits={selectedRole.calculationCredits}
            guideRoleUrl={guideRoleUrl}
          />
        </main>
      )}

      {/* ── Footer Source Attribution Notice ── */}
      <footer className="pt-8 pb-4 text-center text-xs text-slate-500 border-t border-white/5 space-y-1.5">
        <p>
          Character build recommendations, weapon rankings, and talent notes
          provided by{' '}
          <a
            href={attributionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
          >
            Genshin Impact Helper Team
          </a>{' '}
        </p>
        <p>
          Traveler&apos;s Toolkit is an independent companion utility and is not
          affiliated with or endorsed by the Genshin Impact Helper Team or HoYoverse.
        </p>
      </footer>
    </div>
  );
}

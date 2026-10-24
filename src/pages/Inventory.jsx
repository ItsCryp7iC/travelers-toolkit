import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useStore from '../store/useStore';
import { getPrimaryInventoryList } from '../utils/dataManager';
import { getRarityBg } from '../utils/gameData';
import { getMaterialIcon } from '../utils/assetHelper';
import GenshinImage from '../components/GenshinImage';
import { getInventoryTabId, filterMaterialsByTab, INVENTORY_TABS, formatInventoryQuantity } from '../utils/inventoryFilters';
import SortDirectionButton from '../components/SortDirectionButton';
import { compareNullableNumber, compareNullableString } from '../utils/sortUtils';

const getCardOuterBg = (rarity) => {
  const r = parseInt(rarity, 10);
  switch (r) {
    case 5: return "bg-gradient-to-b from-yellow-700/20 to-gray-900/80 border-yellow-700/30";
    case 4: return "bg-gradient-to-b from-purple-700/20 to-gray-900/80 border-purple-700/30";
    case 3: return "bg-gradient-to-b from-blue-700/20 to-gray-900/80 border-blue-700/30";
    case 2: return "bg-gradient-to-b from-green-700/20 to-gray-900/80 border-green-700/30";
    case 1: return "bg-gradient-to-b from-gray-600/20 to-gray-900/80 border-gray-600/30";
    default: return "bg-gradient-to-b from-gray-800/40 to-gray-900/90 border-gray-700/50";
  }
};

// ─── Stepper Card — Portrait Layout ───────────────────────────────────────
function MaterialCard({ matKey, label, accent, sublabel, iconCategory, rarity }) {
  const qty          = useStore((s) => s.inventory[matKey] || 0);
  const setInventory = useStore((s) => s.setInventory);

  const handleChange = (v) => {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0) setInventory(matKey, n);
  };

  const step = (delta) => setInventory(matKey, Math.max(0, qty + delta));

  const accentColor = accent || '#C8A96E';
  const rarityBgClass = getRarityBg(rarity || 0);
  const iconUrl = getMaterialIcon(label, iconCategory);

  return (
    <div
      className={`flex flex-col items-center justify-between p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border w-full h-full group backdrop-blur-sm ${getCardOuterBg(rarity)} transition-all duration-150 hover:border-gray-500/50`}
      style={{ '--mat-accent': accentColor }}
      id={`inv-${matKey.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
      data-testid="material-card"
    >
      {/* ── Top Metadata: Consistent height keeps images across all cards aligned ── */}
      <div className="text-center mb-2 sm:mb-3 w-full flex flex-col justify-start">
        <div className="h-[2.5rem] sm:h-[3rem] flex items-center justify-center w-full">
          <h3
            className="font-semibold text-xs sm:text-base text-white w-full px-1 leading-snug line-clamp-2 break-words text-center"
            title={label}
          >
            {label}
          </h3>
        </div>
        <span
          className={`text-[10px] sm:text-xs font-medium truncate block mt-0.5 px-1 h-4 sm:h-5 leading-normal ${
            sublabel ? 'text-gray-400' : 'invisible select-none'
          }`}
          aria-hidden={!sublabel}
        >
          {sublabel || '—'}
        </span>
      </div>

      {/* ── Rarity Portrait Box ── */}
      <div className={`w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 mx-auto rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-white/10 mb-2 sm:mb-3 flex-shrink-0 ${rarityBgClass}`}>
        <GenshinImage
          src={iconUrl}
          alt={label}
          className="w-3/4 h-3/4 object-contain drop-shadow-xl relative z-10"
          fallback={
            <span className="text-2xl sm:text-4xl opacity-50">📦</span>
          }
        />
      </div>

      {/* ── Count Display: Compact format for ≥1M (e.g. 42.59M) with full integer in tooltip ── */}
      <span
        className="text-base sm:text-2xl font-bold mb-1.5 sm:mb-2.5 truncate max-w-full px-1 text-center"
        style={{ color: accentColor }}
        title={(qty || 0).toLocaleString()}
      >
        {formatInventoryQuantity(qty)}
      </span>

      {/* ── Pill Stepper: Fixed button widths + flexible input prevents overlapping ── */}
      <div className="w-full px-0.5 sm:px-1.5">
        <div className="flex items-center bg-gray-950/80 border border-gray-600/50 rounded-full p-1 sm:p-1.5 shadow-sm w-full min-h-[34px] sm:min-h-[36px] gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-full active:scale-95 transition-all text-sm sm:text-base cursor-pointer select-none"
            aria-label={`Decrease ${label}`}
          >−</button>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => handleChange(e.target.value)}
            className="flex-1 min-w-0 text-center bg-transparent text-white font-semibold text-xs sm:text-sm outline-none focus:ring-1 focus:ring-[var(--mat-accent)] rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={`${label} quantity`}
          />
          <button
            type="button"
            onClick={() => step(1)}
            className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-full active:scale-95 transition-all text-sm sm:text-base cursor-pointer select-none"
            aria-label={`Increase ${label}`}
          >+</button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Stats Row ──────────────────────────────────────────────────────
function QuickStats() {
  const inventory = useStore((s) => s.inventory);
  const filledCount = Object.values(inventory).filter((v) => v > 0).length;
  const moraQty    = inventory['Mora']    || 0;
  const witsQty    = inventory['HeroWit'] || 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
      {[
        { label: 'Materials Tracked', value: filledCount,                   icon: <img src="/Inventory.png" alt="Materials Tracked" className="w-5 h-5 object-contain" />, accent: '#C8A96E' },
        { label: 'Mora',              value: moraQty.toLocaleString(),       icon: <img src="/CurrencyExp.png" alt="Mora" className="w-5 h-5 object-contain" />, accent: '#FAB632' },
        { label: "Hero's Wit",        value: witsQty.toLocaleString(),       icon: <img src="/HerosWit.png" alt="Hero's Wit" className="w-5 h-5 object-contain" />, accent: '#60A5FA' },
        { label: 'Total Slots',       value: Object.keys(inventory).length,  icon: '🗂️', accent: '#A855F7' },
      ].map(({ label, value, icon, accent }) => (
        <div key={label} className="stat-card">
          <div className="stat-icon" style={{ background: `${accent}18` }}>{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[var(--muted)] text-[10px] sm:text-xs mb-0.5 truncate">{label}</p>
            <p className="font-bold text-sm sm:text-lg leading-none truncate" style={{ color: accent }} title={String(value)}>
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Inventory Page ─────────────────────────────────────────────────

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTabId = getInventoryTabId(tabParam);

  const inventory = useStore((s) => s.inventory);

  // Generate an exhaustive categorized list of all materials in the game
  const allMaterials = useMemo(() => getPrimaryInventoryList(), []);

  // Filter items based on active tab
  const tabMaterials = useMemo(() => {
    return filterMaterialsByTab(allMaterials, activeTabId);
  }, [allMaterials, activeTabId]);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('Default'); // 'Default' | 'Name' | 'Quantity' | 'Rarity'
  const [sortDirection, setSortDirection] = useState('asc');
  const [rarityFilter, setRarityFilter] = useState('All'); // 'All' | '5★' | '4★' | '3★' | '2★' | '1★'
  const [ownedFilter, setOwnedFilter] = useState('all'); // 'all' | 'owned'

  // Mobile Collapsible Panels State (<768px)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Calculate active filter count (excluding search which has its own toggle indicator)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (rarityFilter !== 'All') count++;
    if (ownedFilter !== 'all') count++;
    if (sortOrder !== 'Default') count++;
    if (sortDirection !== 'asc') count++;
    return count;
  }, [rarityFilter, ownedFilter, sortOrder, sortDirection]);

  // Apply search, filters, and sorting
  const displayedMaterials = useMemo(() => {
    let list = [...tabMaterials];

    // Search query
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        m.label.toLowerCase().includes(q) ||
        (m.sublabel && m.sublabel.toLowerCase().includes(q)) ||
        m.matKey.toLowerCase().includes(q)
      );
    }

    // Rarity filter
    if (rarityFilter !== 'All') {
      const star = parseInt(rarityFilter, 10);
      list = list.filter((m) => (m.rarity || 0) === star);
    }

    // Ownership filter
    if (ownedFilter === 'owned') {
      list = list.filter((m) => (inventory[m.matKey] || 0) > 0);
    }

    // Sort
    list.sort((a, b) => {
      if (sortOrder === 'Name') {
        return compareNullableString(a.label, b.label, sortDirection);
      }
      if (sortOrder === 'Quantity') {
        const qA = inventory[a.matKey] || 0;
        const qB = inventory[b.matKey] || 0;
        return compareNullableNumber(qA, qB, sortDirection);
      }
      if (sortOrder === 'Rarity') {
        const rA = a.rarity || 0;
        const rB = b.rarity || 0;
        return compareNullableNumber(rA, rB, sortDirection);
      }
      // 'Default' (in-game sortOrder)
      const ordA = a.sortOrder ?? 9999;
      const ordB = b.sortOrder ?? 9999;
      return sortDirection === 'asc' ? ordA - ordB : ordB - ordA;
    });

    return list;
  }, [tabMaterials, search, rarityFilter, ownedFilter, sortOrder, sortDirection, inventory]);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="sticky top-[var(--topbar-h,64px)] z-40 bg-[var(--bg)]/80 backdrop-blur-xl pb-3 sm:pb-4 pt-2 mb-4 sm:mb-6 border-b border-[var(--border)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/Inventory.png" alt="Inventory" className="w-8 h-8 object-contain drop-shadow-sm shrink-0" />
          <div>
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)] leading-tight">
              Inventory
            </h1>
            <p className="text-[var(--muted)] text-xs sm:text-sm">
              Track your current material counts — updates sync automatically to the Planner
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <QuickStats />

      {/* ── Category Tabs Strip ── */}
      <div className="mb-4 sm:mb-6 overflow-x-auto no-scrollbar pb-1">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-max" role="tablist" aria-label="Inventory categories">
          {INVENTORY_TABS.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`inv-tab-${tab.id}`}
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={`filter-pill shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  isActive
                    ? 'active bg-[var(--gold)] text-[var(--bg)] border-[var(--gold)] shadow-sm'
                    : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-light)]'
                }`}
              >
                {tab.icon && (
                  <img src={tab.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile Search/Filter Toggle Buttons (< 768px) ── */}
      <div className="flex md:hidden items-center gap-2 mb-3">
        <button
          id="inv-mobile-search-toggle"
          type="button"
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-expanded={mobileSearchOpen}
          aria-controls="inv-mobile-search-panel"
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
            search.trim()
              ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10'
              : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]'
          }`}
        >
          🔍 Search
          {search.trim() && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setSearch('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearch('');
                }
              }}
              className="ml-1 text-[10px] bg-[var(--gold)]/20 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-[var(--gold)]/40 cursor-pointer"
              aria-label="Clear search"
            >✕</span>
          )}
        </button>
        <button
          id="inv-mobile-filters-toggle"
          type="button"
          onClick={() => setMobileFiltersOpen((v) => !v)}
          aria-expanded={mobileFiltersOpen}
          aria-controls="inv-mobile-filters-panel"
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] ${
            activeFilterCount > 0
              ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10'
              : 'border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]'
          }`}
        >
          ⚙ Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 text-[10px] bg-[var(--gold)] text-[var(--bg)] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <span className="text-[var(--muted)] text-[10px] whitespace-nowrap shrink-0">
          {displayedMaterials.length}/{tabMaterials.length}
        </span>
      </div>

      {/* ── Mobile Search Panel ── */}
      {mobileSearchOpen && (
        <div id="inv-mobile-search-panel" className="md:hidden mb-3 animate-fade-in">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
            <input
              type="search"
              placeholder="Search materials in this category…"
              className="search-input w-full h-10 pl-9 pr-3 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search materials"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* ── Mobile Filters Panel ── */}
      {mobileFiltersOpen && (
        <div id="inv-mobile-filters-panel" className="md:hidden bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-3 animate-fade-in">
          {/* Sort row */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="relative flex-1">
              <select
                id="inv-sort-select-mobile"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[36px]"
                aria-label="Sort materials"
              >
                <option value="Default">by In-game Order</option>
                <option value="Name">by Name</option>
                <option value="Quantity">by Quantity</option>
                <option value="Rarity">by Rarity</option>
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
            </div>
            <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
          </div>

          <div className="genshin-divider my-2" />

          {/* Rarity filter */}
          <div className="mb-2">
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Rarity</p>
            <div className="flex items-center gap-1.5 overflow-x-auto flex-nowrap pb-1 max-w-full no-scrollbar" role="group" aria-label="Filter by rarity">
              {['All', '5★', '4★', '3★', '2★', '1★'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={`filter-pill shrink-0 ${rarityFilter === r ? 'active' : ''}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Ownership filter */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">Ownership</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOwnedFilter('all')}
                className={`filter-pill shrink-0 ${ownedFilter === 'all' ? 'active' : ''}`}
              >
                All Items
              </button>
              <button
                type="button"
                onClick={() => setOwnedFilter('owned')}
                className={`filter-pill shrink-0 ${ownedFilter === 'owned' ? 'active' : ''}`}
              >
                Owned Only (&gt;0)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Filters (≥ 768px) ── */}
      <div className="hidden md:block bg-[var(--surface)] border border-[var(--border)] rounded-xl sm:rounded-2xl p-3 sm:p-5 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">🔍</span>
            <input
              type="search"
              placeholder="Search materials in this category…"
              className="search-input w-full h-10 pl-9 pr-3 text-xs sm:text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search materials"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                id="inv-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-medium rounded-lg px-3 py-2 pr-7 cursor-pointer outline-none focus:border-[var(--gold)] transition-colors min-h-[40px]"
                aria-label="Sort materials"
              >
                <option value="Default">by In-game Order</option>
                <option value="Name">by Name</option>
                <option value="Quantity">by Quantity</option>
                <option value="Rarity">by Rarity</option>
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
            </div>
            <SortDirectionButton direction={sortDirection} onToggle={setSortDirection} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-[var(--border)]">
          {/* Rarity pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)] font-medium">Rarity:</span>
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter by rarity">
              {['All', '5★', '4★', '3★', '2★', '1★'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRarityFilter(r)}
                  className={`filter-pill shrink-0 ${rarityFilter === r ? 'active' : ''}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Ownership pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)] font-medium">Show:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOwnedFilter('all')}
                className={`filter-pill shrink-0 ${ownedFilter === 'all' ? 'active' : ''}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setOwnedFilter('owned')}
                className={`filter-pill shrink-0 ${ownedFilter === 'owned' ? 'active' : ''}`}
              >
                Owned Only (&gt;0)
              </button>
            </div>
          </div>

          {/* Result count */}
          <div className="text-xs text-[var(--muted)]">
            Showing <strong className="text-[var(--text)]">{displayedMaterials.length}</strong> of {tabMaterials.length} items
          </div>
        </div>
      </div>

      {/* ── Content Grid ── */}
      <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-4 mt-4 sm:mt-6">
        {displayedMaterials.map((mat) => (
          <MaterialCard
            key={mat.matKey}
            matKey={mat.matKey}
            label={mat.label}
            sublabel={mat.sublabel}
            accent={mat.accent}
            iconCategory={mat.iconCategory}
            rarity={mat.rarity}
          />
        ))}
        {displayedMaterials.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--muted)] text-sm">
            {tabMaterials.length === 0
              ? 'No materials found for this category.'
              : 'No materials match the current search or filters.'}
            {(search || rarityFilter !== 'All' || ownedFilter !== 'all') && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setRarityFilter('All');
                    setOwnedFilter('all');
                  }}
                  className="text-xs text-[var(--gold)] hover:underline cursor-pointer"
                >
                  Clear search & filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

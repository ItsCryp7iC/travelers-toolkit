import React, { useState, useEffect } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { uploadBackupToDrive } from '../utils/driveSync'

const navItems = [
  { to: '/',           label: 'Dashboard',   icon: '🏠', id: 'nav-dashboard' },
  { to: '/characters', label: 'Characters',  icon: '⚔️', id: 'nav-characters' },
  { to: '/weapons',    label: 'Weapons',     icon: '🗡️', id: 'nav-weapons' },
  { to: '/planner',    label: 'Planner',     icon: '📋', id: 'nav-planner' },
  { to: '/inventory',  label: 'Inventory',   icon: '📦', id: 'nav-inventory' },
  { to: '/settings',   label: 'Settings',    icon: '⚙️', id: 'nav-settings' },
]

const PLANNER_TABS = [
  { id: 'daily_action', label: 'Daily Action', icon: '📅' },
  { id: 'currency_exp', label: 'Currency & EXP', icon: '🪙' },
  { id: 'normal_boss', label: 'Normal Boss', icon: '🐉' },
  { id: 'weekly_boss', label: 'Weekly Boss', icon: '👑' },
  { id: 'talent', label: 'Talents', icon: '📖' },
  { id: 'common_enhancement', label: 'Common Mats', icon: '⚔️' },
  { id: 'elite_enhancement', label: 'Elite Mats', icon: '🛡️' },
  { id: 'weapon_ascension', label: 'Weapon Mats', icon: '🔗' },
  { id: 'local_specialty', label: 'Local Specialty', icon: '🌸' },
  { id: 'character_gem', label: 'Gems', icon: '💎' },
  { id: 'per_character', label: 'Characters', icon: '👥' },
  { id: 'per_weapon', label: 'Weapons', icon: '🗡️' }
];

const INVENTORY_TABS = [
  { id: 'currency_exp', label: 'Currency & Exp', icon: '🪙' },
  { id: 'boss_drops', label: 'Boss Drops', icon: '🐉' },
  { id: 'talent_mats', label: 'Talent Mats', icon: '📚' },
  { id: 'enemy_drops', label: 'Enemy Drops', icon: '⚔️' },
  { id: 'weapon_asc', label: 'Weapon Asc', icon: '🗡️' },
  { id: 'local_spec', label: 'Local Spec', icon: '🌸' },
  { id: 'character_gems', label: 'Character Gems', icon: '💎' },
];

const devItems = [
  { to: '/builder', label: 'DB Builder', icon: '🔧', id: 'nav-builder' },
]

export default function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPlannerOpen, setIsPlannerOpen] = useState(location.pathname === '/planner')
  const [isInventoryOpen, setIsInventoryOpen] = useState(location.pathname === '/inventory')
  const rosterCount = useStore((s) => Object.keys(s.roster).length)
  const showDbBuilder = useStore((s) => s.showDbBuilder)
  
  const autoBackupEnabled = useStore((s) => s.autoBackupEnabled)
  const googleAccessToken = useStore((s) => s.googleAccessToken)
  const tokenExpiry = useStore((s) => s.tokenExpiry)

  useEffect(() => {
    if (autoBackupEnabled) {
      const currentState = useStore.getState();
      
      const dataToExport = {
        roster: currentState.roster,
        trackedWeapons: currentState.trackedWeapons,
        inventory: currentState.inventory,
        serverRegion: currentState.serverRegion,
        showDbBuilder: currentState.showDbBuilder
      };
      
      // Local snapshot
      try {
        localStorage.setItem('tt-local-backup', JSON.stringify(dataToExport));
        console.log('Local snapshot saved.');
      } catch (e) {
        console.error('Failed to save local snapshot', e);
      }

      // Cloud silent backup
      if (googleAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
        uploadBackupToDrive(googleAccessToken, dataToExport).then(() => {
          console.log('Silent auto-backup to Google Drive succeeded.');
        }).catch(err => {
          console.error('Silent auto-backup to Google Drive failed:', err);
        });
      }
    }
  }, []);
  
  const currentTab = new URLSearchParams(location.search).get('tab');
  const plannerTab = location.pathname === '/planner' ? currentTab || 'daily_action' : null;
  const inventoryTab = location.pathname === '/inventory' ? currentTab || 'currency_exp' : null;

  return (
    <div className="bg-[url('/bg.png')] bg-[#030712]/70 bg-blend-overlay bg-cover bg-fixed bg-right bg-no-repeat min-h-screen w-full">
      {/* ── Sidebar ────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="app-sidebar">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Site Logo" className="w-12 h-12 object-contain drop-shadow-md" />
            <div>
              <h1 className="font-cinzel font-bold text-xl leading-tight text-[var(--text)]">
                Traveler's
              </h1>
              <p className="font-cinzel font-bold text-xl leading-tight text-primary">
                Toolkit
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4" aria-label="Main navigation">
          <p className="px-5 mb-2 text-xs font-semibold text-[var(--muted)] tracking-widest uppercase">
            Navigation
          </p>
          {navItems.map((item) => {
            if (item.id === 'nav-planner') {
              return (
                <div key={item.to} className="flex flex-col">
                  <div 
                    className={`sidebar-nav-link cursor-pointer flex items-center justify-between ${location.pathname === '/planner' ? 'active' : ''}`}
                    onClick={() => setIsPlannerOpen(!isPlannerOpen)}
                  >
                    <div className="flex items-center">
                      <span className="nav-icon text-base w-5 text-center mr-2">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-xs text-gray-500 transition-transform ${isPlannerOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                  {isPlannerOpen && (
                    <div className="flex flex-col mt-1 mb-2">
                      {PLANNER_TABS.map(tab => {
                        const isTabActive = location.pathname === '/planner' && plannerTab === tab.id;
                        return (
                          <Link
                            key={tab.id}
                            to={`/planner?tab=${tab.id}`}
                            className={`flex items-center gap-2 py-2 pl-12 pr-4 text-xs transition-colors ${
                              isTabActive ? 'text-primary font-medium' : 'text-[var(--muted)] hover:text-gray-200'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <span className="opacity-70">{tab.icon}</span>
                            <span>{tab.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.id === 'nav-inventory') {
              return (
                <div key={item.to} className="flex flex-col">
                  <div 
                    className={`sidebar-nav-link cursor-pointer flex items-center justify-between ${location.pathname === '/inventory' ? 'active' : ''}`}
                    onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                  >
                    <div className="flex items-center">
                      <span className="nav-icon text-base w-5 text-center mr-2">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className={`text-xs text-gray-500 transition-transform ${isInventoryOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                  {isInventoryOpen && (
                    <div className="flex flex-col mt-1 mb-2">
                      {INVENTORY_TABS.map(tab => {
                        const isTabActive = location.pathname === '/inventory' && inventoryTab === tab.id;
                        return (
                          <Link
                            key={tab.id}
                            to={`/inventory?tab=${tab.id}`}
                            className={`flex items-center gap-2 py-2 pl-12 pr-4 text-xs transition-colors ${
                              isTabActive ? 'text-primary font-medium' : 'text-[var(--muted)] hover:text-gray-200'
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <span className="opacity-70">{tab.icon}</span>
                            <span>{tab.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                id={item.id}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Dev Tools */}
        {showDbBuilder && (
          <nav className="pb-2 border-b border-[var(--border)]" aria-label="Dev navigation">
            <p className="px-5 mb-2 text-xs font-semibold text-primary/60 tracking-widest uppercase">
              Dev Tools
            </p>
            {devItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                id={item.id}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        {/* Roster Summary */}
        <div className="px-5 py-4 border-t border-[var(--border)]">
          <div className="bg-[var(--elevated)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">
              My Roster
            </p>
            <div className="flex items-end gap-2">
              <span className="font-cinzel text-2xl font-bold text-primary">
                {rosterCount}
              </span>
              <span className="text-[var(--muted)] text-xs mb-0.5">
                {rosterCount === 1 ? 'character' : 'characters'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ───────────────────────────── */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar" id="app-topbar">
          {/* Mobile burger */}
          <button
            id="sidebar-toggle"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-light)] transition-all flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>

          {/* Page context breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-[var(--muted)] text-xs">
            <span>🧭</span>
            <span>Traveler's Toolkit</span>
          </div>

          <div className="flex-1" />

          {/* Quick stats */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)]">
              <span className="text-xs">⚔️</span>
              <span className="text-xs text-[var(--muted)]">Roster:</span>
              <span className="text-xs font-semibold text-primary font-cinzel">{rosterCount}</span>
            </div>
          </div>

          {/* Avatar */}
          <div
            id="user-avatar"
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-cinzel cursor-pointer transition-all hover:scale-105 flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #C8A96E, #7A5C2E)',
              color: '#0D0F1A',
            }}
            title="Traveler"
          >
            T
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8" id="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

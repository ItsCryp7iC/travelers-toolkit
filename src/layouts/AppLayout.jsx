import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import useStore from '../store/useStore'

const navItems = [
  { to: '/',           label: 'Dashboard',   icon: '🏠', id: 'nav-dashboard' },
  { to: '/characters', label: 'Characters',  icon: '⚔️', id: 'nav-characters' },
  { to: '/weapons',    label: 'Weapons',     icon: '🗡️', id: 'nav-weapons' },
  { to: '/planner',    label: 'Planner',     icon: '📋', id: 'nav-planner' },
  { to: '/inventory',  label: 'Inventory',   icon: '📦', id: 'nav-inventory' },
  { to: '/settings',   label: 'Settings',    icon: '⚙️', id: 'nav-settings' },
]

const devItems = [
  { to: '/builder', label: 'DB Builder', icon: '🔧', id: 'nav-builder' },
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const rosterCount = useStore((s) => Object.keys(s.roster).length)

  return (
    <div className="page-bg min-h-screen">
      {/* ── Sidebar ────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="app-sidebar">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #C8A96E, #7A5C2E)' }}
            >
              🧭
            </div>
            <div>
              <h1 className="font-cinzel font-bold text-sm leading-tight text-[var(--text)]">
                Traveler's
              </h1>
              <p className="font-cinzel font-bold text-sm leading-tight text-[var(--gold)]">
                Toolkit
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-[var(--muted)] font-medium tracking-widest uppercase">
            Genshin Impact Planner
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4" aria-label="Main navigation">
          <p className="px-5 mb-2 text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase">
            Navigation
          </p>
          {navItems.map((item) => (
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
          ))}
        </nav>

        {/* Dev Tools */}
        <nav className="pb-2 border-b border-[var(--border)]" aria-label="Dev navigation">
          <p className="px-5 mb-2 text-[10px] font-semibold text-amber-500/60 tracking-widest uppercase">
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

        {/* Roster Summary */}
        <div className="px-5 py-4 border-t border-[var(--border)]">
          <div className="bg-[var(--elevated)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-1">
              My Roster
            </p>
            <div className="flex items-end gap-2">
              <span className="font-cinzel text-2xl font-bold text-[var(--gold)]">
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
              <span className="text-xs font-semibold text-[var(--gold)] font-cinzel">{rosterCount}</span>
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

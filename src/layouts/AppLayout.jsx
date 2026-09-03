import React, { useState, useEffect } from 'react'
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { uploadBackupToDrive } from '../utils/driveSync'
import { useGoogleLogin } from '@react-oauth/google'
import ResinTracker from '../components/ResinTracker'
import RealmCurrencyTracker from '../components/RealmCurrencyTracker'

const navItems = [
 { to: '/', label: 'Dashboard', icon: '/Dashboard.png', id: 'nav-dashboard' },
 { to: '/characters', label: 'Characters', icon: '/Characters.png', id: 'nav-characters' },
 { to: '/weapons', label: 'Weapons', icon: '/Weapons.png', id: 'nav-weapons' },
 { to: '/planner', label: 'Planner', icon: '/Planner.png', id: 'nav-planner' },
 { to: '/inventory', label: 'Inventory', icon: '/Inventory.png', id: 'nav-inventory' },
 { to: '/settings', label: 'Settings', icon: '⚙️', id: 'nav-settings' },
]

const PLANNER_TABS = [
 { id: 'daily_action', label: 'Daily Action', icon: '📅' },
 { id: 'currency_exp', label: 'Currency & EXP', icon: '/CurrencyExp.png' },
 { id: 'normal_boss', label: 'Normal Boss', icon: '/NormalBoss.png' },
 { id: 'weekly_boss', label: 'Weekly Boss', icon: '/WeeklyBoss.png' },
 { id: 'talent', label: 'Talents', icon: '/TalentMats.png' },
 { id: 'common_enhancement', label: 'Common Mats', icon: '/CommonEnemy.png' },
 { id: 'elite_enhancement', label: 'Elite Mats', icon: '/EliteEnemy.png' },
 { id: 'weapon_ascension', label: 'Weapon Mats', icon: '/WeaponAscMats.png' },
 { id: 'local_specialty', label: 'Local Specialty', icon: '/LocalSpecialties.png' },
 { id: 'character_gem', label: 'Gems', icon: '/Gems.png' },
 { id: 'crafting_materials', label: 'Crafting Mats', icon: '/Forging.png' },
 { id: 'per_character', label: 'Characters', icon: '/Characters.png' },
 { id: 'per_weapon', label: 'Weapons', icon: '/Weapons.png' }
];

const INVENTORY_TABS = [
 { id: 'currency_exp', label: 'Currency & Exp', icon: '/CurrencyExp.png' },
 { id: 'boss_drops', label: 'Boss Drops', icon: '/NormalBoss.png' },
 { id: 'talent_mats', label: 'Talent Mats', icon: '/TalentMats.png' },
 { id: 'enemy_drops', label: 'Enemy Drops', icon: '/CommonEnemy.png' },
 { id: 'weapon_asc', label: 'Weapon Asc', icon: '/WeaponAscMats.png' },
 { id: 'local_spec', label: 'Local Spec', icon: '/LocalSpecialties.png' },
 { id: 'character_gems', label: 'Character Gems', icon: '/Gems.png' },
 { id: 'crafting_mats', label: 'Crafting Mats', icon: '/Forging.png' },
];

const devItems = [
 { to: '/builder', label: 'DB Builder', icon: '🔧', id: 'nav-builder' },
]

export default function AppLayout() {
 const location = useLocation();
 const [sidebarOpen, setSidebarOpen] = useState(false)
 const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
   const saved = localStorage.getItem('tt-desktop-sidebar-collapsed');
   return saved === 'true';
 })

  const handleSyncNotes = useStore((s) => s.handleSyncNotes)
  const syncPayload = useStore((s) => s.syncPayload)
  const trackedWeapons = useStore((s) => s.trackedWeapons) || []
  const hasCookie = Boolean(localStorage.getItem('hoyolab_ltuid') && localStorage.getItem('hoyolab_ltoken'));

  useEffect(() => {
    handleSyncNotes(true)
  }, [])

  useEffect(() => {
    localStorage.setItem('tt-desktop-sidebar-collapsed', isDesktopCollapsed);
  }, [isDesktopCollapsed])
  
 const [activeFlyout, setActiveFlyout] = useState(null)

 useEffect(() => {
   const handleClickOutside = (e) => {
     if (activeFlyout && !e.target.closest('.flyout-container')) {
       setActiveFlyout(null);
     }
   };
   const handleEsc = (e) => {
     if (e.key === 'Escape') setActiveFlyout(null);
   };
   document.addEventListener('mousedown', handleClickOutside);
   document.addEventListener('keydown', handleEsc);
   return () => {
     document.removeEventListener('mousedown', handleClickOutside);
     document.removeEventListener('keydown', handleEsc);
   };
 }, [activeFlyout]);

 const [isPlannerOpen, setIsPlannerOpen] = useState(location.pathname === '/planner')
 const [isInventoryOpen, setIsInventoryOpen] = useState(location.pathname === '/inventory')
 const rosterCount = useStore((s) => Object.keys(s.roster).length)
 const showDbBuilder = useStore((s) => s.showDbBuilder)
 
 const autoBackupEnabled = useStore((s) => s.autoBackupEnabled)
 const googleAccessToken = useStore((s) => s.googleAccessToken)
 const tokenExpiry = useStore((s) => s.tokenExpiry)
 const googleUser = useStore((s) => s.googleUser)
 const setGoogleSession = useStore((s) => s.setGoogleSession)
 const clearGoogleSession = useStore((s) => s.clearGoogleSession)

 const [dropdownOpen, setDropdownOpen] = useState(false)

 const login = useGoogleLogin({
   onSuccess: async (tokenResponse) => {
     try {
       const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + tokenResponse.access_token, {
         headers: { Authorization: `Bearer ${tokenResponse.access_token}`, Accept: 'application/json' }
       });
       const userInfo = await userInfoRes.json();
       setGoogleSession(tokenResponse.access_token, tokenResponse.expires_in, userInfo);
     } catch (err) {
       setGoogleSession(tokenResponse.access_token, tokenResponse.expires_in);
     }
   },
   scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
 });

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
 <div className={`bg-[url('/bg.png')] bg-[#030712]/70 bg-blend-overlay bg-cover bg-fixed bg-right bg-no-repeat min-h-screen w-full ${isDesktopCollapsed ? 'desktop-collapsed' : ''}`}>
 
  {/* ── Top Bar (Full Width) ────────────────────────────────── */}
  <header className="topbar" id="app-topbar">
    {/* Brand */}
    <Link to="/" className="flex items-center gap-3 pl-0 md:pl-5 transition-all w-[240px] cursor-pointer hover:opacity-80">
      <img src="/logo.svg" alt="Site Logo" className="w-10 h-10 object-contain drop-shadow-md" />
      <div className="brand-text">
        <h1 className="text-lg leading-tight text-[var(--text)]">
          Traveler's
        </h1>
        <p className="text-lg leading-tight text-primary">
          Toolkit
        </p>
      </div>
    </Link>

    {/* Mobile burger */}
    <button
      id="sidebar-toggle"
      className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-light)] transition-all flex-shrink-0"
      onClick={() => setSidebarOpen(!sidebarOpen)}
      aria-label="Toggle sidebar"
    >
      ☰
    </button>

    <div className="flex-1" />

    {/* Quick stats */}
    <div className="hidden sm:flex items-center gap-3">
      {hasCookie && syncPayload && (
        <>
          <ResinTracker syncData={syncPayload.resin} variant="compact" />
          <RealmCurrencyTracker syncData={syncPayload.realm_currency} variant="compact" />
        </>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)] shrink-0" title="My Armory">
        <img src="/Weapons.png" alt="My Armory" className="w-5 h-5 object-contain" />
        <span className="text-sm font-semibold whitespace-nowrap text-[var(--text)]">
          {trackedWeapons.length}
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--elevated)] border border-[var(--border)] shrink-0" title="Roster">
        <img src="/Characters.png" alt="Roster" className="w-5 h-5 object-contain" />
        <span className="text-sm font-semibold whitespace-nowrap text-[var(--text)]">
          {rosterCount}
        </span>
      </div>
    </div>

    {/* Avatar & Dropdown */}
    <div className="relative">
      {!googleUser ? (
        <div
          id="user-avatar-logged-out"
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all hover:scale-105 flex-shrink-0 bg-gray-600 text-white"
          title="Sign In with Google"
          onClick={() => login()}
        >
          ?
        </div>
      ) : (
        <div
          id="user-avatar-logged-in"
          className="w-9 h-9 rounded-full cursor-pointer transition-all hover:scale-105 flex-shrink-0 border-2 border-[var(--border)] overflow-hidden"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <img src={googleUser.picture} alt="Profile" className="w-full h-full object-cover" />
        </div>
      )}

      {dropdownOpen && googleUser && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--elevated)] border border-[var(--border)] rounded-md shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text)] truncate">{googleUser.name}</p>
            <p className="text-xs text-[var(--muted)] truncate">{googleUser.email}</p>
          </div>
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
            onClick={() => {
              clearGoogleSession();
              setDropdownOpen(false);
            }}
          >
            Sign Out / Disconnect
          </button>
        </div>
      )}
    </div>
  </header>

 {/* ── Sidebar ────────────────────────────────── */}
 <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="app-sidebar">
 {/* Navigation */}
 <nav className="flex-1 py-4" aria-label="Main navigation">
  <div className="nav-header px-5 mb-2 flex items-center justify-between">
    <p className="nav-section-title text-xs text-[var(--muted)] tracking-widest uppercase m-0">
      Navigation
    </p>
    <button 
      className="nav-toggle-btn hidden md:flex w-8 h-8 rounded-md items-center justify-center text-xs text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex-shrink-0"
      onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      title={isDesktopCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
    >
      {isDesktopCollapsed ? '▶' : '◀'}
    </button>
  </div>
 {navItems.map((item) => {
   if (item.id === 'nav-planner') {
     if (isDesktopCollapsed) {
       return (
         <div key={item.to} className="flyout-container relative flex flex-col">
           <div
             title={item.label}
             className={`sidebar-nav-link cursor-pointer flex items-center justify-center ${location.pathname.startsWith('/planner') ? 'active' : ''}`}
             onClick={() => setActiveFlyout(activeFlyout === 'planner' ? null : 'planner')}
           >
             <span className="nav-icon text-base w-5 text-center flex items-center justify-center">
               {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
             </span>
             <span className="hidden">{item.label}</span>
           </div>
            {activeFlyout === 'planner' && (
              <div className="absolute left-full top-0 ml-3 w-52 bg-[rgb(0,4,30)]/85 backdrop-blur-[12px] border border-[var(--border)] rounded-xl py-2 shadow-2xl z-[9999]">
               <div className="px-4 py-2 border-b border-[var(--border)] mb-1">
                 <p className="text-xs font-semibold text-primary uppercase tracking-wider">{item.label}</p>
               </div>
               {PLANNER_TABS.map(tab => (
                 <Link
                   key={tab.id}
                   to={`/planner?tab=${tab.id}`}
                   className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                   onClick={() => setActiveFlyout(null)}
                 >
                   <span className="w-5 flex items-center justify-center">{tab.icon.includes('.png') ? <img src={tab.icon} alt={tab.label} className="w-5 h-5 object-contain" /> : tab.icon}</span>
                   <span>{tab.label}</span>
                 </Link>
               ))}
             </div>
           )}
         </div>
       );
     }
     return (
       <div key={item.to} className="flex flex-col">
         <div 
           className={`sidebar-nav-link cursor-pointer flex items-center justify-between ${location.pathname === '/planner' ? 'active' : ''}`}
           onClick={() => setIsPlannerOpen(!isPlannerOpen)}
         >
           <div className="flex items-center">
             <span className="nav-icon text-base w-5 text-center mr-2 flex items-center justify-center">
               {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
             </span>
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
                     isTabActive ? 'text-primary ' : 'text-[var(--muted)] hover:text-gray-200'
                   }`}
                   onClick={() => setSidebarOpen(false)}
                 >
                   <span className="opacity-70 w-5 flex items-center justify-center">{tab.icon.includes('.png') ? <img src={tab.icon} alt={tab.label} className="w-5 h-5 object-contain" /> : tab.icon}</span>
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
     if (isDesktopCollapsed) {
       return (
         <div key={item.to} className="flyout-container relative flex flex-col">
           <div
             title={item.label}
             className={`sidebar-nav-link cursor-pointer flex items-center justify-center ${location.pathname.startsWith('/inventory') ? 'active' : ''}`}
             onClick={() => setActiveFlyout(activeFlyout === 'inventory' ? null : 'inventory')}
           >
             <span className="nav-icon text-base w-5 text-center flex items-center justify-center">
               {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
             </span>
             <span className="hidden">{item.label}</span>
           </div>
            {activeFlyout === 'inventory' && (
              <div className="absolute left-full top-0 ml-3 w-52 bg-[rgb(0,4,30)]/85 backdrop-blur-[12px] border border-[var(--border)] rounded-xl py-2 shadow-2xl z-[9999]">
               <div className="px-4 py-2 border-b border-[var(--border)] mb-1">
                 <p className="text-xs font-semibold text-primary uppercase tracking-wider">{item.label}</p>
               </div>
               {INVENTORY_TABS.map(tab => (
                 <Link
                   key={tab.id}
                   to={`/inventory?tab=${tab.id}`}
                   className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                   onClick={() => setActiveFlyout(null)}
                 >
                   <span className="w-5 flex items-center justify-center">{tab.icon.includes('.png') ? <img src={tab.icon} alt={tab.label} className="w-5 h-5 object-contain" /> : tab.icon}</span>
                   <span>{tab.label}</span>
                 </Link>
               ))}
             </div>
           )}
         </div>
       );
     }
     return (
       <div key={item.to} className="flex flex-col">
         <div 
           className={`sidebar-nav-link cursor-pointer flex items-center justify-between ${location.pathname === '/inventory' ? 'active' : ''}`}
           onClick={() => setIsInventoryOpen(!isInventoryOpen)}
         >
           <div className="flex items-center">
             <span className="nav-icon text-base w-5 text-center mr-2 flex items-center justify-center">
               {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
             </span>
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
                     isTabActive ? 'text-primary ' : 'text-[var(--muted)] hover:text-gray-200'
                   }`}
                   onClick={() => setSidebarOpen(false)}
                 >
                   <span className="opacity-70 w-5 flex items-center justify-center">{tab.icon.includes('.png') ? <img src={tab.icon} alt={tab.label} className="w-5 h-5 object-contain" /> : tab.icon}</span>
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
       title={item.label}
       className={({ isActive }) =>
         `sidebar-nav-link ${isActive ? 'active' : ''}`
       }
       onClick={() => setSidebarOpen(false)}
     >
       <span className="nav-icon text-base w-5 text-center flex items-center justify-center">
         {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
       </span>
       <span>{item.label}</span>
     </NavLink>
   )
 })}
 </nav>

 {/* Dev Tools */}
 {showDbBuilder && (
 <nav className="pb-2 border-b border-[var(--border)]" aria-label="Dev navigation">
 <p className="nav-section-title px-5 mb-2 text-xs text-primary/60 tracking-widest uppercase">
 Dev Tools
 </p>
 {devItems.map((item) => (
 <NavLink
 key={item.to}
 to={item.to}
 id={item.id}
 title={item.label}
 className={({ isActive }) =>
 `sidebar-nav-link ${isActive ? 'active' : ''}`
 }
 onClick={() => setSidebarOpen(false)}
 >
 <span className="nav-icon text-base w-5 text-center flex items-center justify-center">
   {item.icon.includes('.png') ? <img src={item.icon} alt={item.label} className="w-5 h-5 object-contain" /> : item.icon}
 </span>
 <span>{item.label}</span>
 </NavLink>
 ))}
 </nav>
 )}
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

 {/* Page Content */}
 <main className="flex-1 p-6 md:p-8" id="page-content">
 <Outlet />
 </main>
 </div>
 </div>
 )
}

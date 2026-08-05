const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add missing imports
if (!content.includes("import WeaponCard")) {
  content = content.replace(
    "import CharacterCard from '../components/CharacterCard'",
    "import CharacterCard from '../components/CharacterCard'\nimport WeaponCard from '../components/WeaponCard'\nimport weaponsData from '../data/weapons.json'"
  );
}

// 2. Add activeTab state
if (!content.includes("const [activeTab,")) {
  content = content.replace(
    "const handleAddAllCharacters = () => {",
    "const [activeTab, setActiveTab] = useState('characters');\n\n  const handleAddAllCharacters = () => {"
  );
}

// 3. Add trackedWeapons state extraction
if (!content.includes("const trackedWeapons = useStore")) {
  content = content.replace(
    "const batchAddCharacters = useStore((s) => s.batchAddCharacters)",
    "const batchAddCharacters = useStore((s) => s.batchAddCharacters)\n  const trackedWeapons = useStore((s) => s.trackedWeapons) || []"
  );
}

// 4. Update the filtered useMemo
const oldFiltered = `  const filtered = useMemo(() => {
    let list = [...charactersData]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.element?.toLowerCase().includes(q)
      )
    }
    if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
    if (weaponFilter  !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
    if (rarityFilter !== 'All') {
      const rFilterNum = parseInt(rarityFilter.match(/\\d+/)?.[0] || '0', 10)
      list = list.filter((c) => {
        const cRarity = typeof c.rarity === 'string' ? (c.rarity.match(/★/g)?.length || parseInt(c.rarity) || 0) : (c.rarity || 0)
        return cRarity === rFilterNum
      })
    }

    list.sort((a, b) => {
      if (sortBy === 'Release') {
        const orderA = a.release_order ?? 999;
        const orderB = b.release_order ?? 999;
        return orderA - orderB;
      }
      if (sortBy === 'Rarity') {
        const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0);
        const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0);
        return rarityB - rarityA;
      }
      if (sortBy === 'Element') return (a.element || '').localeCompare(b.element || '')
      if (sortBy === 'Weapon') {
        const wA = a.weapon || a.weapon_type || '';
        const wB = b.weapon || b.weapon_type || '';
        return wA.localeCompare(wB);
      }
      if (sortBy === 'Name') return a.name.localeCompare(b.name)
      return 0;
    })

    return list
  }, [search, elementFilter, weaponFilter, rarityFilter, sortBy])`;

const newFiltered = `  const filtered = useMemo(() => {
    if (activeTab === 'characters') {
      let list = [...charactersData]

      if (search.trim()) {
        const q = search.toLowerCase()
        list = list.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.element?.toLowerCase().includes(q)
        )
      }
      if (elementFilter !== 'All') list = list.filter((c) => c.element === elementFilter)
      if (weaponFilter  !== 'All') list = list.filter((c) => c.weapon_type === weaponFilter)
      if (rarityFilter !== 'All') {
        const rFilterNum = parseInt(rarityFilter.match(/\\d+/)?.[0] || '0', 10)
        list = list.filter((c) => {
          const cRarity = typeof c.rarity === 'string' ? (c.rarity.match(/★/g)?.length || parseInt(c.rarity) || 0) : (c.rarity || 0)
          return cRarity === rFilterNum
        })
      }

      list.sort((a, b) => {
        if (sortBy === 'Release') {
          const orderA = a.release_order ?? 999;
          const orderB = b.release_order ?? 999;
          return orderA - orderB;
        }
        if (sortBy === 'Rarity') {
          const rarityA = typeof a.rarity === 'string' ? (a.rarity.match(/★/g)?.length || parseInt(a.rarity) || 0) : (a.rarity || 0);
          const rarityB = typeof b.rarity === 'string' ? (b.rarity.match(/★/g)?.length || parseInt(b.rarity) || 0) : (b.rarity || 0);
          return rarityB - rarityA;
        }
        if (sortBy === 'Element') return (a.element || '').localeCompare(b.element || '')
        if (sortBy === 'Weapon') {
          const wA = a.weapon || a.weapon_type || '';
          const wB = b.weapon || b.weapon_type || '';
          return wA.localeCompare(wB);
        }
        if (sortBy === 'Name') return a.name.localeCompare(b.name)
        return 0;
      })

      return list
    } else {
      let list = [...weaponsData]
      if (search.trim()) {
        const q = search.toLowerCase()
        list = list.filter((w) => w.name.toLowerCase().includes(q))
      }
      if (weaponFilter !== 'All') list = list.filter((w) => w.type === weaponFilter)
      if (rarityFilter !== 'All') {
        const rFilterNum = parseInt(rarityFilter.match(/\\d+/)?.[0] || '0', 10)
        list = list.filter((w) => (w.rarity || 0) === rFilterNum)
      }
      list.sort((a, b) => {
        if (sortBy === 'Rarity' || sortBy === 'Release') {
          return (b.rarity || 0) - (a.rarity || 0)
        }
        if (sortBy === 'Weapon') {
          return (a.type || '').localeCompare(b.type || '')
        }
        if (sortBy === 'Name') return a.name.localeCompare(b.name)
        return 0;
      })
      return list
    }
  }, [activeTab, search, elementFilter, weaponFilter, rarityFilter, sortBy])`;

content = content.replace(oldFiltered, newFiltered);

// 5. Update stats calculations
const oldStats = `  // Stats
  const total5Star  = charactersData.filter((c) => c.rarity === 5).length
  const total4Star  = charactersData.filter((c) => c.rarity === 4).length
  const rosterCount = Object.keys(roster).length
  const elementCount = [...new Set(charactersData.map((c) => c.element).filter(Boolean))].length`;

const newStats = `  // Stats
  const total5StarChars  = charactersData.filter((c) => c.rarity === 5).length
  const total4StarChars  = charactersData.filter((c) => c.rarity === 4).length
  const rosterCount = Object.keys(roster).length

  const total5StarWeapons = weaponsData.filter((w) => w.rarity === 5).length
  const total4StarWeapons = weaponsData.filter((w) => w.rarity === 4).length
  const trackedWeaponsCount = trackedWeapons.length`;

content = content.replace(oldStats, newStats);

// 6. Update Add All Button (conditionally render)
content = content.replace(
  `<button \n          onClick={handleAddAllCharacters}`,
  `{activeTab === 'characters' && (<button \n          onClick={handleAddAllCharacters}`
);
content = content.replace(
  `Add All Available Characters\n        </button>`,
  `Add All Available Characters\n        </button>)}`
);

// 7. Update header text
content = content.replace(
  `Browse all characters and manage your roster`,
  `{activeTab === 'characters' ? 'Browse all characters and manage your roster' : 'Browse and track your weapons'}`
);

// 8. Add Tab Toggle below ResinTracker
const oldResin = `<div className="mb-8">\n        <ResinTracker />\n      </div>`;
const newResin = `<div className="mb-6">
        <ResinTracker />
      </div>

      {/* ── Tab Toggle ──────────────────────────────── */}
      <div className="flex justify-center mb-8">
        <div className="bg-[var(--elevated)] border border-[var(--border)] p-1 rounded-full inline-flex">
          <button
            onClick={() => setActiveTab('characters')}
            className={\`px-6 py-2 rounded-full text-sm font-semibold transition-all \${
              activeTab === 'characters' 
                ? 'bg-[var(--gold)] text-gray-900 shadow-md' 
                : 'text-[var(--muted)] hover:text-white'
            }\`}
          >
            Characters
          </button>
          <button
            onClick={() => setActiveTab('weapons')}
            className={\`px-6 py-2 rounded-full text-sm font-semibold transition-all \${
              activeTab === 'weapons' 
                ? 'bg-[var(--gold)] text-gray-900 shadow-md' 
                : 'text-[var(--muted)] hover:text-white'
            }\`}
          >
            Weapons
          </button>
        </div>
      </div>`;
content = content.replace(oldResin, newResin);

// 9. Update Stats Strip
const oldStatsStrip = `<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="👥" label="Total Characters" value={charactersData.length} />
        <StatCard icon="⭐" label="5★ Characters"   value={total5Star}  accent="#FFD700" />
        <StatCard icon="💜" label="4★ Characters"   value={total4Star}  accent="#B07FE8" />
        <StatCard icon="📋" label="In My Roster"    value={rosterCount} accent="#4EC9B0" />
      </div>`;

const newStatsStrip = `{activeTab === 'characters' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
          <StatCard icon="👥" label="Total Characters" value={charactersData.length} />
          <StatCard icon="⭐" label="5★ Characters"   value={total5StarChars}  accent="#FFD700" />
          <StatCard icon="💜" label="4★ Characters"   value={total4StarChars}  accent="#B07FE8" />
          <StatCard icon="📋" label="In My Roster"    value={rosterCount} accent="#4EC9B0" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
          <StatCard icon="🗡️" label="Total Weapons" value={weaponsData.length} />
          <StatCard icon="⭐" label="5★ Weapons"   value={total5StarWeapons}  accent="#FFD700" />
          <StatCard icon="💜" label="4★ Weapons"   value={total4StarWeapons}  accent="#B07FE8" />
          <StatCard icon="📋" label="Tracked Weapons" value={trackedWeaponsCount} accent="#4EC9B0" />
        </div>
      )}`;
content = content.replace(oldStatsStrip, newStatsStrip);

// 10. Update result count
content = content.replace(
  `{filtered.length} / {charactersData.length} shown`,
  `{filtered.length} / {activeTab === 'characters' ? charactersData.length : weaponsData.length} shown`
);

// 11. Update Element filters wrapper
const oldElementFilter = `<div className="mb-3">
          <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
            Element
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by element">`;

const newElementFilter = `{activeTab === 'characters' && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-[var(--muted)] tracking-widest uppercase mb-2">
            Element
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by element">`;
content = content.replace(oldElementFilter, newElementFilter);

// We need to close the element filter condition block
content = content.replace(
  `                </button>\n              )\n            })}\n          </div>\n        </div>`,
  `                </button>\n              )\n            })}\n          </div>\n        </div>\n        )}`
);

// 12. Update placeholder texts and grid mapping
content = content.replace(
  `placeholder="Search characters or elements…"`,
  `placeholder={activeTab === 'characters' ? "Search characters or elements…" : "Search weapons…"}`
);

content = content.replace(
  `id="character-grid"`,
  `id="dashboard-grid"`
);

const oldGridMap = `{filtered.map((char) => (
            <CharacterCard key={char.name} character={char} />
          ))}`;
const newGridMap = `{filtered.map((item) => (
            activeTab === 'characters' 
              ? <CharacterCard key={item.name} character={item} />
              : <WeaponCard key={item.id} weapon={item} />
          ))}`;
content = content.replace(oldGridMap, newGridMap);

content = content.replace(
  `No characters found`,
  `No {activeTab} found`
);

content = content.replace(
  `Try adjusting the filters or search query to see more characters.`,
  `Try adjusting the filters or search query to see more {activeTab}.`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dashboard successfully updated!');

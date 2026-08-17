import React, { useState, useCallback, useMemo } from 'react'
import charactersData from '../data/characters.json'
import weaponsData    from '../data/weapons.json'
import { toPascalCase } from '../utils/assetHelper'

// ─── Static option lists ──────────────────────────────────────────────────────

const ELEMENTS     = ['Anemo','Geo','Electro','Dendro','Hydro','Pyro','Cryo']
const WEAPON_TYPES = ['Sword','Claymore','Polearm','Bow','Catalyst']
const REGIONS      = ['Mondstadt','Liyue','Inazuma','Sumeru','Fontaine','Natlan','Snezhnaya','Khaenri\'ah','Unknown']

const MATERIAL_CATEGORIES = [
  { value: 'Local Specialty',               label: '🌿 Local Specialty' },
  { value: 'Normal Boss Material',          label: '🐲 Normal Boss' },
  { value: 'Weekly Boss Material',          label: '👑 Weekly Boss' },
  { value: 'Talent Material',               label: '📚 Talent Book' },
  { value: 'Common Enhancement Material',   label: '💧 Common Drop' },
  { value: 'Elite Enhancement Material',    label: '🏵️ Elite Drop' },
  { value: 'Weapon Ascension Material',     label: '🔮 Weapon Ascension' },
  { value: 'Character Ascension Gem',       label: '💎 Ascension Gem' },
  { value: 'Ores',                          label: '⛏️ Ores / EXP' },
  { value: 'Currency',                      label: '🪙 Currency' },
]

// ─── Derive suggestion lists from existing data ────────────────────────────────

function unique(arr) { return [...new Set(arr.filter(Boolean).sort())] }

function useDataSuggestions() {
  return useMemo(() => {
    const chars = charactersData
    const wpns  = weaponsData

    const worldBoss     = unique(chars.map(c => c.materials?.world_boss).filter(v => v !== 'nan'))
    const weeklyBoss    = unique(chars.map(c => c.materials?.weekly_boss).filter(v => v !== 'nan'))
    const talentBook    = unique(chars.map(c => c.materials?.talent_book).filter(v => v !== 'nan'))
    const mobMaterial   = unique(chars.map(c => c.materials?.mob_material))
    const localSpec     = unique(chars.map(c => c.materials?.local_specialty))
    const gemstone      = unique(chars.map(c => c.materials?.gemstone))
    const ascensionMat  = unique(wpns.map(w => w.materials?.ascension_mat))
    const eliteMat      = unique(wpns.map(w => w.materials?.elite_mat))
    const mobMat        = unique(wpns.map(w => w.materials?.mob_mat))

    return { worldBoss, weeklyBoss, talentBook, mobMaterial, localSpec, gemstone, ascensionMat, eliteMat, mobMat }
  }, [])
}

// ─── Default states ───────────────────────────────────────────────────────────

const DEFAULT_CHAR = {
  name: '', rarity: 5, weapon_type: 'Sword', element: 'Pyro',
  materials: { world_boss:'', weekly_boss:'', talent_book:'', mob_material:'', local_specialty:'', gemstone:'' },
}
const DEFAULT_WEAPON = {
  name: '', rarity: 5, type: 'Sword',
  materials: { ascension_mat:'', elite_mat:'', mob_mat:'' },
}
// Material sub-categories and their default states
const MAT_SUB_CATEGORIES = [
  { key: 'normal_boss',   label: '🐲 Normal Boss' },
  { key: 'local_spec',    label: '🌿 Local Specialty' },
  { key: 'weekly_boss',   label: '👑 Weekly Boss' },
  { key: 'talent',        label: '📚 Talent Material' },
  { key: 'common_drop',   label: '💧 Common Enemy Drop' },
  { key: 'elite_drop',    label: '🏵️ Elite Enemy Drop' },
]

const MAT_DEFAULTS = {
  normal_boss:  { name: '', region: 'Unknown' },
  local_spec:   { name: '', region: 'Unknown' },
  weekly_boss:  { bossName: '', mat1: '', mat2: '', mat3: '' },
  talent:       { series: '' },
  common_drop:  { groupName: '', star1: '', star2: '', star3: '' },
  elite_drop:   { groupName: '', star2: '', star3: '', star4: '' },
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-1.5">
        {label}
        {hint && <span className="ml-2 text-xs text-[var(--muted)] opacity-50 normal-case tracking-normal font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, listId }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      list={listId}
      autoComplete="off"
      className="w-full bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl px-3 py-2.5 outline-none focus:border-[var(--gold)] transition-colors placeholder:text-[var(--muted)] placeholder:opacity-40 "
    />
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl px-3 py-2.5 pr-8 outline-none focus:border-[var(--gold)] transition-colors cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>
        ))}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none">▼</span>
    </div>
  )
}

/** Combobox = free-text input + datalist suggestions */
function ComboInput({ value, onChange, placeholder, listId, suggestions }) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        autoComplete="off"
        className="w-full bg-[var(--elevated)] border border-[var(--border)] text-[var(--text)] text-sm rounded-xl px-3 py-2.5 outline-none focus:border-[var(--gold)] transition-colors placeholder:text-[var(--muted)] placeholder:opacity-40 "
      />
      <datalist id={listId}>
        {suggestions.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  )
}

// ─── Materials section header ─────────────────────────────────────────────────

function MatHeader() {
  return (
    <div className="border-t border-[var(--border)] pt-4 mt-1 mb-2">
      <p className="text-xs font-semibold text-[var(--gold)] tracking-widest uppercase mb-1 flex items-center gap-2">
        <span>💎</span> Materials
        <span className="text-xs text-[var(--muted)] font-normal tracking-normal normal-case">(type or pick from existing)</span>
      </p>
    </div>
  )
}

// ─── Character Form ────────────────────────────────────────────────────────────

function CharacterForm({ data, onChange, suggestions }) {
  const set    = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Character Name" hint="PascalCase — no spaces">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. HuTao" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5,4].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Element">
          <SelectInput value={data.element} onChange={v => set('element', v)} options={ELEMENTS} />
        </Field>
      </div>

      <Field label="Weapon Type">
        <SelectInput value={data.weapon_type} onChange={v => set('weapon_type', v)} options={WEAPON_TYPES} />
      </Field>

      <MatHeader />

      <Field label="World Boss Drop" hint="world_boss">
        <ComboInput value={data.materials.world_boss} onChange={v => setMat('world_boss', v)}
          placeholder="e.g. BasaltiladeOfDragon" listId="dl-world-boss" suggestions={suggestions.worldBoss} />
      </Field>
      <Field label="Weekly Boss Drop" hint="weekly_boss">
        <ComboInput value={data.materials.weekly_boss} onChange={v => setMat('weekly_boss', v)}
          placeholder="e.g. DvalinsSigh" listId="dl-weekly-boss" suggestions={suggestions.weeklyBoss} />
      </Field>
      <Field label="Talent Book Series" hint="talent_book">
        <ComboInput value={data.materials.talent_book} onChange={v => setMat('talent_book', v)}
          placeholder="e.g. Diligence" listId="dl-talent-book" suggestions={suggestions.talentBook} />
      </Field>
      <Field label="Common Mob Drop Base" hint="mob_material">
        <ComboInput value={data.materials.mob_material} onChange={v => setMat('mob_material', v)}
          placeholder="e.g. Samachurl" listId="dl-mob-material" suggestions={suggestions.mobMaterial} />
      </Field>
      <Field label="Local Specialty" hint="local_specialty">
        <ComboInput value={data.materials.local_specialty} onChange={v => setMat('local_specialty', v)}
          placeholder="e.g. CrimsonLotusBloom" listId="dl-local-spec" suggestions={suggestions.localSpec} />
      </Field>
      <Field label="Gemstone Base Name" hint="gemstone">
        <ComboInput value={data.materials.gemstone} onChange={v => setMat('gemstone', v)}
          placeholder="e.g. AgateSapphire" listId="dl-gemstone" suggestions={suggestions.gemstone} />
      </Field>
    </div>
  )
}

// ─── Weapon Form ───────────────────────────────────────────────────────────────

function WeaponForm({ data, onChange, suggestions }) {
  const set    = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Weapon Name" hint="PascalCase — no spaces">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. StaffOfHoma" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5,4,3,2,1].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Weapon Type" hint="type">
          <SelectInput value={data.type} onChange={v => set('type', v)} options={WEAPON_TYPES} />
        </Field>
      </div>

      <MatHeader />

      <Field label="Weapon Ascension Mat" hint="ascension_mat">
        <ComboInput value={data.materials.ascension_mat} onChange={v => setMat('ascension_mat', v)}
          placeholder="e.g. BolideSeries" listId="dl-asc-mat" suggestions={suggestions.ascensionMat} />
      </Field>
      <Field label="Elite Mob Drop Base" hint="elite_mat">
        <ComboInput value={data.materials.elite_mat} onChange={v => setMat('elite_mat', v)}
          placeholder="e.g. Mist" listId="dl-elite-mat" suggestions={suggestions.eliteMat} />
      </Field>
      <Field label="Common Mob Drop Base" hint="mob_mat">
        <ComboInput value={data.materials.mob_mat} onChange={v => setMat('mob_mat', v)}
          placeholder="e.g. Hilichurl" listId="dl-mob-mat" suggestions={suggestions.mobMat} />
      </Field>
    </div>
  )
}

// ─── Material Form ─────────────────────────────────────────────────────────────

// Sub-tab pill strip shared by the material section
function SubTabBar({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5 p-1 rounded-xl bg-[var(--elevated)] border border-[var(--border)]">
      {MAT_SUB_CATEGORIES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
            active === key
              ? 'bg-[var(--gold)] text-[var(--bg)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MaterialForm({ subCat, data, onSubCatChange, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })

  // Shared region picker used by simple forms
  const RegionField = () => (
    <Field label="Region" hint="optional">
      <SelectInput value={data.region ?? 'Unknown'} onChange={v => set('region', v)} options={REGIONS} />
    </Field>
  )

  return (
    <div>
      {/* Info banner */}
      <div className="mb-4 p-3 rounded-xl border border-[#60A5FA]/20 bg-[#60A5FA]/5">
        <p className="text-xs text-[#60A5FA]/80 leading-relaxed">
          <span className="font-semibold">ℹ️ New Material</span> — document a new material so you can
          reference it in the Character / Weapon forms. The output records the names as PascalCase keys.
        </p>
      </div>

      <SubTabBar active={subCat} onChange={onSubCatChange} />

      {/* ── Normal Boss ── */}
      {subCat === 'normal_boss' && (
        <>
          <Field label="Material Name" hint="PascalCase">
            <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. BasaltiladeOfDragonStorm" />
          </Field>
          <RegionField />
        </>
      )}

      {/* ── Local Specialty ── */}
      {subCat === 'local_spec' && (
        <>
          <Field label="Material Name" hint="PascalCase">
            <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. CrimsonLotusBloom" />
          </Field>
          <RegionField />
        </>
      )}

      {/* ── Weekly Boss ── */}
      {subCat === 'weekly_boss' && (
        <>
          <Field label="Weekly Boss Name" hint="e.g. Dvalin">
            <TextInput value={data.bossName} onChange={v => set('bossName', v)} placeholder="e.g. Dvalin" />
          </Field>
          <Field label="Weekly Boss Mat 1" hint="1st drop (PascalCase)">
            <TextInput value={data.mat1} onChange={v => set('mat1', v)} placeholder="e.g. DvalinsSigh" />
          </Field>
          <Field label="Weekly Boss Mat 2" hint="2nd drop (PascalCase)">
            <TextInput value={data.mat2} onChange={v => set('mat2', v)} placeholder="e.g. DvalinsClaw" />
          </Field>
          <Field label="Weekly Boss Mat 3" hint="3rd drop (PascalCase)">
            <TextInput value={data.mat3} onChange={v => set('mat3', v)} placeholder="e.g. ShardOfFoulLegacy" />
          </Field>
        </>
      )}

      {/* ── Talent Material ── */}
      {subCat === 'talent' && (
        <>
          <Field label="Talent Book Series Name" hint="base key used in character data">
            <TextInput value={data.series} onChange={v => set('series', v)} placeholder="e.g. Diligence" />
          </Field>
        </>
      )}

      {/* ── Common Enemy Drop ── */}
      {subCat === 'common_drop' && (
        <>
          <Field label="Enemy Group Name" hint="base key used in character mob_material">
            <TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. Samachurl" />
          </Field>
          <Field label="1★ Drop" hint="weakest tier">
            <TextInput value={data.star1} onChange={v => set('star1', v)} placeholder="e.g. DiviningScroll" />
          </Field>
          <Field label="2★ Drop">
            <TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. SealedScroll" />
          </Field>
          <Field label="3★ Drop" hint="strongest tier">
            <TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. ForbiddenCurseScroll" />
          </Field>
        </>
      )}

      {/* ── Elite Enemy Drop ── */}
      {subCat === 'elite_drop' && (
        <>
          <Field label="Elite Enemy Group Name" hint="base key used in weapon elite_mat">
            <TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. RuinGuard" />
          </Field>
          <Field label="2★ Drop" hint="weakest elite tier">
            <TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. RunedHead" />
          </Field>
          <Field label="3★ Drop">
            <TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. InspectorFlip" />
          </Field>
          <Field label="4★ Drop" hint="strongest elite tier">
            <TextInput value={data.star4} onChange={v => set('star4', v)} placeholder="e.g. InspectorProbe" />
          </Field>
        </>
      )}
    </div>
  )
}

// Build a typed JSON output object based on the active sub-category
function buildMatJson(subCat, data) {
  switch (subCat) {
    case 'normal_boss':
    case 'local_spec':
      return { name: toPascalCase(data.name || ''), region: data.region || 'Unknown' }
    case 'weekly_boss':
      return {
        boss: toPascalCase(data.bossName || ''),
        drops: [
          toPascalCase(data.mat1 || ''),
          toPascalCase(data.mat2 || ''),
          toPascalCase(data.mat3 || ''),
        ],
      }
    case 'talent': {
      const s = data.series || ''
      return {
        series:       toPascalCase(s),
        teaching:     s ? toPascalCase("Teachings of " + s) : '',
        guide:        s ? toPascalCase("Guide to " + s) : '',
        philosophies: s ? toPascalCase("Philosophies of " + s) : '',
      }
    }
    case 'common_drop':
      return {
        group: toPascalCase(data.groupName || ''),
        star1: toPascalCase(data.star1 || ''),
        star2: toPascalCase(data.star2 || ''),
        star3: toPascalCase(data.star3 || ''),
      }
    case 'elite_drop':
      return {
        group: toPascalCase(data.groupName || ''),
        star2: toPascalCase(data.star2 || ''),
        star3: toPascalCase(data.star3 || ''),
        star4: toPascalCase(data.star4 || ''),
      }
    default:
      return data
  }
}

// ─── Syntax Highlighter (no deps) ────────────────────────────────────────────

function syntaxHighlight(line) {
  const esc = line
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
  return esc
    .replace(/: "([^"]*)"(,?)$/g, (_,v,c) => `: <span style="color:#A3E635">"${v}"</span>${c}`)
    .replace(/"([^"]+)":/g,       (_,k)    => `<span style="color:#60A5FA">"${k}"</span>:`)
    .replace(/: (\d+)(,?)$/g,     (_,n,c)  => `: <span style="color:#F59E0B">${n}</span>${c}`)
    .replace(/([{}[\]])/g,                    `<span style="color:#9CA3AF">$1</span>`)
}

// ─── Output Panel ─────────────────────────────────────────────────────────────

function OutputPanel({ json, mode }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [json])

  const lines = json.split('\n')

  const tipText = mode === 'material'
    ? 'Use this name exactly when filling in Character / Weapon material fields above.'
    : (
      <>
        Paste inside the root <code className="text-[#A78BFA] bg-[var(--bg)] px-1 rounded text-xs">[ … ]</code> array in{' '}
        <code className="text-[#60A5FA] bg-[var(--bg)] px-1 rounded text-xs">
          {mode === 'character' ? 'src/data/characters.json' : 'src/data/weapons.json'}
        </code>. Remember the trailing comma on the previous entry.
      </>
    )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase flex items-center gap-2">
          <span>📄</span> Generated JSON
        </p>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-[var(--elevated)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--gold)]'
          }`}
        >
          {copied ? '✓ Copied!' : '⧉ Copy'}
        </button>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg)]" style={{ minHeight: '360px' }}>
        <div className="flex h-full overflow-auto custom-scrollbar">
          {/* Line numbers */}
          <div className="shrink-0 select-none border-r border-[var(--border)] bg-[var(--bg)] px-3 py-4 text-right">
            {lines.map((_, i) => (
              <div key={i} className="text-xs text-[var(--muted)] opacity-40 leading-5">{i + 1}</div>
            ))}
          </div>
          {/* Code */}
          <pre className="flex-1 p-4 text-xs leading-5 overflow-x-auto">
            <code>
              {lines.map((line, i) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) || '&nbsp;' }} />
              ))}
            </code>
          </pre>
        </div>
      </div>

      <div className="mt-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)]">
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          <span className="text-[var(--gold)] font-semibold">📌 Tip:</span> {tipText}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function formatCharData(d) {
  return {
    ...d,
    name: toPascalCase(d.name || ''),
    materials: {
      world_boss: toPascalCase(d.materials.world_boss || ''),
      weekly_boss: toPascalCase(d.materials.weekly_boss || ''),
      talent_book: toPascalCase(d.materials.talent_book || ''),
      mob_material: toPascalCase(d.materials.mob_material || ''),
      local_specialty: toPascalCase(d.materials.local_specialty || ''),
      gemstone: toPascalCase(d.materials.gemstone || ''),
    }
  }
}

function formatWeaponData(d) {
  return {
    ...d,
    name: toPascalCase(d.name || ''),
    materials: {
      ascension_mat: toPascalCase(d.materials.ascension_mat || ''),
      elite_mat: toPascalCase(d.materials.elite_mat || ''),
      mob_mat: toPascalCase(d.materials.mob_mat || ''),
    }
  }
}

export default function DevBuilder() {
  const [mode,       setMode]       = useState('material')
  const [charData,   setCharData]   = useState(DEFAULT_CHAR)
  const [weaponData, setWeaponData] = useState(DEFAULT_WEAPON)
  const [matSubCat,  setMatSubCat]  = useState('normal_boss')
  const [matData,    setMatData]    = useState(MAT_DEFAULTS.normal_boss)

  const suggestions = useDataSuggestions()

  // When sub-category changes, reset matData to matching defaults
  const handleSubCatChange = (key) => {
    setMatSubCat(key)
    setMatData(MAT_DEFAULTS[key])
  }

  const activeOutputData =
    mode === 'character' ? formatCharData(charData)
    : mode === 'weapon'  ? formatWeaponData(weaponData)
    : buildMatJson(matSubCat, matData)

  const outputJson = JSON.stringify(activeOutputData, null, 2)

  const handleReset = () => {
    if (mode === 'character') setCharData(DEFAULT_CHAR)
    else if (mode === 'weapon') setWeaponData(DEFAULT_WEAPON)
    else setMatData(MAT_DEFAULTS[matSubCat])
  }

  const formLabel = mode === 'character' ? 'Character' : mode === 'weapon' ? 'Weapon' : 'Material'

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔧</span>
            <h1 className="font-bold text-2xl md:text-3xl text-[var(--text)]">Database Builder</h1>
          </div>
          <p className="text-[var(--muted)] text-sm ml-11">
            Generate correctly-formatted JSON for new characters, weapons &amp; materials
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-400 self-start">
          ⚠ Dev Mode
        </span>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] mb-6 w-fit">
        {[
          { key: 'material',  label: '💎  New Material' },
          { key: 'character', label: '⚔️  New Character' },
          { key: 'weapon',    label: '🗡️  New Weapon' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              mode === key
                ? 'bg-[var(--gold)] text-[var(--bg)] shadow-md'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Form panel */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
          <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-5 flex items-center gap-2">
            <span>✏️</span> {formLabel} Details
          </p>

          {mode === 'character' && (
            <CharacterForm data={charData} onChange={setCharData} suggestions={suggestions} />
          )}
          {mode === 'weapon' && (
            <WeaponForm data={weaponData} onChange={setWeaponData} suggestions={suggestions} />
          )}
          {mode === 'material' && (
            <MaterialForm
              subCat={matSubCat}
              data={matData}
              onSubCatChange={handleSubCatChange}
              onChange={setMatData}
            />
          )}

          <div className="border-t border-[var(--border)] pt-4 mt-4">
            <button
              onClick={handleReset}
              className="w-full py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:border-red-500/40 hover:text-red-400 transition-all"
            >
              ↺ Reset Form
            </button>
          </div>
        </div>

        {/* Output panel */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
          <OutputPanel json={outputJson} mode={mode} />
        </div>
      </div>
    </div>
  )
}

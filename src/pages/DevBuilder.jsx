import React, { useState, useCallback, useMemo } from 'react'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import normalBossData from '../data/normal_boss.json'
import localSpecialtyData from '../data/local_specialty.json'
import weeklyBossData from '../data/weekly_boss.json'
import talentData from '../data/talent_materials.json'
import commonEnemyData from '../data/common_enemy.json'
import eliteEnemyData from '../data/elite_enemy.json'
import { toPascalCase } from '../utils/assetHelper'

// ─── Static option lists ──────────────────────────────────────────────────────

const ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']
const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst']
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Snezhnaya', 'Khaenri\'ah', 'Unknown']

const getGemFamily = (element) => {
  const gems = {
    Anemo: "VayudaTurquoise", Cryo: "ShivadaJade",
    Electro: "VajradaAmethyst", Geo: "PrithivaTopaz",
    Hydro: "VarunadaLazulite", Pyro: "AgnidusAgate",
    Dendro: "NagadusEmerald"
  }
  return gems[element] || ""
}

const MATERIAL_CATEGORIES = [
  { value: 'Local Specialty', label: '🌿 Local Specialty' },
  { value: 'Normal Boss Material', label: '🐲 Normal Boss' },
  { value: 'Weekly Boss Material', label: '👑 Weekly Boss' },
  { value: 'Talent Material', label: '📚 Talent Book' },
  { value: 'Common Enhancement Material', label: '💧 Common Drop' },
  { value: 'Elite Enhancement Material', label: '🏵️ Elite Drop' },
  { value: 'Weapon Ascension Material', label: '🔮 Weapon Ascension' },
  { value: 'Character Ascension Gem', label: '💎 Ascension Gem' },
  { value: 'Ores', label: '⛏️ Ores / EXP' },
  { value: 'Currency', label: '🪙 Currency' },
]

// ─── Derive suggestion lists from existing data ────────────────────────────────

function unique(arr) { return [...new Set(arr.filter(Boolean).sort())] }

function useDataSuggestions() {
  return useMemo(() => {
    const chars = charactersData
    const wpns = weaponsData

    const worldBoss = unique(chars.map(c => c.materials?.world_boss_material_id).filter(v => v !== 'nan'))
    const weeklyBoss = unique(chars.map(c => c.materials?.weekly_boss_material_id).filter(v => v !== 'nan'))
    const talentBook = unique(chars.map(c => c.materials?.talent_material_family_id).filter(v => v !== 'nan'))
    const mobMaterial = unique(chars.map(c => c.materials?.enemy_material_family_id))
    const localSpec = unique(chars.map(c => c.materials?.local_specialty_id))
    const gemstone = unique(chars.map(c => c.materials?.gem_family_id))

    const ascensionMat = unique(wpns.map(w => w.materials?.ascension_material_family_id))
    const eliteMat = unique(wpns.map(w => w.materials?.enhancement_material_family_id))
    const mobMat = unique(wpns.map(w => w.materials?.enemy_material_family_id))

    return { worldBoss, weeklyBoss, talentBook, mobMaterial, localSpec, gemstone, ascensionMat, eliteMat, mobMat }
  }, [])
}

// ─── Default states ───────────────────────────────────────────────────────────

const DEFAULT_CHAR = {
  name: '', rarity: 5, weapon_type: 'Sword', element: 'Pyro',
  materials: {
    world_boss_material_id: '', weekly_boss_material_id: '',
    talent_material_family_id: '', enemy_material_family_id: '',
    local_specialty_id: '', gem_family_id: 'AgnidusAgate'
  },
}
const DEFAULT_WEAPON = {
  name: '', rarity: 5, type: 'Sword',
  materials: { ascension_material_family_id: '', enhancement_material_family_id: '', enemy_material_family_id: '' },
}

const MAT_SUB_CATEGORIES = [
  { key: 'normal_boss', label: '🐲 Normal Boss' },
  { key: 'local_spec', label: '🌿 Local Specialty' },
  { key: 'weekly_boss', label: '👑 Weekly Boss' },
  { key: 'talent', label: '📚 Talent Material' },
  { key: 'common_drop', label: '💧 Common Enemy Drop' },
  { key: 'elite_drop', label: '🏵️ Elite Enemy Drop' },
]

const MAT_DEFAULTS = {
  normal_boss: { name: '', bossName: '', region: 'Unknown' },
  local_spec: { name: '', region: 'Unknown' },
  weekly_boss: { bossName: '', region: 'Unknown', mat1: '', mat2: '', mat3: '' },
  talent: { series: '', region: 'Unknown', domain: '', days: '' },
  common_drop: { groupName: '', star1: '', star2: '', star3: '' },
  elite_drop: { groupName: '', star2: '', star3: '', star4: '' },
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
  const set = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Character Name" hint="Spaces allowed; ID generates automatically">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Hu Tao" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5, 4].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Element">
          <SelectInput value={data.element} onChange={v => {
            set('element', v);
            setMat('gem_family_id', getGemFamily(v));
          }} options={ELEMENTS} />
        </Field>
      </div>

      <Field label="Weapon Type">
        <SelectInput value={data.weapon_type} onChange={v => set('weapon_type', v)} options={WEAPON_TYPES} />
      </Field>

      <MatHeader />

      <Field label="World Boss Drop" hint="world_boss_material_id">
        <ComboInput value={data.materials.world_boss_material_id} onChange={v => setMat('world_boss_material_id', v)}
          placeholder="e.g. BasaltiladeOfDragon" listId="dl-world-boss" suggestions={suggestions.worldBoss} />
      </Field>
      <Field label="Weekly Boss Drop" hint="weekly_boss_material_id">
        <ComboInput value={data.materials.weekly_boss_material_id} onChange={v => setMat('weekly_boss_material_id', v)}
          placeholder="e.g. DvalinsSigh" listId="dl-weekly-boss" suggestions={suggestions.weeklyBoss} />
      </Field>
      <Field label="Talent Book Series" hint="talent_material_family_id">
        <ComboInput value={data.materials.talent_material_family_id} onChange={v => setMat('talent_material_family_id', v)}
          placeholder="e.g. Diligence" listId="dl-talent-book" suggestions={suggestions.talentBook} />
      </Field>
      <Field label="Common Mob Drop Base" hint="enemy_material_family_id">
        <ComboInput value={data.materials.enemy_material_family_id} onChange={v => setMat('enemy_material_family_id', v)}
          placeholder="e.g. Samachurl" listId="dl-mob-material" suggestions={suggestions.mobMaterial} />
      </Field>
      <Field label="Local Specialty" hint="local_specialty_id">
        <ComboInput value={data.materials.local_specialty_id} onChange={v => setMat('local_specialty_id', v)}
          placeholder="e.g. CrimsonLotusBloom" listId="dl-local-spec" suggestions={suggestions.localSpec} />
      </Field>
      <Field label="Gemstone Base Name" hint="gem_family_id">
        <ComboInput value={data.materials.gem_family_id} onChange={v => setMat('gem_family_id', v)}
          placeholder="e.g. AgnidusAgate" listId="dl-gemstone" suggestions={suggestions.gemstone} />
      </Field>
    </div>
  )
}

// ─── Weapon Form ───────────────────────────────────────────────────────────────

function WeaponForm({ data, onChange, suggestions }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  const setMat = (k, v) => onChange({ ...data, materials: { ...data.materials, [k]: v } })

  return (
    <div>
      <Field label="Weapon Name" hint="Spaces allowed; ID generates automatically">
        <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Staff of Homa" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rarity">
          <SelectInput value={data.rarity} onChange={v => set('rarity', Number(v))}
            options={[5, 4, 3, 2, 1].map(r => ({ value: r, label: `${r}★` }))} />
        </Field>
        <Field label="Weapon Type" hint="type">
          <SelectInput value={data.type} onChange={v => set('type', v)} options={WEAPON_TYPES} />
        </Field>
      </div>

      <MatHeader />

      <Field label="Weapon Ascension Mat" hint="ascension_material_family_id">
        <ComboInput value={data.materials.ascension_material_family_id} onChange={v => setMat('ascension_material_family_id', v)}
          placeholder="e.g. DecarabianTiles" listId="dl-asc-mat" suggestions={suggestions.ascensionMat} />
      </Field>
      <Field label="Elite Mob Drop Base" hint="enhancement_material_family_id">
        <ComboInput value={data.materials.enhancement_material_family_id} onChange={v => setMat('enhancement_material_family_id', v)}
          placeholder="e.g. Mitachurl" listId="dl-elite-mat" suggestions={suggestions.eliteMat} />
      </Field>
      <Field label="Common Mob Drop Base" hint="enemy_material_family_id">
        <ComboInput value={data.materials.enemy_material_family_id} onChange={v => setMat('enemy_material_family_id', v)}
          placeholder="e.g. Slime" listId="dl-mob-mat" suggestions={suggestions.mobMat} />
      </Field>
    </div>
  )
}

// ─── Material Form ─────────────────────────────────────────────────────────────

function SubTabBar({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5 p-1 rounded-xl bg-[var(--elevated)] border border-[var(--border)]">
      {MAT_SUB_CATEGORIES.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${active === key ? 'bg-[var(--gold)] text-[var(--bg)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
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
  const RegionField = () => (
    <Field label="Region" hint="optional">
      <SelectInput value={data.region ?? 'Unknown'} onChange={v => set('region', v)} options={REGIONS} />
    </Field>
  )

  return (
    <div>
      <div className="mb-4 p-3 rounded-xl border border-[#60A5FA]/20 bg-[#60A5FA]/5">
        <p className="text-xs text-[#60A5FA]/80 leading-relaxed">
          <span className="font-semibold">ℹ️ New Material</span> — document a new material so you can
          reference it in the Character / Weapon forms.
        </p>
      </div>

      <SubTabBar active={subCat} onChange={onSubCatChange} />

      {subCat === 'normal_boss' && (
        <>
          <Field label="Material Name" hint="Spaces allowed"><TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Basaltilade" /></Field>
          <Field label="Boss Name" hint="Spaces allowed"><TextInput value={data.bossName} onChange={v => set('bossName', v)} placeholder="e.g. Anemo Hypostasis" /></Field>
          <RegionField />
        </>
      )}
      {subCat === 'local_spec' && (
        <><Field label="Material Name" hint="Spaces allowed"><TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g. Crimson Lotus Bloom" /></Field><RegionField /></>
      )}
      {subCat === 'weekly_boss' && (
        <>
          <Field label="Weekly Boss Name" hint="e.g. Stormterror Dvalin"><TextInput value={data.bossName} onChange={v => set('bossName', v)} placeholder="e.g. Stormterror Dvalin" /></Field>
          <RegionField />
          <Field label="Weekly Boss Mat 1" hint="1st drop (Spaces allowed)"><TextInput value={data.mat1} onChange={v => set('mat1', v)} placeholder="e.g. Dvalin's Sigh" /></Field>
          <Field label="Weekly Boss Mat 2" hint="2nd drop (Spaces allowed)"><TextInput value={data.mat2} onChange={v => set('mat2', v)} placeholder="e.g. Dvalin's Claw" /></Field>
          <Field label="Weekly Boss Mat 3" hint="3rd drop (Spaces allowed)"><TextInput value={data.mat3} onChange={v => set('mat3', v)} placeholder="e.g. Shard of a Foul Legacy" /></Field>
        </>
      )}
      {subCat === 'talent' && (
        <>
          <Field label="Talent Book Series Name" hint="e.g. Freedom"><TextInput value={data.series} onChange={v => set('series', v)} placeholder="e.g. Freedom" /></Field>
          <RegionField />
          <Field label="Domain Name" hint="Spaces allowed"><TextInput value={data.domain} onChange={v => set('domain', v)} placeholder="e.g. Forsaken Rift" /></Field>
          <Field label="Drop Days" hint="Comma-separated numbers (e.g. 1, 4)"><TextInput value={data.days} onChange={v => set('days', v)} placeholder="e.g. 1, 4" /></Field>
        </>
      )}
      {subCat === 'common_drop' && (
        <>
          <Field label="Enemy Group Name" hint="e.g. Slime"><TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. Slime" /></Field>
          <Field label="1★ Drop" hint="weakest tier"><TextInput value={data.star1} onChange={v => set('star1', v)} placeholder="e.g. Slime Condensate" /></Field>
          <Field label="2★ Drop"><TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. Slime Secretions" /></Field>
          <Field label="3★ Drop" hint="strongest tier"><TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. Slime Concentrate" /></Field>
        </>
      )}
      {subCat === 'elite_drop' && (
        <>
          <Field label="Elite Enemy Group Name" hint="e.g. Mitachurl"><TextInput value={data.groupName} onChange={v => set('groupName', v)} placeholder="e.g. Mitachurl" /></Field>
          <Field label="2★ Drop" hint="weakest elite tier"><TextInput value={data.star2} onChange={v => set('star2', v)} placeholder="e.g. Heavy Horn" /></Field>
          <Field label="3★ Drop"><TextInput value={data.star3} onChange={v => set('star3', v)} placeholder="e.g. Black Bronze Horn" /></Field>
          <Field label="4★ Drop" hint="strongest elite tier"><TextInput value={data.star4} onChange={v => set('star4', v)} placeholder="e.g. Black Crystal Horn" /></Field>
        </>
      )}
    </div>
  )
}

const floatAdd = (base, increment) => parseFloat((base + increment).toFixed(3));

const getLastSortOrder = (dataArray, defaultOrder, tierKey) => {
  if (!dataArray || dataArray.length === 0) return defaultOrder;
  const lastItem = dataArray[dataArray.length - 1];
  if (tierKey && lastItem.tiers && lastItem.tiers[tierKey]) {
    return lastItem.tiers[tierKey].sortOrder;
  }
  return lastItem.sortOrder || defaultOrder;
}

function buildMatJson(subCat, data, queueLength) {
  switch (subCat) {
    case 'normal_boss': {
      const baseOrder = getLastSortOrder(normalBossData, 2.000);
      return {
        id: toPascalCase(data.name || ''),
        name: data.name,
        type: 'normal_boss',
        boss_name: data.bossName || '',
        region: data.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'local_spec': {
      const baseOrder = getLastSortOrder(localSpecialtyData, 8.000);
      return {
        id: toPascalCase(data.name || ''),
        name: data.name,
        region: data.region || 'Unknown',
        sortOrder: floatAdd(baseOrder, (queueLength + 1) * 0.001)
      }
    }
    case 'weekly_boss': {
      const baseOrder = getLastSortOrder(weeklyBossData, 3.000);
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return [
        {
          id: toPascalCase(data.mat1 || ''),
          name: data.mat1,
          type: 'weekly_boss',
          boss_name: data.bossName || '',
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.001)
        },
        {
          id: toPascalCase(data.mat2 || ''),
          name: data.mat2,
          type: 'weekly_boss',
          boss_name: data.bossName || '',
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.002)
        },
        {
          id: toPascalCase(data.mat3 || ''),
          name: data.mat3,
          type: 'weekly_boss',
          boss_name: data.bossName || '',
          region: data.region || 'Unknown',
          sortOrder: floatAdd(startOrder, 0.003)
        }
      ]
    }
    case 'talent': {
      const baseOrder = getLastSortOrder(talentData, 4.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      const s = data.series || '';
      return {
        id: toPascalCase(s),
        name: s,
        region: data.region || 'Unknown',
        tiers: {
          "4_star": {
            id: toPascalCase("Philosophies of " + s),
            name: "Philosophies of " + s,
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "3_star": {
            id: toPascalCase("Guide to " + s),
            name: "Guide to " + s,
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "2_star": {
            id: toPascalCase("Teachings of " + s),
            name: "Teachings of " + s,
            sortOrder: floatAdd(startOrder, 0.003)
          }
        },
        domain: data.domain || '',
        days: (data.days || '').split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
      }
    }
    case 'common_drop': {
      const baseOrder = getLastSortOrder(commonEnemyData, 5.000, '1_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(data.groupName || ''),
        name: data.groupName,
        type: 'common_enemy',
        tiers: {
          "3_star": {
            id: toPascalCase(data.star3 || ''),
            name: data.star3,
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "2_star": {
            id: toPascalCase(data.star2 || ''),
            name: data.star2,
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "1_star": {
            id: toPascalCase(data.star1 || ''),
            name: data.star1,
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    case 'elite_drop': {
      const baseOrder = getLastSortOrder(eliteEnemyData, 6.000, '2_star');
      const startOrder = floatAdd(baseOrder, queueLength * 0.003);
      return {
        id: toPascalCase(data.groupName || ''),
        name: data.groupName,
        type: 'elite_enemy',
        tiers: {
          "4_star": {
            id: toPascalCase(data.star4 || ''),
            name: data.star4,
            sortOrder: floatAdd(startOrder, 0.001)
          },
          "3_star": {
            id: toPascalCase(data.star3 || ''),
            name: data.star3,
            sortOrder: floatAdd(startOrder, 0.002)
          },
          "2_star": {
            id: toPascalCase(data.star2 || ''),
            name: data.star2,
            sortOrder: floatAdd(startOrder, 0.003)
          }
        }
      }
    }
    default:
      return data
  }
}

// ─── Syntax Highlighter & Output ─────────────────────────────────────────────

function syntaxHighlight(line) {
  const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/: "([^"]*)"(,?)$/g, (_, v, c) => `: <span style="color:#A3E635">"${v}"</span>${c}`)
    .replace(/"([^"]+)":/g, (_, k) => `<span style="color:#60A5FA">"${k}"</span>:`)
    .replace(/: (\d+)(,?)$/g, (_, n, c) => `: <span style="color:#F59E0B">${n}</span>${c}`)
    .replace(/([{}[\]])/g, `<span style="color:#9CA3AF">$1</span>`)
}

function OutputPanel({ json, mode }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
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
        </code>. Remember the trailing comma.
      </>
    )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase flex items-center gap-2">
          <span>📄</span> Generated JSON
        </p>
        <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${copied ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[var(--elevated)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--gold)]'}`}>
          {copied ? '✓ Copied!' : '⧉ Copy'}
        </button>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg)]" style={{ minHeight: '360px' }}>
        <div className="flex h-full overflow-auto custom-scrollbar">
          <div className="shrink-0 select-none border-r border-[var(--border)] bg-[var(--bg)] px-3 py-4 text-right">
            {lines.map((_, i) => <div key={i} className="text-xs text-[var(--muted)] opacity-40 leading-5">{i + 1}</div>)}
          </div>
          <pre className="flex-1 p-4 text-xs leading-5 overflow-x-auto">
            <code>{lines.map((line, i) => <div key={i} dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) || '&nbsp;' }} />)}</code>
          </pre>
        </div>
      </div>
      <div className="mt-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)]">
        <p className="text-xs text-[var(--muted)] leading-relaxed"><span className="text-[var(--gold)] font-semibold">📌 Tip:</span> {tipText}</p>
      </div>
    </div>
  )
}

// ─── Formatting Wrappers ──────────────────────────────────────────────────────

function formatCharData(d, releaseOrderNum) {
  return {
    id: toPascalCase(d.name || ''),
    name: d.name,
    rarity: "★".repeat(d.rarity),
    weapon_type: d.weapon_type,
    element: d.element,
    materials: {
      world_boss_material_id: toPascalCase(d.materials.world_boss_material_id || ''),
      weekly_boss_material_id: toPascalCase(d.materials.weekly_boss_material_id || ''),
      talent_material_family_id: toPascalCase(d.materials.talent_material_family_id || ''),
      enemy_material_family_id: toPascalCase(d.materials.enemy_material_family_id || ''),
      local_specialty_id: toPascalCase(d.materials.local_specialty_id || ''),
      gem_family_id: toPascalCase(d.materials.gem_family_id || ''),
    },
    release_order: releaseOrderNum
  }
}

function formatWeaponData(d, releaseOrderNum) {
  return {
    id: toPascalCase(d.name || ''),
    name: d.name,
    rarity: "★".repeat(d.rarity),
    type: d.type,
    materials: {
      ascension_material_family_id: toPascalCase(d.materials.ascension_material_family_id || ''),
      enhancement_material_family_id: toPascalCase(d.materials.enhancement_material_family_id || ''),
      enemy_material_family_id: toPascalCase(d.materials.enemy_material_family_id || ''),
    },
    release_order: releaseOrderNum
  }
}

export default function DevBuilder() {
  const [mode, setMode] = useState('material')

  // Active Form States
  const [charData, setCharData] = useState(DEFAULT_CHAR)
  const [weaponData, setWeaponData] = useState(DEFAULT_WEAPON)
  const [matSubCat, setMatSubCat] = useState('normal_boss')
  const [matData, setMatData] = useState(MAT_DEFAULTS.normal_boss)

  // Accumulator Queues for bulk entry
  const [charQueue, setCharQueue] = useState([])
  const [weaponQueue, setWeaponQueue] = useState([])
  const [matQueue, setMatQueue] = useState([])

  const suggestions = useDataSuggestions()

  const handleSubCatChange = (key) => {
    setMatSubCat(key)
    setMatData(MAT_DEFAULTS[key])
    setMatQueue([]) // Clear queue when switching subcategories
  }

  // Calculate accurate baseline Release Order from JSON
  const baseReleaseOrder = charactersData.length > 0
    ? (charactersData[charactersData.length - 1].release_order || charactersData.length)
    : 0;

  const baseWeaponReleaseOrder = weaponsData.length > 0
    ? (weaponsData[weaponsData.length - 1].release_order || 1.000)
    : 1.000;

  // Determine what to render based on queue length
  let activeOutputData;
  if (mode === 'character') {
    const currentFormatted = formatCharData(charData, baseReleaseOrder + charQueue.length + 1);
    activeOutputData = charQueue.length > 0 ? [...charQueue, currentFormatted] : currentFormatted;
  } else if (mode === 'weapon') {
    const currentFormatted = formatWeaponData(weaponData, floatAdd(baseWeaponReleaseOrder, (weaponQueue.length + 1) * 0.001));
    activeOutputData = weaponQueue.length > 0 ? [...weaponQueue, currentFormatted] : currentFormatted;
  } else {
    const currentFormatted = buildMatJson(matSubCat, matData, matQueue.length);
    const flatQueue = matQueue.flat();
    const flatCurrent = Array.isArray(currentFormatted) ? currentFormatted : [currentFormatted];
    activeOutputData = matQueue.length > 0 ? [...flatQueue, ...flatCurrent] : (Array.isArray(currentFormatted) ? currentFormatted : currentFormatted);
  }

  const outputJson = JSON.stringify(activeOutputData, null, 2)

  const handleAddAnother = () => {
    if (mode === 'character') {
      const currentFormatted = formatCharData(charData, baseReleaseOrder + charQueue.length + 1);
      setCharQueue([...charQueue, currentFormatted]);
      setCharData(DEFAULT_CHAR);
    } else if (mode === 'weapon') {
      const currentFormatted = formatWeaponData(weaponData, floatAdd(baseWeaponReleaseOrder, (weaponQueue.length + 1) * 0.001));
      setWeaponQueue([...weaponQueue, currentFormatted]);
      setWeaponData(DEFAULT_WEAPON);
    } else {
      setMatQueue([...matQueue, buildMatJson(matSubCat, matData, matQueue.length)]);
      setMatData(MAT_DEFAULTS[matSubCat]);
    }
  }

  const handleReset = () => {
    if (mode === 'character') {
      setCharData(DEFAULT_CHAR);
      setCharQueue([]);
    } else if (mode === 'weapon') {
      setWeaponData(DEFAULT_WEAPON);
      setWeaponQueue([]);
    } else {
      setMatData(MAT_DEFAULTS[matSubCat]);
      setMatQueue([]);
    }
  }

  const formLabel = mode === 'character' ? 'Character' : mode === 'weapon' ? 'Weapon' : 'Material'

  return (
    <div className="animate-fade-in">
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

      <div className="flex gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] mb-6 w-fit">
        {[
          { key: 'material', label: '💎  New Material' },
          { key: 'character', label: '⚔️  New Character' },
          { key: 'weapon', label: '🗡️  New Weapon' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${mode === key ? 'bg-[var(--gold)] text-[var(--bg)] shadow-md' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
          <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase mb-5 flex items-center gap-2">
            <span>✏️</span> {formLabel} Details
          </p>

          {mode === 'character' && <CharacterForm data={charData} onChange={setCharData} suggestions={suggestions} />}
          {mode === 'weapon' && <WeaponForm data={weaponData} onChange={setWeaponData} suggestions={suggestions} />}
          {mode === 'material' && <MaterialForm subCat={matSubCat} data={matData} onSubCatChange={handleSubCatChange} onChange={setMatData} />}

          <div className="border-t border-[var(--border)] pt-4 mt-4 flex gap-3">
            <button onClick={handleAddAnother} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition-all">
              ➕ Add Another
            </button>
            <button onClick={handleReset} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:border-red-500/40 hover:text-red-400 transition-all">
              ↺ Reset Form
            </button>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
          <OutputPanel json={outputJson} mode={mode} />
        </div>
      </div>
    </div>
  )
}
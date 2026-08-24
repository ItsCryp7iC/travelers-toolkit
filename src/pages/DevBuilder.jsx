import React, { useState, useCallback, useMemo, useEffect } from 'react'
import charactersData from '../data/characters.json'
import weaponsData from '../data/weapons.json'
import normalBossData from '../data/normal_boss.json'
import localSpecialtyData from '../data/local_specialty.json'
import weeklyBossData from '../data/weekly_boss.json'
import talentData from '../data/talent_materials.json'
import commonEnemyData from '../data/common_enemy.json'
import eliteEnemyData from '../data/elite_enemy.json'
import weaponAscensionData from '../data/weapon_ascension.json'
import { toPascalCase } from '../utils/assetHelper'

// ─── Static option lists ──────────────────────────────────────────────────────

const ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']
const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Catalyst', 'Bow']
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya']

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

    const worldBoss = unique(normalBossData.map(m => m.name))
    const weeklyBoss = unique(weeklyBossData.map(m => m.name))
    const talentBook = unique(talentData.map(m => m.name))
    const mobMaterial = unique(commonEnemyData.map(m => m.name))
    const localSpec = unique(localSpecialtyData.map(m => m.name))
    const gemstone = unique(chars.map(c => c.materials?.gem_family_id))

    const ascensionMat = unique(weaponAscensionData.map(m => m.name))
    const eliteMat = unique(eliteEnemyData.map(m => m.name))
    const mobMat = mobMaterial

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
  normal_boss: { name: '', bossName: '', region: REGIONS[REGIONS.length - 1] },
  local_spec: { name: '', region: REGIONS[REGIONS.length - 1] },
  weekly_boss: { bossName: '', region: REGIONS[REGIONS.length - 1], mat1: '', mat2: '', mat3: '' },
  talent: { series1: '', series2: '', series3: '', domain: '', region: REGIONS[REGIONS.length - 1] },
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
            onChange({
              ...data,
              element: v,
              materials: {
                ...data.materials,
                gem_family_id: getGemFamily(v)
              }
            });
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
      <SelectInput value={data.region ?? REGIONS[REGIONS.length - 1]} onChange={v => set('region', v)} options={REGIONS} />
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
          <Field label="Talent Series Name 1 (Mon/Thu)" hint="e.g. Freedom"><TextInput value={data.series1} onChange={v => set('series1', v)} placeholder="e.g. Freedom" /></Field>
          <Field label="Talent Series Name 2 (Tue/Fri)" hint="e.g. Resistance"><TextInput value={data.series2} onChange={v => set('series2', v)} placeholder="e.g. Resistance" /></Field>
          <Field label="Talent Series Name 3 (Wed/Sat)" hint="e.g. Ballad"><TextInput value={data.series3} onChange={v => set('series3', v)} placeholder="e.g. Ballad" /></Field>
          <RegionField />
          <Field label="Domain Name" hint="Spaces allowed"><TextInput value={data.domain} onChange={v => set('domain', v)} placeholder="e.g. Forsaken Rift" /></Field>
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
      const startOrder = floatAdd(baseOrder, queueLength * 0.001);
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
      
      const createSeries = (s, days, offset) => ({
        id: toPascalCase(s),
        name: s,
        region: data.region || 'Unknown',
        tiers: {
          "4_star": {
            id: toPascalCase("Philosophies of " + s),
            name: "Philosophies of " + s,
            sortOrder: floatAdd(startOrder, offset + 0.001)
          },
          "3_star": {
            id: toPascalCase("Guide to " + s),
            name: "Guide to " + s,
            sortOrder: floatAdd(startOrder, offset + 0.002)
          },
          "2_star": {
            id: toPascalCase("Teachings of " + s),
            name: "Teachings of " + s,
            sortOrder: floatAdd(startOrder, offset + 0.003)
          }
        },
        domain: data.domain || '',
        days
      });

      return [
        createSeries(data.series1 || '', [1, 4], 0.000),
        createSeries(data.series2 || '', [2, 5], 0.003),
        createSeries(data.series3 || '', [3, 6], 0.006)
      ];
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

function OutputPanel({ content, isScript, onToggleView, stagedUpdates, onOpenStagingModal }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }, [content])

  const handleDownload = useCallback(() => {
    if (!isScript) return;
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'update_db.cjs';
    a.click();
    URL.revokeObjectURL(url);
  }, [content, isScript]);

  const lines = content.split('\n')

  const getUniqueCount = (file, arr) => {
    if (file === 'weekly_boss.json') {
      const uniqueBosses = new Set(arr.map(obj => obj.boss_name));
      return uniqueBosses.size;
    }
    return arr.length;
  };

  const totalItems = Object.entries(stagedUpdates || {}).reduce((acc, [file, arr]) => acc + getUniqueCount(file, arr), 0);
  const LABELS = {
    "characters.json": "Characters",
    "weapons.json": "Weapons",
    "normal_boss.json": "Normal Bosses",
    "local_specialty.json": "Local Specialties",
    "weekly_boss.json": "Weekly Bosses",
    "talent_materials.json": "Talent Materials",
    "common_enemy.json": "Common Enemies",
    "elite_enemy.json": "Elite Enemies"
  };
  const tooltipLines = Object.entries(stagedUpdates || {})
    .filter(([_, arr]) => arr.length > 0)
    .map(([file, arr]) => `${getUniqueCount(file, arr)}x ${LABELS[file] || file}`);
  const tooltipStr = tooltipLines.length > 0 ? tooltipLines.join('\n') : 'No items staged';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--muted)] tracking-widest uppercase flex items-center gap-2">
          <span>{isScript ? '📜' : '📄'}</span> {isScript ? 'Generated Node Script' : 'JSON Preview'}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onOpenStagingModal} className="text-xs font-bold px-2 py-1 bg-[var(--elevated)] border border-[var(--border)] rounded text-[#60A5FA] cursor-pointer hover:border-[#60A5FA] transition-all duration-200" title={tooltipStr}>
            {totalItems} Item(s)
          </button>
          <button onClick={onToggleView} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--elevated)] text-[var(--muted)] hover:border-[#60A5FA] hover:text-[#60A5FA] transition-all duration-200">
            {isScript ? 'View JSON' : 'Generate Node Script'}
          </button>
          {isScript && (
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--elevated)] text-[var(--muted)] hover:border-[#A78BFA] hover:text-[#A78BFA] transition-all duration-200">
              ⬇ Download update_db.cjs
            </button>
          )}
          <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${copied ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[var(--elevated)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--gold)]'}`}>
            {copied ? '✓ Copied!' : '⧉ Copy'}
          </button>
        </div>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg)]" style={{ minHeight: '360px' }}>
        <div className="flex h-full overflow-auto custom-scrollbar">
          <div className="shrink-0 select-none border-r border-[var(--border)] bg-[var(--bg)] px-3 py-4 text-right">
            {lines.map((_, i) => <div key={i} className="text-xs text-[var(--muted)] opacity-40 leading-5">{i + 1}</div>)}
          </div>
          <pre className="flex-1 p-4 text-xs leading-5 overflow-x-auto">
            <code>{lines.map((line, i) => <div key={i} dangerouslySetInnerHTML={{ __html: isScript ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : syntaxHighlight(line) || '&nbsp;' }} />)}</code>
          </pre>
        </div>
      </div>
      {!isScript && (
        <div className="mt-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)]">
          <p className="text-xs text-[var(--muted)] leading-relaxed"><span className="text-[var(--gold)] font-semibold">📌 Tip:</span> Stage your updates first, then generate the script to apply them.</p>
        </div>
      )}
    </div>
  )
}

// ─── Formatting Wrappers ──────────────────────────────────────────────────────

function formatCharData(d, releaseOrderNum, lookupMap) {
  return {
    id: toPascalCase(d.name || ''),
    name: d.name,
    rarity: "★".repeat(d.rarity),
    weapon_type: d.weapon_type,
    element: d.element,
    materials: {
      world_boss_material_id: lookupMap[d.materials.world_boss_material_id] || '',
      weekly_boss_material_id: lookupMap[d.materials.weekly_boss_material_id] || '',
      talent_material_family_id: lookupMap[d.materials.talent_material_family_id] || '',
      enemy_material_family_id: lookupMap[d.materials.enemy_material_family_id] || '',
      local_specialty_id: lookupMap[d.materials.local_specialty_id] || '',
      gem_family_id: lookupMap[d.materials.gem_family_id] || '',
    },
    release_order: releaseOrderNum
  }
}

const WEAPON_TYPE_MAP = { Sword: 1, Claymore: 2, Polearm: 3, Catalyst: 4, Bow: 5 };

function formatWeaponData(d, allWeapons, lookupMap) {
  const typeBlock = WEAPON_TYPE_MAP[d.type] || 1;
  const rarity = d.rarity || 5;

  let maxSequence = 0;
  for (const w of allWeapons) {
    const wRarity = typeof w.rarity === 'string' ? w.rarity.length : w.rarity;
    if (wRarity === rarity && w.type === d.type && w.release_order) {
      const roStr = Number(w.release_order).toFixed(3);
      const seqStr = roStr.slice(3);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSequence) {
        maxSequence = seqNum;
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const sequenceStr = String(nextSequence).padStart(2, '0');
  const releaseOrderNum = parseFloat(`${rarity}.${typeBlock}${sequenceStr}`);

  return {
    id: toPascalCase(d.name || ''),
    name: d.name,
    rarity: "★".repeat(d.rarity),
    type: d.type,
    materials: {
      ascension_material_family_id: lookupMap[d.materials.ascension_material_family_id] || '',
      enhancement_material_family_id: lookupMap[d.materials.enhancement_material_family_id] || '',
      enemy_material_family_id: lookupMap[d.materials.enemy_material_family_id] || '',
    },
    release_order: releaseOrderNum
  }
}

const FILE_MAP = {
  character: 'characters.json',
  weapon: 'weapons.json',
  normal_boss: 'normal_boss.json',
  local_spec: 'local_specialty.json',
  weekly_boss: 'weekly_boss.json',
  talent: 'talent_materials.json',
  common_drop: 'common_enemy.json',
  elite_drop: 'elite_enemy.json',
}

function generateNodeScript(stagedUpdates) {
  const stagedStr = JSON.stringify(stagedUpdates, null, 2);
  return `const fs = require('fs');
const path = require('path');

// Auto-generated payload
const stagedData = ${stagedStr};

Object.keys(stagedData).forEach(filename => {
  if (stagedData[filename].length === 0) return;
  const filePath = path.join(__dirname, 'src', 'data', filename);
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const currentData = JSON.parse(fileContent);
    currentData.push(...stagedData[filename]);
    
    if (currentData.length > 0) {
      const hasReleaseOrder = currentData.some(item => 'release_order' in item);
      const hasSortOrder = currentData.some(item => 'sortOrder' in item);
      
      if (hasReleaseOrder) {
        currentData.sort((a, b) => (parseFloat(a.release_order) || 99999) - (parseFloat(b.release_order) || 99999));
      } else if (hasSortOrder) {
        currentData.sort((a, b) => (parseFloat(a.sortOrder) || 99999) - (parseFloat(b.sortOrder) || 99999));
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));
    console.log(\`✅ Successfully updated \${filename}\`);
  } catch (err) {
    console.error(\`❌ Failed to update \${filename}:\`, err.message);
  }
});`;
}

function StagingModal({ isOpen, onClose, stagedUpdates, setStagedUpdates }) {
  const [editingItemInfo, setEditingItemInfo] = useState(null); // { filename, index }
  const [editingJson, setEditingJson] = useState("");

  if (!isOpen) return null;

  const handleRemove = (filename, index) => {
    setStagedUpdates(prev => ({
      ...prev,
      [filename]: prev[filename].filter((_, i) => i !== index)
    }));
  };

  const handleEdit = (filename, index, item) => {
    setEditingItemInfo({ filename, index });
    setEditingJson(JSON.stringify(item, null, 2));
  };

  const handleSave = () => {
    try {
      const parsedItem = JSON.parse(editingJson);
      setStagedUpdates(prev => {
        const newArr = [...prev[editingItemInfo.filename]];
        newArr[editingItemInfo.index] = parsedItem;
        return {
          ...prev,
          [editingItemInfo.filename]: newArr
        };
      });
      setEditingItemInfo(null);
      setEditingJson("");
    } catch (err) {
      alert("Invalid JSON format!");
    }
  };

  const LABELS = {
    "characters.json": "Characters",
    "weapons.json": "Weapons",
    "normal_boss.json": "Normal Bosses",
    "local_specialty.json": "Local Specialties",
    "weekly_boss.json": "Weekly Bosses",
    "talent_materials.json": "Talent Materials",
    "common_enemy.json": "Common Enemies",
    "elite_enemy.json": "Elite Enemies"
  };

  const hasItems = Object.values(stagedUpdates).some(arr => arr.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <span>📦</span> Staging Manager
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-red-400 transition-colors">
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">
          {!hasItems && (
            <div className="text-center text-[var(--muted)] py-10 opacity-60">
              No updates staged yet.
            </div>
          )}
          {Object.entries(stagedUpdates).map(([filename, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={filename}>
                <h3 className="text-sm font-semibold text-[var(--gold)] mb-3 uppercase tracking-widest border-b border-[var(--border)] pb-2">
                  {LABELS[filename] || filename} <span className="text-[var(--muted)] opacity-60 text-xs normal-case ml-2">({items.length} items)</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {items.map((item, index) => {
                    const isEditing = editingItemInfo?.filename === filename && editingItemInfo?.index === index;
                    return (
                      <div key={index} className="bg-[var(--elevated)] border border-[var(--border)] rounded-xl p-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-3">
                            <textarea
                              value={editingJson}
                              onChange={e => setEditingJson(e.target.value)}
                              className="w-full h-40 bg-[var(--bg)] border border-[#60A5FA] text-[var(--text)] text-xs font-mono rounded-lg p-3 outline-none resize-none custom-scrollbar"
                              spellCheck={false}
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingItemInfo(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)] transition-colors">
                                Cancel
                              </button>
                              <button onClick={handleSave} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#60A5FA]/10 border border-[#60A5FA] text-[#60A5FA] hover:bg-[#60A5FA]/20 transition-colors">
                                ✓ Save JSON
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--text)] truncate">
                                {item.name || item.id || 'Unnamed Item'}
                              </p>
                              {item.type && <p className="text-xs text-[var(--muted)] mt-0.5">{item.type}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => handleEdit(filename, index, item)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
                                Edit
                              </button>
                              <button onClick={() => handleRemove(filename, index)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:border-red-500/50 hover:text-red-400 transition-colors">
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DevBuilder() {
  const [mode, setMode] = useState('material')
  const [outputView, setOutputView] = useState('json')
  const [isStagingModalOpen, setIsStagingModalOpen] = useState(false)
  const [stagedUpdates, setStagedUpdates] = useState(() => {
    const saved = localStorage.getItem('devBuilder_stagedUpdates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse stagedUpdates from localStorage", e);
      }
    }
    return {
      "characters.json": [],
      "weapons.json": [],
      "normal_boss.json": [],
      "local_specialty.json": [],
      "weekly_boss.json": [],
      "talent_materials.json": [],
      "common_enemy.json": [],
      "elite_enemy.json": [],
    };
  })

  useEffect(() => {
    localStorage.setItem('devBuilder_stagedUpdates', JSON.stringify(stagedUpdates));
  }, [stagedUpdates]);

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

  const materialLookupMap = useMemo(() => {
    const map = {};

    const extractToMap = (items) => {
      items.forEach(item => {
        if (item.id) {
          map[item.id] = item.id;
          if (item.name) map[item.name] = item.id;
        }
        if (item.tiers) {
          Object.values(item.tiers).forEach(t => {
            if (t.id) {
              map[t.id] = t.id;
              if (t.name) map[t.name] = t.id;
            }
          });
        }
      });
    };

    extractToMap(normalBossData);
    extractToMap(localSpecialtyData);
    extractToMap(weeklyBossData);
    extractToMap(talentData);
    extractToMap(commonEnemyData);
    extractToMap(eliteEnemyData);
    extractToMap(weaponAscensionData);

    const flatMatQueue = matQueue.flat();
    extractToMap(flatMatQueue);

    const stagedMats = [
      ...stagedUpdates['normal_boss.json'],
      ...stagedUpdates['local_specialty.json'],
      ...stagedUpdates['weekly_boss.json'],
      ...stagedUpdates['talent_materials.json'],
      ...stagedUpdates['common_enemy.json'],
      ...stagedUpdates['elite_enemy.json'],
      ...(stagedUpdates['weapon_ascension.json'] || []),
    ];
    extractToMap(stagedMats);

    ELEMENTS.forEach(el => {
      const gem = getGemFamily(el);
      map[gem] = gem;
    });

    return map;
  }, [matQueue, stagedUpdates]);

  const getMissingMaterials = () => {
    if (mode === 'material') return [];

    const activeMaterials = mode === 'character'
      ? Object.values(charData.materials)
      : Object.values(weaponData.materials);

    const missing = [];
    for (const m of activeMaterials) {
      if (!m || m.trim() === '') continue;
      if (!materialLookupMap[m.trim()]) {
        missing.push(m.trim());
      }
    }
    return missing;
  };

  const missingMaterials = getMissingMaterials();

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
    const currentFormatted = formatCharData(charData, baseReleaseOrder + charQueue.length + 1, materialLookupMap);
    activeOutputData = charQueue.length > 0 ? [...charQueue, currentFormatted] : currentFormatted;
  } else if (mode === 'weapon') {
    const allWeapons = [...weaponsData, ...weaponQueue, ...stagedUpdates['weapons.json']];
    const currentFormatted = formatWeaponData(weaponData, allWeapons, materialLookupMap);
    activeOutputData = weaponQueue.length > 0 ? [...weaponQueue, currentFormatted] : currentFormatted;
  } else {
    const generatedMat = buildMatJson(matSubCat, matData, matQueue.length);
    if (matQueue.length > 0) {
      activeOutputData = Array.isArray(generatedMat) ? [...matQueue, ...generatedMat] : [...matQueue, generatedMat];
    } else {
      activeOutputData = generatedMat;
    }
  }

  const outputContent = outputView === 'script' ? generateNodeScript(stagedUpdates) : JSON.stringify(activeOutputData, null, 2)

  const handleStageUpdates = () => {
    const filename = FILE_MAP[mode === 'material' ? matSubCat : mode];
    const itemsToStage = Array.isArray(activeOutputData) ? activeOutputData : [activeOutputData];

    setStagedUpdates(prev => ({
      ...prev,
      [filename]: [...prev[filename], ...itemsToStage]
    }));

    handleReset();
  }

  const handleAddAnother = () => {
    if (mode === 'character') {
      const currentFormatted = formatCharData(charData, baseReleaseOrder + charQueue.length + 1, materialLookupMap);
      setCharQueue([...charQueue, currentFormatted]);
      setCharData(DEFAULT_CHAR);
    } else if (mode === 'weapon') {
      const allWeapons = [...weaponsData, ...weaponQueue, ...stagedUpdates['weapons.json']];
      const currentFormatted = formatWeaponData(weaponData, allWeapons, materialLookupMap);
      setWeaponQueue([...weaponQueue, currentFormatted]);
      setWeaponData(DEFAULT_WEAPON);
    } else {
      const generatedMat = buildMatJson(matSubCat, matData, matQueue.length);
      setMatQueue(Array.isArray(generatedMat) ? [...matQueue, ...generatedMat] : [...matQueue, generatedMat]);
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

          {missingMaterials.length > 0 && (
            <div className="mt-4 p-3 rounded-xl border border-red-500/40 bg-red-500/10">
              <p className="text-xs font-semibold text-red-400">
                ⚠️ Dependency Error: Material ID "{missingMaterials[0]}" does not exist. Please stage it as a New Material first.
              </p>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-4 mt-4 flex flex-col gap-3">
            <button
              onClick={handleStageUpdates}
              disabled={missingMaterials.length > 0}
              className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all ${missingMaterials.length > 0
                ? 'border-gray-500/30 bg-gray-500/10 text-gray-500 cursor-not-allowed'
                : 'border-[#60A5FA] bg-[#60A5FA]/10 text-[#60A5FA] hover:bg-[#60A5FA]/20'
                }`}>
              📦 Stage Updates
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleAddAnother}
                disabled={missingMaterials.length > 0}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${missingMaterials.length > 0
                  ? 'border-gray-500/30 bg-gray-500/10 text-gray-500 cursor-not-allowed'
                  : 'border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20'
                  }`}>
                ➕ Add to Queue
              </button>
              <button onClick={handleReset} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--muted)] hover:border-red-500/40 hover:text-red-400 transition-all">
                ↺ Reset Form
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
          <OutputPanel 
            content={outputContent} 
            isScript={outputView === 'script'} 
            onToggleView={() => setOutputView(v => v === 'json' ? 'script' : 'json')} 
            stagedUpdates={stagedUpdates} 
            onOpenStagingModal={() => setIsStagingModalOpen(true)} 
          />
        </div>
      </div>

      <StagingModal 
        isOpen={isStagingModalOpen} 
        onClose={() => setIsStagingModalOpen(false)} 
        stagedUpdates={stagedUpdates} 
        setStagedUpdates={setStagedUpdates} 
      />
    </div>
  )
}
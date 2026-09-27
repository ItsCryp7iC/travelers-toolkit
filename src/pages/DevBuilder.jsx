import React, { useState, useCallback } from 'react';
import charactersData from '../utils/characters';
import weaponsData from '../data/weapons.json';

import { useDataSuggestions } from './devBuilder/useDataSuggestions';
import { useBuilderStaging } from './devBuilder/useBuilderStaging';
import { useMaterialLookupMap, getMissingMaterials } from './devBuilder/builderValidation';
import { formatCharData, formatWeaponData } from './devBuilder/builderFormatters';
import { buildMatJson } from './devBuilder/materialBuilders';
import { generateNodeScript, generateAssetScript } from './devBuilder/builderScripts';
import { DEFAULT_CHAR, DEFAULT_WEAPON, MAT_DEFAULTS, FILE_MAP } from './devBuilder/constants';

import { CharacterForm } from '../components/DevBuilder/CharacterForm';
import { WeaponForm } from '../components/DevBuilder/WeaponForm';
import { MaterialForm } from '../components/DevBuilder/MaterialForm';
import { OutputPanel } from '../components/DevBuilder/OutputPanel';
import { StagingModal } from '../components/DevBuilder/StagingModal';

export default function DevBuilder() {
  const [mode, setMode] = useState('material')
  const [outputView, setOutputView] = useState('json')
  const [isStagingModalOpen, setIsStagingModalOpen] = useState(false)
  const { stagedUpdates, setStagedUpdates, handleClearStaging } = useBuilderStaging();

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
  const materialLookupMap = useMaterialLookupMap(matQueue, stagedUpdates);
  const missingMaterials = getMissingMaterials(mode, charData, weaponData, materialLookupMap);

  const handleSubCatChange = (key) => {
    setMatSubCat(key)
    setMatData(MAT_DEFAULTS[key])
    setMatQueue([]) // Clear queue when switching subcategories
  }

  // Calculate accurate baseline Release Order from JSON
  const baseReleaseOrder = charactersData.length > 0
    ? (charactersData[charactersData.length - 1].release_order || charactersData.length)
    : 0;

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

  const handleStageUpdates = () => {
    const filename = FILE_MAP[mode === 'material' ? matSubCat : mode];
    const itemsToStage = Array.isArray(activeOutputData) ? activeOutputData : [activeOutputData];

    setStagedUpdates(prev => ({
      ...prev,
      [filename]: [...(prev[filename] || []), ...itemsToStage]
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
            assetScriptContent={generateAssetScript(stagedUpdates)}
            isScript={outputView === 'script'}
            onToggleView={() => setOutputView(v => v === 'json' ? 'script' : 'json')}
            stagedUpdates={stagedUpdates}
            onOpenStagingModal={() => setIsStagingModalOpen(true)}
            onClearStaging={handleClearStaging}
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
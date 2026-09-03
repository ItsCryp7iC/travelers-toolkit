import React, { useState, useEffect } from 'react';
import { getPrimaryInventoryList } from '../utils/dataManager';
import { getCharacterAvatar, getWeaponIcon, getMaterialIcon } from '../utils/assetHelper';
import GenshinImage from './GenshinImage';

export default function GoodImportModal({ parsedData, onConfirm, onCancel }) {
  const [activeTab, setActiveTab] = useState('characters');
  const [activeMatTab, setActiveMatTab] = useState('Currency & Exp');
  const [activeSubTab, setActiveSubTab] = useState('');
  
  // State initialization
  const [characters, setCharacters] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    // 1. Characters
    setCharacters((parsedData.characters || []).map(c => ({ ...c, checked: true })));
    
    // 2. Weapons
    setWeapons((parsedData.weapons || []).map(w => ({ ...w, checked: Boolean(w.location) })));
    
    // 3. Materials
    const inventoryList = getPrimaryInventoryList();
    const inventoryMap = {};
    
    const normalizeKey = (k) => String(k).replace(/[_ ']/g, '').toLowerCase();

    inventoryList.forEach(item => {
      inventoryMap[normalizeKey(item.matKey)] = item;
    });

    const mats = Object.entries(parsedData.materials || {}).map(([key, quantity]) => {
      const dbItem = inventoryMap[normalizeKey(key)];
      let group = 'Other';
      let subGroup = '';
      let category = '';
      if (dbItem) {
        const cat = dbItem.category;
        const subCat = dbItem.subCategory;
        
        if (cat === 'Currency' || cat === 'Experience' || cat === 'Ores') {
          group = 'Currency & Exp';
        } else if (cat === 'Boss Drops') {
          group = 'Boss Drops';
          if (subCat === 'Normal Boss') subGroup = 'Normal Boss Drops';
          else if (subCat === 'Weekly Boss') subGroup = 'Weekly Boss Drops';
        } else if (cat === 'Enemy Drops') {
          group = 'Enemy Drops';
          if (subCat === 'Common Enhancement Material') subGroup = 'Common Enemy Drops';
          else if (subCat === 'Elite Enhancement Material') subGroup = 'Elite Enemy Drops';
        } else if (cat === 'Talent Materials') {
          group = 'Talent Mats';
        } else if (cat === 'Weapon Ascension Material') {
          group = 'Weapon Asc Mats';
        } else if (cat === 'Local Specialty') {
          group = 'Local Specialties';
        } else if (cat === 'Character Ascension Gem') {
          group = 'Character Gems';
        } else if (cat === 'Forging Material' || cat === 'billet' || cat === 'forgingOre') {
          group = 'Forging Mats';
        }
      }
      return { 
        key, 
        quantity, 
        checked: group !== 'Other', 
        group, 
        subGroup, 
        label: dbItem?.label || key, 
        category: dbItem?.category || '',
        dbItemKey: dbItem?.matKey
      };
    });
    setMaterials(mats);
  }, [parsedData]);

  // Derived state for material tabs
  const materialGroups = [
    'Currency & Exp', 'Boss Drops', 'Enemy Drops', 'Talent Mats', 'Weapon Asc Mats', 'Forging Mats', 'Local Specialties', 'Character Gems', 'Other'
  ];
  
  useEffect(() => {
    if (materialGroups.length > 0 && !materialGroups.includes(activeMatTab)) {
      setActiveMatTab(materialGroups[0]);
    }
  }, [materials, materialGroups, activeMatTab]);

  // Handle activeMatTab changes to automatically set sub-tabs
  useEffect(() => {
    if (activeMatTab === 'Boss Drops') setActiveSubTab('Normal Boss Drops');
    else if (activeMatTab === 'Enemy Drops') setActiveSubTab('Common Enemy Drops');
    else setActiveSubTab('');
  }, [activeMatTab]);

  // Handlers for inputs
  const updateChar = (index, field, value) => {
    const newChars = [...characters];
    newChars[index][field] = value;
    setCharacters(newChars);
  };

  const updateCharTalent = (index, field, value) => {
    const newChars = [...characters];
    newChars[index].talents = { ...newChars[index].talents, [field]: value };
    setCharacters(newChars);
  };

  const updateWeapon = (index, field, value) => {
    const newWeapons = [...weapons];
    newWeapons[index][field] = value;
    setWeapons(newWeapons);
  };

  const updateMaterial = (index, value) => {
    const newMats = [...materials];
    newMats[index].quantity = value;
    setMaterials(newMats);
  };

  // Handle Confirm
  const handleConfirm = () => {
    const finalData = {
      characters: characters.filter(c => c.checked).map(({ checked, ...rest }) => ({
        ...rest,
        level: parseInt(rest.level) || 1,
        ascension: parseInt(rest.ascension) || 0,
        talents: {
          normal: parseInt(rest.talents?.normal) || 1,
          skill: parseInt(rest.talents?.skill) || 1,
          burst: parseInt(rest.talents?.burst) || 1,
        }
      })),
      weapons: weapons.filter(w => w.checked).map(({ checked, ...rest }) => ({
        ...rest,
        level: parseInt(rest.level) || 1,
        ascension: parseInt(rest.ascension) || 0,
        refinement: parseInt(rest.refinement) || 1,
      })),
      materials: {}
    };
    
    materials.filter(m => m.checked).forEach(m => {
      const finalKey = m.dbItemKey || m.key;
      finalData.materials[finalKey] = parseInt(m.quantity, 10) || 0;
    });
    
    onConfirm(finalData);
  };

  const activeMaterials = materials.filter(m => {
    if (m.group !== activeMatTab) return false;
    if (activeSubTab && m.subGroup !== activeSubTab) return false;
    return true;
  });

  const renderWeaponCard = (w, index, globalIndex) => (
    <div key={globalIndex} className={`flex flex-col gap-3 p-3 rounded-xl border transition-all ${w.checked ? 'border-primary bg-[var(--elevated)] shadow-md' : 'border-[var(--border)] opacity-60'}`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={w.checked} onChange={e => updateWeapon(globalIndex, 'checked', e.target.checked)} className="accent-primary w-4 h-4 cursor-pointer shrink-0" />
        <div className="w-12 h-12 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center p-1">
          <GenshinImage src={getWeaponIcon(w.weaponName)} alt={w.weaponName} className="max-w-full max-h-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-white" title={w.weaponName}>{w.weaponName}</p>
          {w.location && <p className="text-xs text-[var(--color-text-muted)] truncate">On: {w.location}</p>}
          {!w.location && <p className="text-xs text-[var(--color-text-muted)]">Unequipped</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-[var(--border)]">
        <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
          <span className="text-xs text-[var(--color-text-muted)] uppercase">Lvl</span>
          <input type="number" min="1" max="90" value={w.level} onChange={e => updateWeapon(globalIndex, 'level', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
        </div>
        <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
          <span className="text-xs text-[var(--color-text-muted)] uppercase">Asc</span>
          <input type="number" min="0" max="6" value={w.ascension} onChange={e => updateWeapon(globalIndex, 'ascension', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
        </div>
        <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
          <span className="text-xs text-[var(--color-text-muted)] uppercase">Ref</span>
          <input type="number" min="1" max="5" value={w.refinement} onChange={e => updateWeapon(globalIndex, 'refinement', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay animate-fade-in z-50 flex items-center justify-center p-4">
      <div className="modal-panel flex flex-col h-[85vh] animate-slide-up" style={{ maxWidth: '1200px', width: '95%' }}>
        
        {/* Header */}
        <div className="modal-header shrink-0 flex justify-between items-center p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <span>📷</span> Review GOOD Import
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Select the items you want to import and modify any incorrect values.</p>
          </div>
          <button onClick={onCancel} className="text-[var(--color-text-muted)] hover:text-white text-xl px-2">✕</button>
        </div>

        {/* Main Tabs */}
        <div className="flex border-b border-[var(--border)] shrink-0 bg-[var(--elevated)]">
          {['characters', 'weapons', 'materials'].map(tab => (
            <button
              key={tab}
              className={`flex-1 py-3 text-sm font-bold uppercase transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-[var(--surface)]' : 'text-[var(--color-text-muted)] hover:text-white'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface)]">
          
          {/* Characters Tab */}
          {activeTab === 'characters' && (
            <div className="flex flex-col">
              <div className="sticky top-0 z-10 bg-[var(--surface)] p-5 pb-2 shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
                <div className="bg-[var(--gold)]/10 text-[var(--gold)] px-4 py-2 text-xs font-semibold text-center rounded-lg border border-[var(--gold)]/20">
                  {characters.filter(c => c.checked).length} selected / {characters.length} total characters
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-5 pt-4">
              {characters.map((char, index) => (
                <div key={index} className={`flex flex-col gap-3 p-3 rounded-xl border transition-all ${char.checked ? 'border-primary bg-[var(--elevated)] shadow-md' : 'border-[var(--border)] opacity-60'}`}>
                  
                  {/* Top Row */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={char.checked} onChange={e => updateChar(index, 'checked', e.target.checked)} className="accent-primary w-4 h-4 cursor-pointer shrink-0" />
                    <div className="w-12 h-12 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 relative">
                      <GenshinImage src={getCharacterAvatar(char.name)} alt={char.name} className="w-full h-full object-cover absolute inset-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis" title={char.name}>{char.name}</p>
                    </div>
                  </div>
                  
                  {/* Bottom Stats Inputs */}
                  <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between bg-[var(--surface)] px-2 py-1 rounded">
                      <span className="text-xs text-[var(--color-text-muted)]">Lvl</span>
                      <input type="number" min="1" max="90" value={char.level} onChange={(e) => updateChar(index, 'level', e.target.value)} className="w-12 bg-transparent text-right text-xs text-white outline-none" />
                    </div>
                    <div className="flex items-center justify-between bg-[var(--surface)] px-2 py-1 rounded">
                      <span className="text-xs text-[var(--color-text-muted)]">Asc</span>
                      <input type="number" min="0" max="6" value={char.ascension} onChange={(e) => updateChar(index, 'ascension', e.target.value)} className="w-12 bg-transparent text-right text-xs text-white outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
                      <span className="text-xs text-[var(--color-text-muted)] uppercase">NA</span>
                      <input type="number" min="1" max="10" value={char.talents?.normal || 1} onChange={(e) => updateCharTalent(index, 'normal', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
                    </div>
                    <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
                      <span className="text-xs text-[var(--color-text-muted)] uppercase">Skill</span>
                      <input type="number" min="1" max="10" value={char.talents?.skill || 1} onChange={(e) => updateCharTalent(index, 'skill', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
                    </div>
                    <div className="flex flex-col items-center bg-[var(--surface)] px-1 py-1 rounded">
                      <span className="text-xs text-[var(--color-text-muted)] uppercase">Burst</span>
                      <input type="number" min="1" max="10" value={char.talents?.burst || 1} onChange={(e) => updateCharTalent(index, 'burst', e.target.value)} className="w-12 bg-transparent text-center text-xs text-white outline-none" />
                    </div>
                  </div>
                </div>
              ))}
              {characters.length === 0 && <p className="text-[var(--color-text-muted)] text-center py-8 col-span-full">No characters found in file.</p>}
              </div>
            </div>
          )}

          {/* Weapons Tab */}
          {activeTab === 'weapons' && (
            <div className="flex flex-col">
              <div className="sticky top-0 z-10 bg-[var(--surface)] p-5 pb-2 shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
                <div className="bg-[var(--gold)]/10 text-[var(--gold)] px-4 py-2 text-xs font-semibold text-center rounded-lg border border-[var(--gold)]/20">
                  {weapons.filter(w => w.checked).length} selected / {weapons.length} total weapons
                </div>
              </div>
              <div className="flex flex-col gap-6 p-5 pt-4">
              {/* Equipped Weapons */}
              <div>
                <h3 className="text-sm font-bold text-[var(--gold)] mb-3 border-b border-[var(--border)] pb-1 flex items-center gap-2">
                  Equipped Weapons
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                  {weapons.filter(w => w.location).map((w, index) => renderWeaponCard(w, index, weapons.indexOf(w)))}
                  {weapons.filter(w => w.location).length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic px-4">None found.</p>}
                </div>
              </div>

              {/* Unequipped Weapons */}
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-muted)] mb-3 border-b border-[var(--border)] pb-1 flex items-center gap-2">
                  Unequipped Weapons
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                  {weapons.filter(w => !w.location).map((w, index) => renderWeaponCard(w, index, weapons.indexOf(w)))}
                  {weapons.filter(w => !w.location).length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic px-4">None found.</p>}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Materials Tab */}
          {activeTab === 'materials' && (
            <div className="flex flex-col">
              <div className="sticky top-0 z-10 bg-[var(--surface)] p-5 pb-2 shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
              {/* Primary Material Categories */}
              <div className="flex flex-wrap gap-2 mb-2">
                {materialGroups.map(group => (
                  <button 
                    key={group}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all shadow-sm ${activeMatTab === group ? 'bg-primary text-black border-primary font-bold' : 'bg-[var(--surface)] text-[var(--color-text-muted)] border-[var(--border)] hover:border-primary hover:text-white'}`}
                    onClick={() => setActiveMatTab(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>

              {/* Nested Sub-tabs */}
              {activeMatTab === 'Boss Drops' && (
                <div className="flex flex-wrap gap-2 mb-2 ml-4">
                  {['Normal Boss Drops', 'Weekly Boss Drops'].map(sub => (
                    <button 
                      key={sub}
                      className={`px-3 py-1 text-xs rounded-full border transition-all shadow-sm ${activeSubTab === sub ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-bold' : 'bg-[var(--surface)] text-[var(--color-text-muted)] border-[var(--border)] hover:border-[var(--gold)] hover:text-white'}`}
                      onClick={() => setActiveSubTab(sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              {activeMatTab === 'Enemy Drops' && (
                <div className="flex flex-wrap gap-2 mb-2 ml-4">
                  {['Common Enemy Drops', 'Elite Enemy Drops'].map(sub => (
                    <button 
                      key={sub}
                      className={`px-3 py-1 text-xs rounded-full border transition-all shadow-sm ${activeSubTab === sub ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-bold' : 'bg-[var(--surface)] text-[var(--color-text-muted)] border-[var(--border)] hover:border-[var(--gold)] hover:text-white'}`}
                      onClick={() => setActiveSubTab(sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}

              {/* Materials List */}
              <div className="bg-[var(--gold)]/10 text-[var(--gold)] px-4 py-2 text-xs font-semibold text-center rounded-lg border border-[var(--gold)]/20">
                {activeMaterials.filter(m => m.checked).length} selected / {activeMaterials.length} total materials
              </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-5 pt-4">
                {activeMaterials.map((mat) => {
                  const globalIndex = materials.indexOf(mat);
                  return (
                    <div key={globalIndex} className={`flex flex-col gap-3 p-3 rounded-xl border transition-all ${mat.checked ? 'border-primary bg-[var(--elevated)] shadow-md' : 'border-[var(--border)] opacity-60'}`}>
                      {/* Top Side */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input type="checkbox" checked={mat.checked} onChange={e => {
                          const newMats = [...materials];
                          newMats[globalIndex].checked = e.target.checked;
                          setMaterials(newMats);
                        }} className="accent-primary w-4 h-4 cursor-pointer shrink-0" />
                        
                        <div className="w-12 h-12 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center p-1 shrink-0 relative overflow-hidden">
                          <GenshinImage src={getMaterialIcon(mat.label, mat.category)} alt={mat.label} className="w-full h-full object-contain relative z-10 drop-shadow-md" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis" title={mat.label}>{mat.label}</p>
                        </div>
                      </div>
                      
                      {/* Bottom Side: Quantity Input */}
                      <div className="flex items-center gap-2 bg-[var(--surface)] px-2 py-1.5 rounded border border-[var(--border)] mt-1 justify-between">
                        <span className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider shrink-0">Qty</span>
                        <input 
                          type="number" 
                          min="0"
                          className="flex-1 min-w-0 bg-transparent text-right text-sm text-white outline-none font-bold"
                          value={mat.quantity}
                          onChange={e => updateMaterial(globalIndex, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
                {activeMaterials.length === 0 && <p className="text-[var(--color-text-muted)] text-center py-8 col-span-full">No materials in this category.</p>}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-[var(--border)] bg-[var(--elevated)] flex justify-end gap-3 rounded-b-xl">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} className="genshin-btn px-6 py-2 text-sm shadow-lg">
            Confirm Import
          </button>
        </div>

      </div>
    </div>
  );
}

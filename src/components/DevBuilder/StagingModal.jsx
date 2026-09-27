import React, { useState } from 'react';

export function StagingModal({ isOpen, onClose, stagedUpdates, setStagedUpdates }) {
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
    "weapon_ascension.json": "Weapon Ascension",
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

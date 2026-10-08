import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { reconcileCharacters } from '../utils/hoyolabCharacterReconciliation';

export default function HoyolabSyncPreviewModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [filter, setFilter] = useState('All'); // All, New, Updates, Unchanged, Needs Attention

  const roster = useStore(s => s.roster);
  const trackedWeapons = useStore(s => s.trackedWeapons);

  useEffect(() => {
    if (isOpen) {
      fetchSyncPreview();
    } else {
      setReconciliationResult(null);
      setError(null);
      setFilter('All');
    }
  }, [isOpen]);

  const fetchSyncPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hoyolab/character-sync-preview', {
        method: 'POST',
      });
      if (!res.ok) {
        let msg = 'Failed to fetch data';
        try {
          const data = await res.json();
          msg = data.detail || msg;
        } catch (e) {}
        throw new Error(msg);
      }

      const data = await res.json();

      // Perform local reconciliation
      const result = reconcileCharacters(data.characters || [], roster, trackedWeapons);
      setReconciliationResult(result);

    } catch (e) {
      setError(e.message || 'Unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderBadge = (status) => {
    if (status === 'new') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-green-500/20 text-green-400">New</span>;
    if (status === 'update') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400">Update</span>;
    if (status === 'unchanged') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[var(--surface-light)] text-[var(--muted)]">Unchanged</span>;
    if (status === 'conflict') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-500/20 text-red-400">Conflict</span>;
    if (status === 'unmapped') return <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-orange-500/20 text-orange-400">Unmapped</span>;
    return null;
  };

  let filteredChars = [];
  if (reconciliationResult) {
    filteredChars = reconciliationResult.characters.filter(c => {
      if (filter === 'All') return true;
      if (filter === 'New') return c.status === 'new';
      if (filter === 'Updates') return c.status === 'update';
      if (filter === 'Unchanged') return c.status === 'unchanged';
      if (filter === 'Needs Attention') return ['conflict', 'unmapped'].includes(c.status) || c.weaponReconciliation?.status === 'equipment-mismatch' || Object.values(c.changes || {}).some(x => x && x.direction === 'local-ahead');
      return true;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            Sync Characters from HoYoLAB
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors p-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--bg)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[var(--muted)]">Fetching and mapping characters...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
              <span className="text-4xl block mb-2">⚠️</span>
              <h3 className="text-red-400 font-bold mb-2">Sync Failed</h3>
              <p className="text-red-300/80 text-sm">{error}</p>
              <button onClick={fetchSyncPreview} className="mt-4 px-4 py-2 bg-[var(--surface-light)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors">
                Retry
              </button>
            </div>
          ) : reconciliationResult ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[var(--text)]">{reconciliationResult.summary.totalRemote}</div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Found</div>
                  {reconciliationResult.summary.ignored > 0 && (
                    <div className="text-[var(--muted)] text-[10px] mt-1 opacity-80">{reconciliationResult.summary.syncRelevant} syncable • {reconciliationResult.summary.ignored} ignored</div>
                  )}
                </div>
                <div className="bg-[var(--surface)] border border-green-500/20 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-green-400">{reconciliationResult.summary.newCharacters}</div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-wide">New</div>
                </div>
                <div className="bg-[var(--surface)] border border-blue-500/20 p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-blue-400">{reconciliationResult.summary.charactersWithUpdates}</div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Updates</div>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-xl text-center">
                  <div className="text-2xl font-bold text-[var(--text)]">{reconciliationResult.summary.unchangedCharacters}</div>
                  <div className="text-[var(--muted)] text-xs uppercase tracking-wide">Up to date</div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 border-b border-[var(--border)] overflow-x-auto pb-2">
                {['All', 'New', 'Updates', 'Unchanged', 'Needs Attention'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-colors ${filter === f ? 'bg-[var(--gold)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-3">
                {filteredChars.map((char, i) => (
                  <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">

                    {/* Char Info */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-[var(--text)]">{char.rosterKey || char.hoyolab.name}</span>
                        {renderBadge(char.status)}
                      </div>

                      {char.status === 'unmapped' ? (
                        <div className="text-orange-400 text-xs">Not yet supported by Toolkit data (ID: {char.hoyolabId})</div>
                      ) : (
                        <div className="text-[var(--muted)] text-xs">
                          C{char.hoyolab.constellation} • Friendship {char.hoyolab.friendship}
                        </div>
                      )}
                    </div>

                    {/* Diff Area */}
                    {char.status !== 'unmapped' && (
                      <div className="flex-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm w-full md:w-auto">

                        {/* Level & Asc */}
                        <div className="text-[var(--muted)]">Level</div>
                        <div className="flex items-center gap-2 font-mono">
                          {char.status === 'new' ? (
                            <span className="text-cyan-400">Lv {char.hoyolab.level} A{char.hoyolab.ascension || 0}</span>
                          ) : (
                            <>
                              <span>Lv {char.local?.level} A{char.local?.ascension}</span>
                              {(char.changes?.level || char.changes?.ascension) && (
                                <>
                                  <span className="text-[var(--muted)]">→</span>
                                  <span className={(char.changes?.level?.direction === 'local-ahead' || char.changes?.ascension?.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                                    Lv {char.hoyolab.level} A{char.hoyolab.ascension || 0}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Talents */}
                        <div className="text-[var(--muted)]">Talents</div>
                        <div className="flex items-center gap-2 font-mono">
                          {char.status === 'new' ? (
                            <span className="text-cyan-400">
                              {char.hoyolab.talents?.normal || 1} / {char.hoyolab.talents?.skill || 1} / {char.hoyolab.talents?.burst || 1}
                            </span>
                          ) : (
                            <>
                              <span>{char.local?.talents?.normal} / {char.local?.talents?.skill} / {char.local?.talents?.burst}</span>
                              {char.changes?.talents && (
                                <>
                                  <span className="text-[var(--muted)]">→</span>
                                  <span className={Object.values(char.changes.talents).some(t => t.direction === 'local-ahead') ? 'text-yellow-400' : 'text-cyan-400'}>
                                    {char.hoyolab.talents?.normal || 1} / {char.hoyolab.talents?.skill || 1} / {char.hoyolab.talents?.burst || 1}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Weapon */}
                        <div className="text-[var(--muted)]">Weapon</div>
                        <div className="flex items-center gap-2">
                          {char.weaponReconciliation?.status === 'unmapped' ? (
                            <span className="text-orange-400">Unmapped ({char.weaponReconciliation?.hoyolab?.id})</span>
                          ) : char.weaponReconciliation?.status === 'would-create' || char.status === 'new' ? (
                            <span className="text-cyan-400">
                              {char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level} R{char.hoyolab.weapon?.refinement || 1}
                            </span>
                          ) : char.weaponReconciliation?.status === 'equipment-mismatch' ? (
                            <div className="flex flex-col">
                              <span className="text-[var(--text)] line-through opacity-70">
                                {trackedWeapons.find(w => w.id === char.weaponReconciliation.equippedInstanceId)?.weaponName || 'Unknown'}
                              </span>
                              <span className="text-yellow-400">{char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level}</span>
                            </div>
                          ) : char.weaponReconciliation?.status === 'ambiguous' ? (
                            <span className="text-yellow-400">
                              {char.weaponReconciliation?.weaponName} (Multiple unassigned available)
                            </span>
                          ) : char.weaponReconciliation?.status === 'suggested-instance' ? (
                            <span className="text-blue-400">
                              {char.weaponReconciliation?.weaponName} (Suggest attaching unassigned)
                            </span>
                          ) : char.weaponReconciliation?.status === 'matched-instance' ? (
                            <span className={Object.keys(char.weaponReconciliation?.changes || {}).length > 0 ? "text-cyan-400" : "text-[var(--muted)]"}>
                              {char.weaponReconciliation?.weaponName} Lv {char.hoyolab.weapon?.level} R{char.hoyolab.weapon?.refinement || 1}
                            </span>
                          ) : null}
                        </div>

                      </div>
                    )}
                  </div>
                ))}
                {filteredChars.length === 0 && (
                  <div className="text-center py-10 text-[var(--muted)] italic">
                    No characters match this filter.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-[var(--surface-light)] hover:bg-[var(--border)] transition-colors rounded-xl font-bold text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

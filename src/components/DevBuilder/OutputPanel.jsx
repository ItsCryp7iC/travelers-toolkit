import React, { useState, useCallback } from 'react';

function syntaxHighlight(line) {
  const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/: "([^"]*)"(,?)$/g, (_, v, c) => `: <span style="color:#A3E635">"${v}"</span>${c}`)
    .replace(/"([^"]+)":/g, (_, k) => `<span style="color:#60A5FA">"${k}"</span>:`)
    .replace(/: (\d+)(,?)$/g, (_, n, c) => `: <span style="color:#F59E0B">${n}</span>${c}`)
    .replace(/([{}[\]])/g, `<span style="color:#9CA3AF">$1</span>`)
}

export function OutputPanel({ content, assetScriptContent, isScript, onToggleView, stagedUpdates, onOpenStagingModal, onClearStaging }) {
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

  const handleDownloadAsset = useCallback(() => {
    const blob = new Blob([assetScriptContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'download_assets.cjs';
    a.click();
    URL.revokeObjectURL(url);
  }, [assetScriptContent]);

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
    "weapon_ascension.json": "Weapon Ascension",
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
          <button onClick={onClearStaging} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--elevated)] text-[var(--muted)] hover:border-red-500 hover:text-red-400 transition-all duration-200" title="Clear Staging Queue">
            🗑️ Clear
          </button>
          <button onClick={onOpenStagingModal} className="text-xs font-bold px-2 py-1 bg-[var(--elevated)] border border-[var(--border)] rounded text-[#60A5FA] cursor-pointer hover:border-[#60A5FA] transition-all duration-200" title={tooltipStr}>
            {totalItems} Item(s)
          </button>
          <button onClick={onToggleView} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--elevated)] text-[var(--muted)] hover:border-[#60A5FA] hover:text-[#60A5FA] transition-all duration-200">
            {isScript ? 'View JSON' : 'Generate DB Script'}
          </button>
          <button onClick={handleDownloadAsset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--elevated)] text-[var(--muted)] hover:border-emerald-400 hover:text-emerald-400 transition-all duration-200">
            ⬇ Generate Asset Script
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

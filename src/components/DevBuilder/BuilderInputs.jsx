import React from 'react';

export function Field({ label, hint, children }) {
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

export function TextInput({ value, onChange, placeholder, listId }) {
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

export function SelectInput({ value, onChange, options }) {
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

export function ComboInput({ value, onChange, placeholder, listId, suggestions = [] }) {
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

export function MatHeader() {
  return (
    <div className="border-t border-[var(--border)] pt-4 mt-1 mb-2">
      <p className="text-xs font-semibold text-[var(--gold)] tracking-widest uppercase mb-1 flex items-center gap-2">
        <span>💎</span> Materials
        <span className="text-xs text-[var(--muted)] font-normal tracking-normal normal-case">(type or pick from existing)</span>
      </p>
    </div>
  )
}

export function SubTabBar({ active, onChange, subCategories }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-5 p-1 rounded-xl bg-[var(--elevated)] border border-[var(--border)]">
      {subCategories.map(({ key, label }) => (
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

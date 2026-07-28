import React from 'react'

/**
 * Generic placeholder for pages not yet implemented.
 */
export default function PlaceholderPage({ title, icon, description }) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)' }}
      >
        {icon}
      </div>
      <h1 className="font-cinzel font-bold text-2xl text-[var(--text)] mb-3">{title}</h1>
      <p className="text-[var(--muted)] text-sm max-w-sm">
        {description || 'This section is coming soon. Stay tuned, Traveler!'}
      </p>
      <div className="mt-6 px-4 py-2 rounded-lg text-xs text-[var(--gold)] border border-[rgba(200,169,110,0.3)] bg-[rgba(200,169,110,0.07)]">
        🚧 Under Construction
      </div>
    </div>
  )
}

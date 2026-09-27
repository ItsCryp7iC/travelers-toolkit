import React from 'react';
import { Link } from 'react-router-dom';

export default function PlannerEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.2)' }}>
        🗺️
      </div>
      <h2 className="font-bold text-xl text-[var(--text)] mb-3">No Characters in Roster</h2>
      <p className="text-[var(--muted)] text-sm max-w-sm mb-6">
        Head to the Dashboard, add characters to your roster, and set their progression targets. The Planner will calculate everything needed.
      </p>
      <Link to="/" className="genshin-btn text-sm px-6 py-2.5" id="go-to-dashboard-btn">
        ➕ Add Characters
      </Link>
    </div>
  )
}

import React, { useState, useEffect } from 'react';
import { subscribeNotifications, dismissNotification } from '../utils/notify';

export default function NotificationContainer() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return subscribeNotifications((notifications) => {
      setItems(notifications);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {items.map((n) => {
        const isError = n.type === 'error';
        const isWarning = n.type === 'warning';
        const isSuccess = n.type === 'success';

        let themeClasses = 'border-sky-500/50 bg-[#0b131f]/95 text-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.5)]';
        let icon = 'ℹ';
        let iconColor = 'text-sky-400';

        if (isError) {
          themeClasses = 'border-red-500/50 bg-[#1a0c0e]/95 text-red-100 shadow-[0_8px_30px_rgb(0,0,0,0.5)]';
          icon = '✕';
          iconColor = 'text-red-400';
        } else if (isWarning) {
          themeClasses = 'border-amber-500/50 bg-[#1c150c]/95 text-amber-100 shadow-[0_8px_30px_rgb(0,0,0,0.5)]';
          icon = '⚠️';
          iconColor = 'text-amber-400';
        } else if (isSuccess) {
          themeClasses = 'border-emerald-500/50 bg-[#0c1a13]/95 text-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.5)]';
          icon = '✓';
          iconColor = 'text-emerald-400';
        }

        return (
          <div
            key={n.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all text-sm animate-in fade-in slide-in-from-bottom-2 ${themeClasses}`}
          >
            <span className={`text-base font-bold shrink-0 mt-0.5 select-none ${iconColor}`}>
              {icon}
            </span>
            <div className="flex-1 break-words font-medium text-xs sm:text-sm leading-relaxed">
              {n.message}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissNotification(n.id)}
              className="shrink-0 text-white/50 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

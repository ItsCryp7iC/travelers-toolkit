import { recordActivity, VALID_SOURCES } from '../../activity';

function resolveSettingsSource(contextArg) {
  if (typeof contextArg === 'string' && VALID_SOURCES.has(contextArg)) {
    return contextArg;
  }
  if (typeof contextArg === 'object' && contextArg !== null) {
    if (typeof contextArg.source === 'string' && VALID_SOURCES.has(contextArg.source)) {
      return contextArg.source;
    }
  }
  return 'system';
}

export const createSettingsSlice = (set, get) => ({
  serverRegion: 'Asia',
  setServerRegion: (region, contextArg = 'system') => {
    const prevRegion = get().serverRegion;
    if (prevRegion === region) return; // Suppress no-op

    set({ serverRegion: region });

    try {
      const validSource = resolveSettingsSource(contextArg);
      recordActivity({
        category: 'settings_system',
        action: 'server_region_changed',
        source: validSource,
        entityType: 'setting',
        entityId: 'serverRegion',
        summary: `Changed server region from ${prevRegion} to ${region}.`,
        changes: [
          {
            field: 'serverRegion',
            label: 'Server Region',
            before: prevRegion,
            after: region,
          },
        ],
        metadata: {
          previousRegion: prevRegion,
          newRegion: region,
        },
      });
    } catch (err) {
      console.error('[Settings] Failed to record server region activity:', err);
    }
  },

  showDbBuilder: false,
  setShowDbBuilder: (show, contextArg = 'system') => {
    const prevShow = Boolean(get().showDbBuilder);
    const nextShow = Boolean(show);
    if (prevShow === nextShow) return; // Suppress no-op

    set({ showDbBuilder: nextShow });

    try {
      const validSource = resolveSettingsSource(contextArg);
      recordActivity({
        category: 'settings_system',
        action: 'db_builder_toggled',
        source: validSource,
        entityType: 'setting',
        entityId: 'showDbBuilder',
        summary: nextShow ? 'Enabled Database Builder.' : 'Disabled Database Builder.',
        changes: [
          {
            field: 'showDbBuilder',
            label: 'Database Builder',
            before: prevShow,
            after: nextShow,
          },
        ],
        metadata: {
          enabled: nextShow,
        },
      });
    } catch (err) {
      console.error('[Settings] Failed to record db builder activity:', err);
    }
  },

  autoBackupEnabled: false,
  setAutoBackupEnabled: (val, contextArg = 'system') => {
    const prevVal = Boolean(get().autoBackupEnabled);
    const nextVal = Boolean(val);
    if (prevVal === nextVal) return; // Suppress no-op

    set({ autoBackupEnabled: nextVal });

    try {
      const validSource = resolveSettingsSource(contextArg);
      recordActivity({
        category: 'settings_system',
        action: 'auto_backup_toggled',
        source: validSource,
        entityType: 'setting',
        entityId: 'autoBackupEnabled',
        summary: nextVal ? 'Enabled automatic cloud backup.' : 'Disabled automatic cloud backup.',
        changes: [
          {
            field: 'autoBackupEnabled',
            label: 'Auto Backup',
            before: prevVal,
            after: nextVal,
          },
        ],
        metadata: {
          enabled: nextVal,
        },
      });
    } catch (err) {
      console.error('[Settings] Failed to record auto backup activity:', err);
    }
  },

  displayTimeZone: 'auto',
  setDisplayTimeZone: (zone, contextArg = 'system') => {
    const prevZone = get().displayTimeZone;
    if (prevZone === zone) return; // Suppress no-op

    set({ displayTimeZone: zone });

    try {
      const validSource = resolveSettingsSource(contextArg);
      recordActivity({
        category: 'settings_system',
        action: 'display_timezone_changed',
        source: validSource,
        entityType: 'setting',
        entityId: 'displayTimeZone',
        summary: `Changed display timezone from ${prevZone} to ${zone}.`,
        changes: [
          {
            field: 'displayTimeZone',
            label: 'Display Timezone',
            before: prevZone,
            after: zone,
          },
        ],
        metadata: {
          previousTimeZone: prevZone,
          newTimeZone: zone,
        },
      });
    } catch (err) {
      console.error('[Settings] Failed to record display timezone activity:', err);
    }
  },
});

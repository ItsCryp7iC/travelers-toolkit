export const STORE_NAME = 'travelers-toolkit-store';
export const STORE_VERSION = 5;

export const migrateStore = (persistedState, fromVersion) => {
  // v1 → v2: convert old string `equippedWeapon` fields into `trackedWeapons` entries
  if (fromVersion < 2) {
    const migrated = { ...persistedState }
    migrated.trackedWeapons = migrated.trackedWeapons ?? []
    const roster = migrated.roster ?? {}

    for (const [charName, entry] of Object.entries(roster)) {
      // Skip if already migrated or no legacy string weapon
      if (entry.equippedWeaponId || !entry.equippedWeapon) continue

      // Create a new tracked weapon from the legacy string
      const id = crypto.randomUUID()
      migrated.trackedWeapons.push({
        id,
        weaponName: entry.equippedWeapon,
        level: entry.weaponLevel ?? 1,
        ascension: entry.weaponAscension ?? 0,
        targetLevel: entry.targetWeaponLevel ?? 90,
        targetAscension: entry.targetWeaponAscension ?? 6,
        assignedTo: charName,
      })

      // Update the roster entry to use the new ID
      migrated.roster[charName] = {
        ...entry,
        equippedWeaponId: id,
        // Remove legacy flat fields
        equippedWeapon: undefined,
        weaponLevel: undefined,
        weaponAscension: undefined,
        targetWeaponLevel: undefined,
        targetWeaponAscension: undefined,
      }
    }
    persistedState = migrated
  }
  // v2 → v3: introduce craftQueue slice
  if (fromVersion < 3) {
    persistedState = { ...persistedState, craftQueue: persistedState.craftQueue ?? [] }
  }
  // v3 → v4: migrate to refinement tracking, remove craftQueue
  if (fromVersion < 4) {
    persistedState = { ...persistedState }
    delete persistedState.craftQueue
    if (persistedState.trackedWeapons) {
      persistedState.trackedWeapons = persistedState.trackedWeapons.map((w) => ({
        ...w,
        currentRefinement: w.currentRefinement ?? 1,
        targetRefinement: w.targetRefinement ?? 1,
      }))
    }
  }
  // v4 → v5: remove authentication/session properties from persisted state
  if (fromVersion < 5) {
    persistedState = { ...persistedState }
    delete persistedState.googleAccessToken
    delete persistedState.tokenExpiry
    delete persistedState.googleUser
    delete persistedState.hoyolabLtuid
    delete persistedState.hoyolabLtoken
  }
  return persistedState
}

export const partializeStore = (state) => ({
  roster: state.roster,
  trackedWeapons: state.trackedWeapons,
  inventory: state.inventory,
  goals: state.goals,
  resinCount: state.resinCount,
  resinTimestamp: state.resinTimestamp,
  serverRegion: state.serverRegion,
  showDbBuilder: state.showDbBuilder,
  autoBackupEnabled: state.autoBackupEnabled,
})

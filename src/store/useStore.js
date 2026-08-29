import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import charactersData from '../utils/characters'
import weaponsData from '../data/weapons.json'
import { calculateProgressionCost, calculateAllTalentsCost, calculateWeaponCost } from '../utils/calculator'

/**
 * Zustand global store for Traveler's Toolkit.
 *
 * Slices:
 *  - roster:          Characters the player is tracking { [charName]: { ... , equippedWeaponId } }
 *  - trackedWeapons:  Weapons in the armory [{ id, weaponName, level, ascension, targetLevel, targetAscension, assignedTo }]
 *  - inventory:       Materials the player has { [materialName]: quantity }
 *  - goals:           Progression targets
 *  - resin:           Resin tracker { resinCount, resinTimestamp }
 */
const useStore = create(
  persist(
    (set, get) => ({

      // ─── SETTINGS ──────────────────────────────────────────────────────
      serverRegion: 'Asia',
      setServerRegion: (region) => set({ serverRegion: region }),
      showDbBuilder: false,
      setShowDbBuilder: (show) => set({ showDbBuilder: show }),
      autoBackupEnabled: false,
      setAutoBackupEnabled: (val) => set({ autoBackupEnabled: val }),
      googleAccessToken: null,
      tokenExpiry: null,
      googleUser: null,
      setGoogleSession: (token, expiresIn, user = null) => set((state) => ({ 
        googleAccessToken: token, 
        tokenExpiry: Date.now() + expiresIn * 1000,
        googleUser: user || state.googleUser 
      })),
      clearGoogleSession: () => set({ googleAccessToken: null, tokenExpiry: null, googleUser: null }),
      importData: (data) => set({ ...data, trackedWeapons: data.trackedWeapons || [] }),
      importGoodData: (goodPayload) => set((state) => {
        // 1. Materials
        const newInventory = { ...state.inventory };
        Object.entries(goodPayload.materials || {}).forEach(([matKey, qty]) => {
          newInventory[matKey] = qty; 
        });

        // 2. Roster
        const newRoster = { ...state.roster };
        (goodPayload.characters || []).forEach(char => {
          const existing = newRoster[char.name] || {
            targetLevel: 90,
            targetAscension: 6,
            targetTalents: { normal: 10, skill: 10, burst: 10 },
            equippedWeaponId: null,
            tracked: true,
            calculatedCosts: null
          };
          
          newRoster[char.name] = {
            ...existing,
            level: char.level,
            ascension: char.ascension,
            talents: char.talents,
            // STRICT RULE: preserve existing target properties
            targetLevel: existing.targetLevel,
            targetAscension: existing.targetAscension,
            targetTalents: existing.targetTalents,
          };
          
          const charData = charactersData.find(c => c.name === char.name);
          if (charData) {
             const ascCosts = calculateProgressionCost(charData, newRoster[char.name].level || 1, newRoster[char.name].targetLevel || 90, newRoster[char.name].ascension ?? 0, newRoster[char.name].targetAscension ?? 6);
             const talentCosts = calculateAllTalentsCost(charData, {
                auto: { current: newRoster[char.name].talents?.normal || 1, target: newRoster[char.name].targetTalents?.normal || 10 },
                skill: { current: newRoster[char.name].talents?.skill || 1, target: newRoster[char.name].targetTalents?.skill || 10 },
                burst: { current: newRoster[char.name].talents?.burst || 1, target: newRoster[char.name].targetTalents?.burst || 10 }
             });
             newRoster[char.name].calculatedCosts = { ascCosts, talentCosts };
          }
        });

        // 3. Weapons
        let newWeapons = [];
        (goodPayload.weapons || []).forEach(w => {
           // Attempt to preserve target levels for weapons by matching name and assignment
           const existing = state.trackedWeapons.find(ew => ew.weaponName === w.weaponName && ew.assignedTo === w.location);
           const id = existing ? existing.id : crypto.randomUUID();
           const newWeapon = {
             id,
             weapon_id: w.weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
             weaponName: w.weaponName,
             level: w.level,
             ascension: w.ascension,
             targetLevel: existing?.targetLevel ?? 90,
             targetAscension: existing?.targetAscension ?? 6,
             assignedTo: w.location || null,
             createdAt: existing?.createdAt ?? Date.now()
           };

           // Calculate weapon costs if possible
           const wData = weaponsData.find(wd => wd.name === newWeapon.weaponName);
           if (wData) {
             newWeapon.costs = calculateWeaponCost(
                wData, 
                newWeapon.level, 
                newWeapon.targetLevel, 
                newWeapon.ascension, 
                newWeapon.targetAscension, 
                newWeapon.hasEventBonus, 
                Object.values(newRoster)
             );
           }
           
           newWeapons.push(newWeapon);
           
           if (w.location && newRoster[w.location]) {
             newRoster[w.location].equippedWeaponId = id;
           }
        });

        return {
          inventory: newInventory,
          roster: newRoster,
          trackedWeapons: newWeapons,
        };
      }),
      resetStore: () => {
        set({
          roster: {},
          trackedWeapons: [],
          inventory: {},
          goals: [],
          resinCount: 200,
          resinTimestamp: Date.now(),
          serverRegion: 'Asia',
          showDbBuilder: false,
          autoBackupEnabled: false,
          googleAccessToken: null,
          tokenExpiry: null,
          googleUser: null,
        })
      },

      // ─── RESIN ─────────────────────────────────────────────────────────
      resinCount: 200,
      resinTimestamp: Date.now(),

      setResin: (amount) => set({
        resinCount: Math.min(200, Math.max(0, amount)),
        resinTimestamp: Date.now(),
      }),

      // ─── ROSTER ────────────────────────────────────────────────────────
      roster: {},

      addCharacter: (name) =>
        set((state) => {
          if (state.roster[name]) return state // already exists, no-op
          return {
            roster: {
              ...state.roster,
              [name]: {
                level: 1,
                ascension: 0,
                targetLevel: 90,
                targetAscension: 6,
                talents:       { normal: 1, skill: 1, burst: 1 },
                targetTalents: { normal: 10, skill: 10, burst: 10 },
                equippedWeaponId: null, // references trackedWeapons[].id
                tracked: true,
                calculatedCosts: null
              },
            },
          }
        }),

      batchAddCharacters: (namesArray) =>
        set((state) => {
          let hasChanges = false
          const newRoster = { ...state.roster }
          
          namesArray.forEach((name) => {
            if (!newRoster[name]) {
              newRoster[name] = {
                level: 1,
                ascension: 0,
                targetLevel: 90,
                targetAscension: 6,
                talents:       { normal: 1, skill: 1, burst: 1 },
                targetTalents: { normal: 10, skill: 10, burst: 10 },
                equippedWeaponId: null,
                tracked: true,
                calculatedCosts: null
              }
              hasChanges = true
            }
          })
          
          if (!hasChanges) return state
          return { roster: newRoster }
        }),

      removeCharacter: (name) =>
        set((state) => {
          const next = { ...state.roster }
          const entry = next[name]
          delete next[name]
          // Unassign any weapon that was pointing to this character
          const updatedWeapons = state.trackedWeapons.map((w) =>
            w.assignedTo === name ? { ...w, assignedTo: null } : w
          )
          return { roster: next, trackedWeapons: updatedWeapons }
        }),

      batchRemoveCharacters: (names) =>
        set((state) => {
          const next = { ...state.roster }
          names.forEach(name => delete next[name])
          
          // Unassign any weapon that was pointing to any of these characters
          const updatedWeapons = state.trackedWeapons.map((w) =>
            names.includes(w.assignedTo) ? { ...w, assignedTo: null } : w
          )
          return { roster: next, trackedWeapons: updatedWeapons }
        }),

      updateCharacter: (name, patch) =>
        set((state) => {
          const charEntry = { ...state.roster[name], ...patch }
          const charData = charactersData.find(c => c.name === name)
          if (charData) {
            const ascCosts = calculateProgressionCost(charData, charEntry.level || 1, charEntry.targetLevel || 90, charEntry.ascension ?? 0, charEntry.targetAscension ?? 6)
            const talentCosts = calculateAllTalentsCost(charData, {
              auto: { current: charEntry.talents?.normal || 1, target: charEntry.targetTalents?.normal || 10 },
              skill: { current: charEntry.talents?.skill || 1, target: charEntry.targetTalents?.skill || 10 },
              burst: { current: charEntry.talents?.burst || 1, target: charEntry.targetTalents?.burst || 10 }
            })
            charEntry.calculatedCosts = { ascCosts, talentCosts }
          }
          return {
            roster: {
              ...state.roster,
              [name]: charEntry,
            },
          }
        }),

      bulkUpdateCharacters: (identifiers, patch) =>
        set((state) => {
          const newRoster = { ...state.roster }
          let hasChanges = false
          identifiers.forEach((name) => {
            if (newRoster[name]) {
              const updatedEntry = { ...newRoster[name], ...patch }
              
              // Recalculate costs per user request
              const charData = charactersData.find(c => c.name === name)
              if (charData) {
                const ascCosts = calculateProgressionCost(charData, updatedEntry.level || 1, updatedEntry.targetLevel || 90, updatedEntry.ascension ?? 0, updatedEntry.targetAscension ?? 6)
                const talentCosts = calculateAllTalentsCost(charData, {
                  auto: { current: updatedEntry.talents?.normal || 1, target: updatedEntry.targetTalents?.normal || 10 },
                  skill: { current: updatedEntry.talents?.skill || 1, target: updatedEntry.targetTalents?.skill || 10 },
                  burst: { current: updatedEntry.talents?.burst || 1, target: updatedEntry.targetTalents?.burst || 10 }
                })
                updatedEntry.costs = { ascCosts, talentCosts }
              }
              
              newRoster[name] = updatedEntry
              hasChanges = true
            }
          })
          if (!hasChanges) return state
          return { roster: newRoster }
        }),

      isInRoster: (name) => Boolean(get().roster[name]),

      // ─── TRACKED WEAPONS (ARMORY) ──────────────────────────────────────
      trackedWeapons: [],

      addTrackedWeapon: (weaponName, assignedTo = null, config = {}) => {
        // Generate the ID outside set() so we can return it to the caller
        const id = crypto.randomUUID()
        const newWeapon = {
          id,
          weapon_id: weaponName.toLowerCase().replace(/[^a-z0-9]/g, ''),
          weaponName,
          level: config.currentLevel ?? 1,
          ascension: config.currentAscension ?? 0,
          targetLevel: config.targetLevel ?? 90,
          targetAscension: config.targetAscension ?? 6,
          assignedTo,
          createdAt: Date.now(),
        }
        set((state) => {
          let updatedRoster = state.roster
          if (assignedTo && state.roster[assignedTo]) {
            // Unassign the old weapon first
            const oldId = state.roster[assignedTo].equippedWeaponId
            const updatedWeapons = state.trackedWeapons.map((w) =>
              w.id === oldId ? { ...w, assignedTo: null } : w
            )
            updatedRoster = {
              ...state.roster,
              [assignedTo]: { ...state.roster[assignedTo], equippedWeaponId: id },
            }
            return { trackedWeapons: [...updatedWeapons, newWeapon], roster: updatedRoster }
          }
          return { trackedWeapons: [...state.trackedWeapons, newWeapon] }
        })
        return id // ← caller can use this to update local draft state
      },

      removeTrackedWeapon: (id) =>
        set((state) => {
          const weapon = state.trackedWeapons.find((w) => w.id === id)
          let updatedRoster = state.roster
          if (weapon?.assignedTo && state.roster[weapon.assignedTo]) {
            updatedRoster = {
              ...state.roster,
              [weapon.assignedTo]: {
                ...state.roster[weapon.assignedTo],
                equippedWeaponId: null,
              },
            }
          }
          return {
            trackedWeapons: state.trackedWeapons.filter((w) => w.id !== id),
            roster: updatedRoster,
          }
        }),

      batchRemoveWeapons: (ids) =>
        set((state) => {
          let updatedRoster = { ...state.roster }
          
          ids.forEach(id => {
            const weapon = state.trackedWeapons.find(w => w.id === id)
            if (weapon?.assignedTo && updatedRoster[weapon.assignedTo]) {
              updatedRoster[weapon.assignedTo] = {
                ...updatedRoster[weapon.assignedTo],
                equippedWeaponId: null,
              }
            }
          })
          
          return {
            trackedWeapons: state.trackedWeapons.filter((w) => !ids.includes(w.id)),
            roster: updatedRoster,
          }
        }),

      updateTrackedWeapon: (id, patch) =>
        set((state) => ({
          trackedWeapons: state.trackedWeapons.map((w) =>
            w.id === id ? { ...w, ...patch } : w
          ),
        })),

      bulkUpdateWeapons: (identifiersOrPayloads, patch) =>
        set((state) => {
          const isPayloads = Array.isArray(identifiersOrPayloads) && identifiersOrPayloads.length > 0 && typeof identifiersOrPayloads[0] === 'object';
          
          let updatedRoster = { ...state.roster };
          
          const unassignFromChar = (charName) => {
             if (charName && updatedRoster[charName]) {
                 updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: null };
             }
          }

          const assignToChar = (charName, weaponId) => {
             if (charName && updatedRoster[charName]) {
                 updatedRoster[charName] = { ...updatedRoster[charName], equippedWeaponId: weaponId };
             }
          }

          const payloadsMap = isPayloads ? 
            identifiersOrPayloads.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) : 
            null;

          const updatedArmory = state.trackedWeapons.map(weapon => {
            const isMatch = isPayloads ? payloadsMap[weapon.id] : (identifiersOrPayloads.includes(weapon.id) || identifiersOrPayloads.includes(weapon.weaponName));
            
            if (isMatch) {
              const currentPatch = isPayloads ? payloadsMap[weapon.id] : patch;
              const updatedWeapon = { ...weapon, ...currentPatch };
              
              if ('assignedTo' in currentPatch && currentPatch.assignedTo !== weapon.assignedTo) {
                 unassignFromChar(weapon.assignedTo);
                 if (currentPatch.assignedTo && updatedRoster[currentPatch.assignedTo]?.equippedWeaponId) {
                     // The character already has a weapon; we will unassign it in the second pass
                 }
                 assignToChar(currentPatch.assignedTo, weapon.id);
              }

              const wData = weaponsData.find(w => w.name === updatedWeapon.weaponName);
              if (wData) {
                const newCosts = calculateWeaponCost(
                  wData, 
                  updatedWeapon.level || 1, 
                  updatedWeapon.targetLevel || 90, 
                  updatedWeapon.ascension || 0, 
                  updatedWeapon.targetAscension || 6, 
                  updatedWeapon.hasEventBonus, 
                  Object.values(state.roster)
                );
                return { ...updatedWeapon, costs: newCosts };
              }
              return updatedWeapon;
            }
            return weapon;
          });
          
          // Second pass: unassign weapons that were replaced
          const currentlyEquippedWeaponIds = Object.values(updatedRoster).map(c => c.equippedWeaponId).filter(Boolean);
          const finalArmory = updatedArmory.map(w => {
             if (w.assignedTo && !currentlyEquippedWeaponIds.includes(w.id)) {
                 return { ...w, assignedTo: null };
             }
             return w;
          });

          return { trackedWeapons: finalArmory, roster: updatedRoster };
        }),

      assignWeaponToCharacter: (weaponId, charName) =>
        set((state) => {
          let updatedWeapons = state.trackedWeapons
          let updatedRoster = { ...state.roster }

          // Unassign old weapon currently on this character
          const charEntry = updatedRoster[charName]
          if (charEntry?.equippedWeaponId && charEntry.equippedWeaponId !== weaponId) {
            updatedWeapons = updatedWeapons.map((w) =>
              w.id === charEntry.equippedWeaponId ? { ...w, assignedTo: null } : w
            )
          }

          // Unassign this weapon from any previous character
          const weapon = updatedWeapons.find((w) => w.id === weaponId)
          if (weapon?.assignedTo && weapon.assignedTo !== charName) {
            updatedRoster = {
              ...updatedRoster,
              [weapon.assignedTo]: { ...updatedRoster[weapon.assignedTo], equippedWeaponId: null },
            }
          }

          // Assign the weapon to the character
          updatedWeapons = updatedWeapons.map((w) =>
            w.id === weaponId ? { ...w, assignedTo: charName } : w
          )
          updatedRoster = {
            ...updatedRoster,
            [charName]: { ...updatedRoster[charName], equippedWeaponId: weaponId },
          }

          return { trackedWeapons: updatedWeapons, roster: updatedRoster }
        }),

      unassignWeapon: (weaponId) =>
        set((state) => {
          const weapon = state.trackedWeapons.find((w) => w.id === weaponId)
          let updatedRoster = state.roster
          if (weapon?.assignedTo && state.roster[weapon.assignedTo]) {
            updatedRoster = {
              ...state.roster,
              [weapon.assignedTo]: { ...state.roster[weapon.assignedTo], equippedWeaponId: null },
            }
          }
          return {
            trackedWeapons: state.trackedWeapons.map((w) =>
              w.id === weaponId ? { ...w, assignedTo: null } : w
            ),
            roster: updatedRoster,
          }
        }),

      // ─── INVENTORY ─────────────────────────────────────────────────────
      inventory: {},

      setInventory: (materialName, qty) =>
        set((state) => ({
          inventory: { ...state.inventory, [materialName]: Math.max(0, qty) },
        })),

      incrementInventory: (materialName, amount = 1) =>
        set((state) => ({
          inventory: {
            ...state.inventory,
            [materialName]: (state.inventory[materialName] || 0) + amount,
          },
        })),

      // ─── GOALS ─────────────────────────────────────────────────────────
      goals: [],

      addGoal: (goal) =>
        set((state) => ({
          goals: [...state.goals.filter((g) => g.charName !== goal.charName), goal],
        })),

      removeGoal: (charName) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.charName !== charName),
        })),

      // ─── COMPUTED HELPERS ───────────────────────────────────────────────
      getRosterCount: () => Object.keys(get().roster).length,
      getFiveStarCount: (characters) =>
        Object.keys(get().roster).filter(
          (name) => characters.find((c) => c.name === name)?.rarity === 5
        ).length,
    }),
    {
      name: 'travelers-toolkit-store',
      version: 2, // bump if you need another migration
      migrate: (persistedState, fromVersion) => {
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
          return migrated
        }
        return persistedState
      },
      partialize: (state) => ({
        roster: state.roster,
        trackedWeapons: state.trackedWeapons,
        inventory: state.inventory,
        goals: state.goals,
        resinCount: state.resinCount,
        resinTimestamp: state.resinTimestamp,
        serverRegion: state.serverRegion,
        showDbBuilder: state.showDbBuilder,
        autoBackupEnabled: state.autoBackupEnabled,
        googleAccessToken: state.googleAccessToken,
        tokenExpiry: state.tokenExpiry,
        googleUser: state.googleUser,
      }),
    }
  )
)


export default useStore

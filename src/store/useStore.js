import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Zustand global store for Traveler's Toolkit.
 *
 * Slices:
 *  - roster:    Characters the player is tracking { [charName]: { level, ascension, talents, tracked } }
 *  - inventory: Materials the player has { [materialName]: quantity }
 *  - goals:     Progression targets [{ charName, targetLevel, targetAscension }]
 */
const useStore = create(
  persist(
    (set, get) => ({
      // ─── ROSTER ────────────────────────────────────────────────────────
      roster: {},

      addCharacter: (name) =>
        set((state) => ({
          roster: {
            ...state.roster,
            [name]: {
              level: 1,
              ascension: 0,
              targetLevel: 90,
              targetAscension: 6,
              talents:       { normal: 1, skill: 1, burst: 1 },
              targetTalents: { normal: 1, skill: 1, burst: 1 },
              equippedWeapon: null,
              weaponLevel: 1,
              weaponAscension: 0,
              targetWeaponLevel: 90,
              targetWeaponAscension: 6,
              tracked: true,
            },
          },
        })),

      removeCharacter: (name) =>
        set((state) => {
          const next = { ...state.roster }
          delete next[name]
          return { roster: next }
        }),

      updateCharacter: (name, patch) =>
        set((state) => ({
          roster: {
            ...state.roster,
            [name]: { ...state.roster[name], ...patch },
          },
        })),

      isInRoster: (name) => Boolean(get().roster[name]),

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
      name: 'travelers-toolkit-store', // localStorage key
      partialize: (state) => ({
        roster: state.roster,
        inventory: state.inventory,
        goals: state.goals,
      }),
    }
  )
)

export default useStore

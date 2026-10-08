# HoYoLAB Character Sync - Phase C Recommendation

## Goal

Phase C will involve taking the output of the reconciliation engine (built in Phase B) and applying the differences to the local user's roster and tracked weapons, safely persisting those changes.

## Phase C Recommended Strategy (Apply Mutation)

1. **User Interface / Interaction**
   - In the `HoyolabSyncPreviewModal`, add interactive elements (e.g., checkboxes) next to each character that has differences (`status: "new"`, `status: "update"`).
   - Allow the user to "Select All" or cherry-pick specific character updates to apply.
   - For weapon conflicts/ambiguities, provide a small dropdown inline to let the user select how to resolve it (e.g., "Create New", "Attach to Unassigned Staff of Homa", "Leave As Is").

2. **Zustand Mutation Handlers**
   - Introduce a new action in `src/store/slices/rosterSlice.js`: `applyHoyolabSync(updates)`.
   - `updates` will be an array of instructions generated from the UI selection.
   - For `new` characters: call `addCharacter()` and immediately apply the levels, ascension, and talents.
   - For `update` characters: call `updateCharacter()` with the parsed level/ascension/talent patches.

3. **Weapon Handling**
   - New weapons (`status: "would-create"`): use `addTrackedWeapon()` and assign the newly generated ID to the character's `equippedWeaponId`.
   - Re-assigned weapons (`status: "ambiguous"` or `"suggested-instance"`): call `updateTrackedWeapon(id, { assignedTo: rosterKey })`.
   - Mismatched equipment (`status: "equipment-mismatch"`): depending on user choice, either detach the old weapon, create a new one, or leave the old one intact.

4. **Safety and Fallbacks**
   - The reconciliation engine already ensures impossible progression states (`status: "conflict"`) are caught. These should **not** be selectable in the UI.
   - Unknown mappings (`status: "unmapped"`) should also remain disabled.
   - Changes must trigger a save to persistence. The current store architecture will automatically handle this when Zustand state mutates.

## strict Enforcement of Phase B (Read-Only)
Phase B is purely visual and analytical.
- The modal only calls a `GET` (or idempotent `POST` for fetching from HoYoLAB) endpoint.
- It parses the response.
- It compares the data against the local store.
- **Crucially**, it never calls any `set()` functions in Zustand, meaning no local data is overwritten, no weapons are created, and no persistence mechanisms are invoked.

This separation ensures the user can securely observe exactly what HoYoLAB returns before we build out the destructive UI logic in Phase C.

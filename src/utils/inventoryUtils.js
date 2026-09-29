export function getOwnedQty(inventory, canonicalId) {
  if (!inventory || !canonicalId) return 0;
  if (inventory[canonicalId] !== undefined) return inventory[canonicalId];

  // legacy alias fallback
  const legacyId = canonicalId
    .replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    .replace(/^_/, "")
    .replace(/ /g, "_")
    .replace(/'/g, "")
    .toLowerCase();

  if (inventory[legacyId] !== undefined) return inventory[legacyId];
  return 0;
}

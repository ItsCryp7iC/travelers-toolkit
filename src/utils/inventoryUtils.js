export function getOwnedQty(inventory, canonicalId) {
  if (!inventory || !canonicalId) return 0;
  if (inventory[canonicalId] !== undefined) return inventory[canonicalId];

  // Specific alias fallbacks for enhancement ores
  if (canonicalId === 'FineEnhancementOre' && inventory['fine_ore'] !== undefined) return inventory['fine_ore'];
  if (canonicalId === 'EnhancementOre') {
    if (inventory['normal_ore'] !== undefined) return inventory['normal_ore'];
    if (inventory['enhancement_ore'] !== undefined) return inventory['enhancement_ore'];
  }
  if (canonicalId === 'MysticEnhancementOre' && inventory['mystic_ore'] !== undefined) return inventory['mystic_ore'];

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

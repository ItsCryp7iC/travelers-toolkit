export function getTravelerAwareWeaponId(charName, rosterEntry, trackedWeapons) {
  if (!charName || !charName.startsWith('Traveler ')) {
    return rosterEntry?.equippedWeaponId || null;
  }
  const travelerWeapon = trackedWeapons.find(w => w.assignedTo && w.assignedTo.startsWith('Traveler '));
  return travelerWeapon ? travelerWeapon.id : null;
}

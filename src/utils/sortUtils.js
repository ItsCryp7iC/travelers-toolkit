export function compareNullableNumber(valA, valB, direction) {
  const aMissing = valA == null || valA === '';
  const bMissing = valB == null || valB === '';

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const numA = parseFloat(valA);
  const numB = parseFloat(valB);

  const comp = numA - numB;
  return direction === 'asc' ? comp : -comp;
}

export function compareNullableString(valA, valB, direction) {
  const aMissing = valA == null || valA === '';
  const bMissing = valB == null || valB === '';

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const strA = String(valA);
  const strB = String(valB);

  const comp = strA.localeCompare(strB);
  return direction === 'asc' ? comp : -comp;
}

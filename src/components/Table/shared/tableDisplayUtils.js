export const getRarityColorClass = (rarity) => {
  const r = Number(rarity) || rarity;
  if (r === 5 || r === '5*' || r === '★★★★★') return 'text-amber-400 font-semibold';
  if (r === 4 || r === '4*' || r === '★★★★') return 'text-purple-400 font-semibold';
  if (r === 3 || r === '3*' || r === '★★★') return 'text-blue-400';
  if (r === 2 || r === '2*' || r === '★★') return 'text-green-400';
  return 'text-gray-400';
};

export const isAscended = (level, ascension) => {
  if (level === 20 && ascension >= 1) return true;
  if (level === 40 && ascension >= 2) return true;
  if (level === 50 && ascension >= 3) return true;
  if (level === 60 && ascension >= 4) return true;
  if (level === 70 && ascension >= 5) return true;
  if (level === 80 && ascension >= 6) return true;
  if (level === 90 && ascension >= 6) return true;
  return false;
};

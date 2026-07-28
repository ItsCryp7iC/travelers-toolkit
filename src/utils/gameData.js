/**
 * Element configuration — colors, gradients, emojis, and display names
 */
export const ELEMENTS = {
  Anemo: {
    name: 'Anemo',
    emoji: '🌪️',
    color: '#4EC9B0',
    colorDim: 'rgba(78,201,176,0.15)',
    gradient: 'linear-gradient(145deg, #1a3d38 0%, #0d1f1d 100%)',
    avatarGradient: 'linear-gradient(145deg, #2d6b62, #1a3d38)',
    glow: 'rgba(78,201,176,0.25)',
  },
  Geo: {
    name: 'Geo',
    emoji: '⛰️',
    color: '#FAB632',
    colorDim: 'rgba(250,182,50,0.15)',
    gradient: 'linear-gradient(145deg, #3d3010 0%, #1f1a06 100%)',
    avatarGradient: 'linear-gradient(145deg, #8B6914, #5a4209)',
    glow: 'rgba(250,182,50,0.25)',
  },
  Electro: {
    name: 'Electro',
    emoji: '⚡',
    color: '#A855F7',
    colorDim: 'rgba(168,85,247,0.15)',
    gradient: 'linear-gradient(145deg, #2a1040 0%, #150820 100%)',
    avatarGradient: 'linear-gradient(145deg, #6B21A8, #3B0764)',
    glow: 'rgba(168,85,247,0.25)',
  },
  Dendro: {
    name: 'Dendro',
    emoji: '🌿',
    color: '#4ADE80',
    colorDim: 'rgba(74,222,128,0.15)',
    gradient: 'linear-gradient(145deg, #0f3020 0%, #071810 100%)',
    avatarGradient: 'linear-gradient(145deg, #166534, #052e16)',
    glow: 'rgba(74,222,128,0.25)',
  },
  Hydro: {
    name: 'Hydro',
    emoji: '💧',
    color: '#60A5FA',
    colorDim: 'rgba(96,165,250,0.15)',
    gradient: 'linear-gradient(145deg, #0f2540 0%, #071220 100%)',
    avatarGradient: 'linear-gradient(145deg, #1D4ED8, #1e3a8a)',
    glow: 'rgba(96,165,250,0.25)',
  },
  Pyro: {
    name: 'Pyro',
    emoji: '🔥',
    color: '#F97316',
    colorDim: 'rgba(249,115,22,0.15)',
    gradient: 'linear-gradient(145deg, #3d1408 0%, #1f0a04 100%)',
    avatarGradient: 'linear-gradient(145deg, #C2410C, #7C2D12)',
    glow: 'rgba(249,115,22,0.25)',
  },
  Cryo: {
    name: 'Cryo',
    emoji: '❄️',
    color: '#BAE6FD',
    colorDim: 'rgba(186,230,253,0.15)',
    gradient: 'linear-gradient(145deg, #0c2a40 0%, #061520 100%)',
    avatarGradient: 'linear-gradient(145deg, #0284C7, #075985)',
    glow: 'rgba(186,230,253,0.25)',
  },
  Unknown: {
    name: 'Unknown',
    emoji: '✨',
    color: '#C8A96E',
    colorDim: 'rgba(200,169,110,0.15)',
    gradient: 'linear-gradient(145deg, #2a2010 0%, #15100a 100%)',
    avatarGradient: 'linear-gradient(145deg, #78501A, #3D2800)',
    glow: 'rgba(200,169,110,0.25)',
  },
}

export const WEAPON_TYPES = {
  Sword:    { emoji: '⚔️',  label: 'Sword' },
  Claymore: { emoji: '🗡️', label: 'Claymore' },
  Polearm:  { emoji: '🔱',  label: 'Polearm' },
  Bow:      { emoji: '🏹',  label: 'Bow' },
  Catalyst: { emoji: '📖',  label: 'Catalyst' },
}

/**
 * Format a CamelCase or PascalCase name into spaced words.
 * "TravelerAnemo" → "Traveler Anemo"
 * "HuTao" → "Hu Tao"
 */
export function formatName(name) {
  // Insert spaces before uppercase letters that follow lowercase letters
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

/**
 * Get initials for the avatar (first letter of each word, max 2)
 */
export function getInitials(name) {
  const formatted = formatName(name)
  const words = formatted.split(' ')
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Render star string for a given rarity
 */
export function getStars(rarity) {
  return '★'.repeat(rarity)
}

/**
 * Get rarity CSS class
 */
export function getRarityClass(rarity) {
  return `stars-${Math.min(Math.max(rarity, 1), 5)}`
}

export const RARITY_COLORS = {
  5: '#FFB13F', // Gold/Orange
  4: '#B07FE8', // Purple
  3: '#4EC9B0', // Blue/Teal
  2: '#4ADE80', // Green
  1: '#9CA3AF'  // Gray
}

/**
 * Utility to parse Genshin Open Object Description (GOOD) format.
 * https://github.com/frzyc/genshin-optimizer/blob/master/pipeline/Data/GOOD/GOOD.md
 */

// Mapping specific GOOD format character names to our internal display names if needed
const characterNameMap = {
  'RaidenShogun': 'Raiden Shogun',
  'HuTao': 'Hu Tao',
  'YaeMiko': 'Yae Miko',
  'KukiShinobu': 'Kuki Shinobu',
  'ShikanoinHeizou': 'Shikanoin Heizou',
  'KaedeharaKazuha': 'Kaedehara Kazuha',
  'SangonomiyaKokomi': 'Sangonomiya Kokomi',
  'AratakiItto': 'Arataki Itto',
  'KamisatoAyaka': 'Kamisato Ayaka',
  'KamisatoAyato': 'Kamisato Ayato',
  'KujouSara': 'Kujou Sara',
  'Yanfei': 'Yanfei',
  'YunJin': 'Yun Jin',
  'Tartaglia': 'Tartaglia', 
};

// Formats PascalCase GOOD name to Space Separated
const formatCharacterName = (goodName) => {
  if (characterNameMap[goodName]) return characterNameMap[goodName];
  // E.g., "TravelerAnemo" -> "Traveler Anemo", "Mona" -> "Mona"
  return goodName.replace(/([a-z])([A-Z])/g, '$1 $2');
};



export const parseGoodData = (jsonContent) => {
  if (!jsonContent || jsonContent.format !== "GOOD") {
    throw new Error("Invalid GOOD format");
  }

  const parsed = {
    characters: [],
    weapons: [],
    materials: {},
  };

  // Parse Characters
  if (Array.isArray(jsonContent.characters)) {
    parsed.characters = jsonContent.characters.map((char) => ({
      name: formatCharacterName(char.key),
      level: char.level,
      ascension: char.ascension,
      talents: {
        normal: char.talent?.auto || 1,
        skill: char.talent?.skill || 1,
        burst: char.talent?.burst || 1,
      }
    }));
  }

  // Parse Weapons
  if (Array.isArray(jsonContent.weapons)) {
    parsed.weapons = jsonContent.weapons.map((weapon) => ({
      weaponName: formatCharacterName(weapon.key), // Using same formatter since weapon names are also PascalCase
      level: weapon.level,
      ascension: weapon.ascension,
      refinement: weapon.refinement,
      location: weapon.location ? formatCharacterName(weapon.location) : null,
    }));
  }

  // Parse Materials
  if (jsonContent.materials && typeof jsonContent.materials === 'object') {
    Object.entries(jsonContent.materials).forEach(([goodKey, count]) => {
      parsed.materials[goodKey] = count;
    });
  }

  return parsed;
};

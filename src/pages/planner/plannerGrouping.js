import { getJsonData } from '../../utils/resolver';
import weeklyBossData from '../../data/weekly_boss.json';
import weaponsData from '../../data/weapons.json';
import characterGemsData from '../../data/character_gems.json';
import normalBossData from '../../data/normal_boss.json';
import eliteEnemyData from '../../data/elite_enemy.json';
import commonEnemyData from '../../data/common_enemy.json';
import localSpecialtyData from '../../data/local_specialty.json';

export const REGION_ORDER = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai', 'Snezhnaya'];

export const getScheduleWeight = (familyData) => {
  if (familyData?.days?.length) return Math.min(...familyData.days);
  return 99;
};

export const getNeededBy = ({ matKey, type, totals, trackedWeapons }) => {
  const needed = [];
  if (['talent', 'weekly_boss', 'gemstones', 'world_boss', 'elite_mob', 'mob', 'local_specialty', 'weapon'].includes(type)) {
    totals.breakdown.forEach(b => {
      if (b.totalCosts[matKey] > 0) {
        const isWeaponBreakdown = !b.character && weaponsData.some(w => w.name === b.name);
        const entityType = isWeaponBreakdown ? 'weapon' : 'character';
        const entityIcon = b.character?.id || b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        needed.push({ name: b.name, icon: entityIcon, type: entityType });
      }
    });
  }

  if (['weapon_ascension', 'weapon', 'elite_mob', 'mob'].includes(type)) {
    trackedWeapons.forEach(w => {
      if (w.ascension === w.targetAscension && w.level >= w.targetLevel) return;
      const wData = weaponsData.find(wd => wd.name === w.weaponName);
      if (wData && wData.materials) {
        let family = null;
        if (type === 'weapon_ascension' || type === 'weapon') family = wData.materials.ascension_material_family_id;
        if (type === 'elite_mob') family = wData.materials.elite_enemy_material_family_id;
        if (type === 'mob') family = wData.materials.common_enemy_material_family_id;

        const matFamilyData = getJsonData(matKey);

        if (matFamilyData && matFamilyData.familyId) {
          if (family && matFamilyData.familyId.toLowerCase().includes(family.toLowerCase())) {
            needed.push({ name: w.weaponName, icon: w.weapon_id, type: 'weapon' });
          }
        } else {
          // Fallback
          const normalizedMatKey = matKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (family && normalizedMatKey.includes(family.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            needed.push({ name: w.weaponName, icon: w.weapon_id, type: 'weapon' });
          }
        }
      }
    });
  }
  return needed.filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i);
};

export const groupTalentBooks = (talentBooks, totals, trackedWeapons) => {
  const groups = {}; // Region -> Domain -> FamilyName -> FamilyObj
  const allBooks = talentBooks || [];

  allBooks.forEach(item => {
    const familyData = getJsonData(item.name);
    if (!familyData) return;

    const region = familyData.region;
    const domainName = familyData.domain || 'Unknown Domain';
    const familyName = familyData.familyName;

    if (!groups[region]) groups[region] = {};
    if (!groups[region][domainName]) groups[region][domainName] = {};
    if (!groups[region][domainName][familyName]) {
      groups[region][domainName][familyName] = {
        familyName,
        familyData,
        type: 'talent',
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'talent', totals, trackedWeapons });

    groups[region][domainName][familyName].items[item.name] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[region][domainName][familyName].neededBy.find(e => e.name === entity.name)) {
        groups[region][domainName][familyName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupWeaponAscensionMaterials = (weaponAscMats, totals, trackedWeapons) => {
  const groups = {};
  const allWeaponMats = weaponAscMats || [];

  allWeaponMats.forEach(item => {
    const familyData = getJsonData(item.name);
    if (!familyData) return;

    const region = familyData.region;
    const domainName = familyData.domain || 'Unknown Domain';
    const familyName = familyData.familyName;

    if (!groups[region]) groups[region] = {};
    if (!groups[region][domainName]) groups[region][domainName] = {};
    if (!groups[region][domainName][familyName]) {
      groups[region][domainName][familyName] = {
        familyName,
        familyData,
        type: 'weapon',
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'weapon', totals, trackedWeapons });

    groups[region][domainName][familyName].items[item.name] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[region][domainName][familyName].neededBy.find(e => e.name === entity.name)) {
        groups[region][domainName][familyName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupGemstones = (gemstones, totals, trackedWeapons) => {
  const groups = {};
  const allGems = gemstones || [];

  allGems.forEach(item => {
    const rawName = item.name.toLowerCase();
    const prefixMatch = rawName.match(/^(.*?)(sliver|fragment|chunk|gemstone)$/);
    if (!prefixMatch) return;

    const prefix = prefixMatch[1];
    const cleanName = prefix.replace(/_+/g, ' ').trim();
    const formattedFamilyName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
    const baseKey = formattedFamilyName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!groups[baseKey]) {
      const jsonEntry = characterGemsData.find(g => g.id === baseKey);
      let jsonSortOrder = 999;
      if (jsonEntry && jsonEntry.tiers) {
        jsonSortOrder = Math.min(...Object.values(jsonEntry.tiers).map(t => t.sortOrder || 999));
      }

      groups[baseKey] = {
        familyName: formattedFamilyName,
        familyKey: baseKey,
        jsonSortOrder,
        type: 'gemstones',
        familyData: {
          tiers: [
            { id: `${prefix}sliver`, name: `${formattedFamilyName} Sliver`, rarity: 1 },
            { id: `${prefix}fragment`, name: `${formattedFamilyName} Fragment`, rarity: 2 },
            { id: `${prefix}chunk`, name: `${formattedFamilyName} Chunk`, rarity: 3 },
            { id: `${prefix}gemstone`, name: `${formattedFamilyName} Gemstone`, rarity: 4 }
          ]
        },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'gemstones', totals, trackedWeapons });

    groups[baseKey].items[item.name] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[baseKey].neededBy.find(e => e.name === entity.name)) {
        groups[baseKey].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupWeeklyBosses = (weeklyBoss, totals, trackedWeapons) => {
  const groups = {};
  const weeklyNeeded = weeklyBoss || [];

  weeklyNeeded.forEach(item => {
    const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bossData = weeklyBossData.find(b => b.id === normalizedKey || b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

    if (!bossData) return;
    const bossName = bossData.boss_name || 'Unknown Boss';
    const region = bossData.region || 'Unknown Region';

    if (!groups[region]) groups[region] = {};

    if (!groups[region][bossName]) {
      const allBossMaterials = weeklyBossData.filter(b => b.boss_name === bossName).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const bossSortOrder = Math.min(...allBossMaterials.map(m => m.sortOrder || 999));

      groups[region][bossName] = {
        bossName,
        region,
        bossSortOrder,
        familyName: bossName,
        type: 'weekly_boss',
        familyData: {
          tiers: allBossMaterials.map(m => ({ id: m.id, name: m.name, rarity: 5 }))
        },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'weekly_boss', totals, trackedWeapons });

    groups[region][bossName].items[bossData.id] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[region][bossName].neededBy.find(e => e.name === entity.name)) {
        groups[region][bossName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupNormalBosses = (worldBoss, totals, trackedWeapons) => {
  const groups = {};
  const bossNeeded = worldBoss || [];

  bossNeeded.forEach(item => {
    const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bossData = normalBossData.find(b => b.id === normalizedKey || b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

    if (!bossData) return;
    const bossName = bossData.boss_name || 'Unknown Boss';
    const region = bossData.region || 'Unknown Region';

    if (!groups[region]) groups[region] = {};

    if (!groups[region][bossName]) {
      groups[region][bossName] = {
        bossName,
        region,
        bossSortOrder: bossData.sortOrder || 999,
        type: 'world_boss',
        familyData: { tiers: [{ id: bossData.id, name: item.name, rarity: 4 }] },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'world_boss', totals, trackedWeapons });

    groups[region][bossName].items[bossData.id] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[region][bossName].neededBy.find(e => e.name === entity.name)) {
        groups[region][bossName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupLocalSpecialties = (localSpecialty, totals, trackedWeapons) => {
  const groups = {};
  const localNeeded = localSpecialty || [];

  localNeeded.forEach(item => {
    const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const specialtyData = localSpecialtyData.find(s => s.id === normalizedKey || s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);

    if (!specialtyData) return;
    const region = specialtyData.region || 'Unknown Region';
    const itemName = specialtyData.name;

    if (!groups[region]) groups[region] = {};

    if (!groups[region][itemName]) {
      groups[region][itemName] = {
        bossName: itemName,
        region,
        bossSortOrder: specialtyData.sortOrder || 999,
        type: 'local_specialty',
        familyData: {
          tiers: [{ id: specialtyData.id, name: itemName, rarity: 1 }]
        },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'local_specialty', totals, trackedWeapons });

    groups[region][itemName].items[specialtyData.id] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[region][itemName].neededBy.find(e => e.name === entity.name)) {
        groups[region][itemName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupEliteEnemies = (eliteMob, totals, trackedWeapons) => {
  const groups = {};
  const eliteNeeded = eliteMob || [];

  eliteNeeded.forEach(item => {
    let matchedEnemy = null;
    let matchedTierId = null;

    for (const enemy of eliteEnemyData) {
      if (matchedEnemy) break;
      for (const [tierKey, tierObj] of Object.entries(enemy.tiers)) {
        if (tierObj.name === item.name || tierObj.id.toLowerCase() === item.name.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          matchedEnemy = enemy;
          matchedTierId = tierObj.id;
          break;
        }
      }
    }

    if (!matchedEnemy) return;
    const enemyName = matchedEnemy.name || 'Unknown Enemy';

    if (!groups[enemyName]) {
      groups[enemyName] = {
        bossName: enemyName,
        bossSortOrder: matchedEnemy.tiers['2_star']?.sortOrder || 999,
        type: 'elite_mob',
        familyData: {
          tiers: [
            { id: matchedEnemy.tiers['2_star'].id, name: matchedEnemy.tiers['2_star'].name, rarity: 2 },
            { id: matchedEnemy.tiers['3_star'].id, name: matchedEnemy.tiers['3_star'].name, rarity: 3 },
            { id: matchedEnemy.tiers['4_star'].id, name: matchedEnemy.tiers['4_star'].name, rarity: 4 }
          ]
        },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'elite_mob', totals, trackedWeapons });

    groups[enemyName].items[matchedTierId] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[enemyName].neededBy.find(e => e.name === entity.name)) {
        groups[enemyName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

export const groupCommonEnemies = (mob, totals, trackedWeapons) => {
  const groups = {};
  const mobNeeded = mob || [];

  mobNeeded.forEach(item => {
    let matchedEnemy = null;
    let matchedTierId = null;

    for (const enemy of commonEnemyData) {
      if (matchedEnemy) break;
      for (const [tierKey, tierObj] of Object.entries(enemy.tiers)) {
        if (tierObj.name === item.name || tierObj.id.toLowerCase() === item.name.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          matchedEnemy = enemy;
          matchedTierId = tierObj.id;
          break;
        }
      }
    }

    if (!matchedEnemy) return;
    const enemyName = matchedEnemy.name || 'Unknown Enemy';

    if (!groups[enemyName]) {
      groups[enemyName] = {
        bossName: enemyName,
        bossSortOrder: matchedEnemy.tiers['1_star']?.sortOrder || 999,
        type: 'mob',
        familyData: {
          tiers: [
            { id: matchedEnemy.tiers['1_star'].id, name: matchedEnemy.tiers['1_star'].name, rarity: 1 },
            { id: matchedEnemy.tiers['2_star'].id, name: matchedEnemy.tiers['2_star'].name, rarity: 2 },
            { id: matchedEnemy.tiers['3_star'].id, name: matchedEnemy.tiers['3_star'].name, rarity: 3 }
          ]
        },
        items: {},
        neededBy: []
      };
    }

    const neededBy = getNeededBy({ matKey: item.name, type: 'mob', totals, trackedWeapons });

    groups[enemyName].items[matchedTierId] = { item, neededBy };

    neededBy.forEach(entity => {
      if (!groups[enemyName].neededBy.find(e => e.name === entity.name)) {
        groups[enemyName].neededBy.push(entity);
      }
    });
  });

  return groups;
};

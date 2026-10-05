/**
 * Groups an already-filtered list of achievements by stageGroupId.
 * 
 * @param {Array} achievements - The filtered and sorted list of canonical achievements.
 * @returns {Array} An array of renderable items, either single achievements or grouped achievements.
 */
export function groupAchievements(achievements) {
  const result = [];
  const groupMap = new Map();

  for (const ach of achievements) {
    if (ach.stageGroupId) {
      if (!groupMap.has(ach.stageGroupId)) {
        const newGroup = {
          isGroup: true,
          stageGroupId: ach.stageGroupId,
          stages: [],
          commonName: null
        };
        groupMap.set(ach.stageGroupId, newGroup);
        result.push(newGroup);
      }
      groupMap.get(ach.stageGroupId).stages.push(ach);
    } else {
      result.push({
        isGroup: false,
        achievement: ach
      });
    }
  }

  // Process groups: sort by stageIndex and determine commonName
  for (const item of result) {
    if (item.isGroup) {
      item.stages.sort((a, b) => a.stageIndex - b.stageIndex);
      
      const firstName = item.stages[0].name;
      const allSameName = item.stages.every(s => s.name === firstName);
      if (allSameName) {
        item.commonName = firstName;
      }
    }
  }

  return result;
}

import React, { useState } from 'react';
import FarmableToday from '../FarmableToday';
import DomainCard from '../DomainCard';
import PlannerCategorySection from './PlannerCategorySection';
import CharacterPlanCard from '../CharacterPlanCard';
import WeaponPlanCard from '../WeaponPlanCard';
import { formatName } from '../../utils/gameData';
import { REGION_ORDER, getScheduleWeight } from '../../pages/planner/plannerGrouping';
import { buildCurrencyExpItems } from '../../utils/currencyUtils';

export default function PlannerTabContent({
  activeTab,
  toFarm,
  totals,
  inventory,
  groupedBooksData,
  groupedWeaponMatsData,
  groupedGemstonesData,
  groupedWeeklyBosses,
  groupedNormalBosses,
  groupedLocalSpecialties,
  groupedEliteEnemies,
  groupedCommonEnemies,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('planner-collapsed-state');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [charSearchQuery, setCharSearchQuery] = useState('');
  const [weaponSearchQuery, setWeaponSearchQuery] = useState('');

  const toggleSection = (key) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('planner-collapsed-state', JSON.stringify(next));
      return next;
    });
  };

  const renderRegionGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return Object.keys(groupedData)
      .sort((a, b) => {
        const idxA = REGION_ORDER.indexOf(a);
        const idxB = REGION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(region => {
        const regionKey = `${categoryKey}-${region}`;
        const isCollapsed = collapsed[regionKey];
        return (
          <div key={region} className="mb-8 last:mb-2">
            <h3
              className="text-xl font-bold mb-4 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleSection(regionKey)}
            >
              <span className={`text-lg inline-block transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
              <span className="text-sm">📍</span> {region}
            </h3>
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.keys(groupedData[region]).map(domainName => (
                  Object.values(groupedData[region][domainName])
                    .sort((a, b) => getScheduleWeight(a.familyData) - getScheduleWeight(b.familyData))
                    .map(familyObj => (
                      <DomainCard
                        key={familyObj.familyName}
                        domainName={domainName}
                        familyObj={familyObj}
                        accent={accent}
                        globalCosts={totals.totalCosts}
                        inventory={inventory}
                        itemFolder={itemFolder}
                      />
                    ))
                ))}
              </div>
            )}
          </div>
        );
      });
  };

  const renderBossRegionGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return Object.keys(groupedData)
      .sort((a, b) => {
        const idxA = REGION_ORDER.indexOf(a);
        const idxB = REGION_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      })
      .map(region => {
        const regionKey = `${categoryKey}-${region}`;
        const isCollapsed = collapsed[regionKey];
        return (
          <div key={region} className="mb-8 last:mb-2">
            <h3
              className="text-xl font-bold mb-4 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => toggleSection(regionKey)}
            >
              <span className={`text-lg inline-block transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>›</span>
              <span className="text-sm">📍</span> {region}
            </h3>
            {!isCollapsed && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.values(groupedData[region])
                  .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                  .map(bossObj => {
                    let prefix = 'BOSS';
                    if (bossObj.type === 'elite_mob' || bossObj.type === 'mob') prefix = 'ENEMY';
                    if (bossObj.type === 'local_specialty') prefix = 'LOCAL SPECIALTY';

                    return (
                      <DomainCard
                        key={bossObj.bossName}
                        domainName={`${prefix}: ${bossObj.bossName.toUpperCase()}`}
                        familyObj={bossObj}
                        accent={accent}
                        globalCosts={totals.totalCosts}
                        inventory={inventory}
                        itemFolder={itemFolder}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        );
      });
  };

  const renderGemGroups = (groupedData, accent, categoryKey, itemFolder) => {
    if (Object.keys(groupedData).length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Object.values(groupedData)
          .sort((a, b) => a.jsonSortOrder - b.jsonSortOrder)
          .map(familyObj => (
            <DomainCard
              key={familyObj.familyKey}
              domainName={`FAMILY: ${familyObj.familyName.toUpperCase()}`}
              familyObj={familyObj}
              accent={accent}
              globalCosts={totals.totalCosts}
              inventory={inventory}
              itemFolder={itemFolder}
            />
          ))}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      {activeTab === 'daily_action' && (
        <>
          {toFarm.allDone && (
            <div className="rounded-2xl border mb-8 px-6 py-5 flex items-center gap-4"
              style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' }}>
              <span className="text-3xl">🎉</span>
              <div>
                <p className="font-bold text-lg" style={{ color: '#4ADE80' }}>Inventory is fully stocked!</p>
                <p className="text-sm text-[var(--muted)] mt-0.5">Your current inventory covers all progression goals. Time to ascend!</p>
              </div>
            </div>
          )}
          <FarmableToday />
        </>
      )}

      {activeTab === 'currency_exp' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {buildCurrencyExpItems(toFarm, inventory).map(({ config, item }) => (
            <DomainCard
              key={config.id}
              domainName={config.domainName}
              familyObj={{
                type: 'currency',
                familyName: config.displayName,
                familyData: { tiers: [{ id: config.id, name: config.displayName, rarity: config.rarity }] },
                items: { [config.id]: { item: item } },
                neededBy: []
              }}
              accent="#FAB632"
              globalCosts={totals.totalCosts}
              inventory={inventory}
              itemFolder={config.folder}
            />
          ))}
        </div>
      )}

      {activeTab === 'talent' && (
        toFarm.talentBooks?.length > 0
          ? renderRegionGroups(groupedBooksData, '#A855F7', 'all-talent', 'talent_materials')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All talent books covered</div>
      )}

      {activeTab === 'weekly_boss' && (
        toFarm.weeklyBoss?.length > 0
          ? renderBossRegionGroups(groupedWeeklyBosses, '#FBBF24', 'all-weekly', 'weekly_boss_materials')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All weekly boss drops covered</div>
      )}

      {activeTab === 'weapon_ascension' && (
        toFarm.weaponAscMats?.length > 0
          ? renderRegionGroups(groupedWeaponMatsData, 'var(--gold)', 'all-weapon', 'weapon_ascension_materials')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All weapon domains covered</div>
      )}

      {activeTab === 'character_gem' && (
        toFarm.gemstones?.length > 0
          ? renderGemGroups(groupedGemstonesData, '#C8A96E', 'all-gem', 'character_ascension_gems')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All gemstones covered</div>
      )}

      {activeTab === 'normal_boss' && (
        toFarm.worldBoss?.length > 0
          ? renderBossRegionGroups(groupedNormalBosses, '#F97316', 'all-normalboss', 'normal_boss_materials')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All boss drops covered</div>
      )}

      {activeTab === 'forging_materials' && (
        toFarm.forgingMats?.length > 0
          ? (
            <>
              <PlannerCategorySection
                icon="📜"
                title="Billets"
                items={toFarm.forgingMats.filter(i => i.category === 'billet' || i.name.toLowerCase().includes('billet'))}
                accent="var(--gold)"
                emptyMsg="All billets covered"
                maxCols={3}
              />
              <PlannerCategorySection
                icon="💎"
                title="Forging Ores"
                items={toFarm.forgingMats.filter(i => i.category === 'forgingOre' || (!i.name.toLowerCase().includes('billet') && i.name !== 'mora'))}
                accent="#A855F7"
                emptyMsg="All forging ores covered"
                maxCols={3}
              />
            </>
          )
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All forging materials covered</div>
      )}

      {activeTab === 'elite_enhancement' && (
        toFarm.eliteMob?.length > 0
          ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {Object.values(groupedEliteEnemies)
                  .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                  .map(bossObj => (
                    <DomainCard
                      key={bossObj.bossName}
                      domainName={`ENEMY: ${bossObj.bossName.toUpperCase()}`}
                      familyObj={bossObj}
                      accent="var(--gold)"
                      globalCosts={totals.totalCosts}
                      inventory={inventory}
                      itemFolder="elite_enhancement_materials"
                    />
                  ))}
              </div>
            )
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All elite drops covered</div>
      )}

      {activeTab === 'local_specialty' && (
        toFarm.localSpecialty?.length > 0
          ? renderBossRegionGroups(groupedLocalSpecialties, '#4ADE80', 'all-specialty', 'local_specialties')
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All local specialties covered</div>
      )}

      {activeTab === 'common_enhancement' && (
        toFarm.mob?.length > 0
          ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {Object.values(groupedCommonEnemies)
                  .sort((a, b) => a.bossSortOrder - b.bossSortOrder)
                  .map(enemyObj => (
                    <DomainCard
                      key={enemyObj.bossName}
                      domainName={`ENEMY: ${enemyObj.bossName.toUpperCase()}`}
                      familyObj={enemyObj}
                      accent="#A855F7"
                      globalCosts={totals.totalCosts}
                      inventory={inventory}
                      itemFolder="common_enhancement_materials"
                    />
                  ))}
              </div>
            )
          : <div className="text-center py-6 text-[var(--muted)] text-xs border border-dashed border-[var(--border)] rounded-xl mt-2">All mob drops covered</div>
      )}

      {activeTab === 'per_character' && (
        <div>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search characters..."
              value={charSearchQuery}
              onChange={(e) => setCharSearchQuery(e.target.value)}
              className="w-full md:w-1/3 bg-bg-base border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
            />
          </div>

          {totals.breakdown.filter(entry => entry.character && formatName(entry.name).toLowerCase().includes(charSearchQuery.toLowerCase())).length > 0
            ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {totals.breakdown
                  .filter(entry => entry.character && formatName(entry.name).toLowerCase().includes(charSearchQuery.toLowerCase()))
                  .map((entry) => <CharacterPlanCard key={entry.name} entryObj={entry} inventory={inventory} categories={totals.categories} />)}
              </div>
            )
            : <div className="text-center py-12 text-[var(--muted)]"><p>No characters match your search or have active goals yet.</p></div>
          }
        </div>
      )}

      {activeTab === 'per_weapon' && (
        <div>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search weapons..."
              value={weaponSearchQuery}
              onChange={(e) => setWeaponSearchQuery(e.target.value)}
              className="w-full md:w-1/3 bg-bg-base border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
            />
          </div>

          {totals.breakdown.filter(entry => !entry.character && formatName(entry.name).toLowerCase().includes(weaponSearchQuery.toLowerCase())).length > 0
            ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {totals.breakdown
                  .filter(entry => !entry.character && formatName(entry.name).toLowerCase().includes(weaponSearchQuery.toLowerCase()))
                  .map((entry) => <WeaponPlanCard key={entry.name} entryObj={entry} inventory={inventory} categories={totals.categories} />)}
              </div>
            )
            : <div className="text-center py-12 text-[var(--muted)]"><p>No stand-alone weapons match your search or have active goals yet.</p></div>
          }
        </div>
      )}
    </div>
  );
}

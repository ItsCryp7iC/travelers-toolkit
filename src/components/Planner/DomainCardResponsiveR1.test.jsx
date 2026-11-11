import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DomainCard from '../DomainCard';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import useStore from '../../store/useStore';
import PlannerTabContent from './PlannerTabContent';

describe('PLANNER-UI-R1: Material Card Readability & Responsive Layout Suite', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useCraftingSessionStore.getState().discardSession();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    useCraftingSessionStore.getState().discardSession();
    vi.restoreAllMocks();
  });

  const renderCard = async (props) => {
    await act(async () => {
      root.render(<DomainCard {...props} />);
    });
  };

  // ── 1. Material name fully readable & no truncate on names ──
  it('1. Material name has dedicated row, allows wrapping, and does not use truncate class', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
      items: {
        SlimeSecretions: {
          item: { name: 'SlimeSecretions', required: 186, owned: 253, toFarm: 0 },
        },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeSecretions: 186 },
      inventory: { SlimeSecretions: 253 },
      craftingMode: 'raw',
    });

    const nameEl = container.querySelector('span[title="Slime Secretions"]');
    expect(nameEl).toBeTruthy();
    expect(nameEl.textContent).toBe('Slime Secretions');
    // Must NOT have truncate class
    expect(nameEl.className).not.toContain('truncate');
    expect(nameEl.className).toContain('break-words');
  });

  // ── 2. Long names wrapping cleanly ──
  it('2. Long material names wrap cleanly without clipping or truncate', async () => {
    const longNames = [
      { id: 'ForbiddenCurseScroll', name: 'Forbidden Curse Scroll', rarity: 3 },
      { id: 'ChainsOfTheDandelionGladiator', name: 'Chains of the Dandelion Gladiator', rarity: 4 },
      { id: 'TeachingsOfFreedom', name: 'Teachings of Freedom', rarity: 2 },
      { id: 'PhilosophiesOfGold', name: 'Philosophies of Gold', rarity: 4 },
    ];

    const familyObj = {
      familyName: 'LongNamesFamily',
      type: 'domain',
      familyData: {
        familyId: 'LongNamesFamily',
        tiers: longNames,
      },
      items: Object.fromEntries(
        longNames.map((item) => [
          item.id,
          { item: { name: item.id, required: 50, owned: 10, toFarm: 40 } },
        ])
      ),
      neededBy: [],
    };

    await renderCard({
      domainName: 'Domain of Guyun',
      familyObj,
      accent: '#D87A34',
      globalCosts: Object.fromEntries(longNames.map((i) => [i.id, 50])),
      inventory: Object.fromEntries(longNames.map((i) => [i.id, 10])),
      craftingMode: 'raw',
    });

    for (const item of longNames) {
      const el = container.querySelector(`span[title="${item.name}"]`);
      expect(el).toBeTruthy();
      expect(el.textContent).toBe(item.name);
      expect(el.className).not.toContain('truncate');
      expect(el.className).toContain('break-words');
    }
  });

  // ── 3. Acceptance Fixture: Slime Condensate (Need: 121, Have: 1,209, To Farm: 0) ──
  it('3. Slime Condensate fixture renders Need: 121, Have: 1,209, To Farm: 0 with all values clearly visible', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
        ],
      },
      items: {
        SlimeCondensate: {
          item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0, guaranteedToFarm: 0 },
        },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 121 },
      inventory: { SlimeCondensate: 1209 },
      craftingMode: 'crafting-aware',
    });

    expect(container.textContent).toContain('Need: 121');
    expect(container.textContent).toContain('Have: 1,209');
    expect(container.textContent).toContain('To Farm: 0');
    // Check cell title tooltips
    expect(container.querySelector('[title="Need: 121"]')).toBeTruthy();
    expect(container.querySelector('[title="Have: 1,209"]')).toBeTruthy();
  });

  // ── 4. Acceptance Fixture: Slime Secretions (Need: 186, Have: 253, Craft: ≈362, To Farm: 0) ──
  it('4. Slime Secretions fixture renders Need: 186, Have: 253, Craft: ≈362, To Farm: 0 without name truncation', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
      items: {
        SlimeSecretions: {
          item: {
            name: 'SlimeSecretions',
            required: 186,
            owned: 253,
            toFarm: 0,
            guaranteedToFarm: 0,
            craftQuantity: 362,
          },
        },
      },
      neededBy: [],
    };

    const bonusForecast = {
      families: {
        Slime: {
          isEligible: true,
          expectedShortages: { SlimeSecretions: 0 },
          optimizedSteps: [
            {
              outputItemId: 'SlimeSecretions',
              expectedCrafts: 362,
              expectedOutput: 362,
            },
          ],
        },
      },
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeSecretions: 186 },
      inventory: { SlimeSecretions: 253 },
      craftingMode: 'crafting-aware',
      craftingBonusOptions: { enabled: true, bonusType: 'double_output' },
      bonusForecast,
    });

    expect(container.textContent).toContain('Need: 186');
    expect(container.textContent).toContain('Have: 253');
    expect(container.textContent).toContain('Craft: ≈362');
    expect(container.textContent).toContain('To Farm: 0');

    // Verify name has not been truncated
    const nameEl = container.querySelector('span[title="Slime Secretions"]');
    expect(nameEl.className).not.toContain('truncate');
  });

  // ── 5. Acceptance Fixture: Slime Concentrate (Need: 240, Have: 51, Craft: ≈155, Est To Farm: ≈18.25) ──
  it('5. Slime Concentrate fixture preserves estimated-shortage formatting (~18.25) and exact tooltips', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeConcentrate: {
          item: {
            name: 'SlimeConcentrate',
            required: 240,
            owned: 51,
            toFarm: 18.25,
            guaranteedToFarm: 34,
            expectedShortage: 18.25,
            craftQuantity: 155,
          },
        },
      },
      neededBy: [],
    };

    const bonusForecast = {
      families: {
        Slime: {
          isEligible: true,
          expectedShortages: { SlimeConcentrate: 18.25 },
          optimizedSteps: [
            {
              outputItemId: 'SlimeConcentrate',
              expectedCrafts: 155,
              expectedOutput: 170.5,
            },
          ],
        },
      },
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeConcentrate: 240 },
      inventory: { SlimeConcentrate: 51 },
      craftingMode: 'crafting-aware',
      craftingBonusOptions: { enabled: true, bonusType: 'double_output' },
      bonusForecast,
    });

    expect(container.textContent).toContain('Need: 240');
    expect(container.textContent).toContain('Have: 51');
    expect(container.textContent).toContain('Craft: ≈155');
    expect(container.textContent).toContain('To Farm: ~18.25');

    // Guaranteed shortage in tooltip
    expect(container.querySelector('[title="Guaranteed shortage: 34"]')).toBeTruthy();
  });

  // ── 6. Craft indicator displayed when applicable, absent when not ──
  it('6. Craft indicator is displayed when hasCrafting is true and completely absent when 0', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: {
          item: { name: 'SlimeCondensate', required: 100, owned: 50, toFarm: 50, craftQuantity: 0 },
        },
        SlimeConcentrate: {
          item: { name: 'SlimeConcentrate', required: 50, owned: 10, toFarm: 0, craftQuantity: 40 },
        },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 100, SlimeConcentrate: 50 },
      inventory: { SlimeCondensate: 50, SlimeConcentrate: 10 },
      craftingMode: 'crafting-aware',
    });

    // Concentrate has craft quantity 40
    expect(container.textContent).toContain('Craft: +40');

    // Condensate tier does not have Craft:
    const condensateBlock = container.querySelector('span[title="Slime Condensate"]').closest('.flex.flex-col');
    expect(condensateBlock.textContent).not.toContain('Craft:');
  });

  // ── 7. Probabilistic notation retained ──
  it('7. Probabilistic notation retained for likely covered tier (🎲 ~0)', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeConcentrate: {
          item: {
            name: 'SlimeConcentrate',
            required: 100,
            owned: 50,
            toFarm: 0,
            guaranteedToFarm: 10,
            expectedShortage: 0,
            craftQuantity: 50,
          },
        },
      },
      neededBy: [],
    };

    const bonusForecast = {
      families: {
        Slime: {
          isEligible: true,
          expectedShortages: { SlimeConcentrate: 0 },
        },
      },
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeConcentrate: 100 },
      inventory: { SlimeConcentrate: 50 },
      craftingMode: 'crafting-aware',
      craftingBonusOptions: { enabled: true, bonusType: 'double_output' },
      bonusForecast,
    });

    expect(container.textContent).toContain('🎲 ~0');
  });

  // ── 8. Rarity colors retained ──
  it('8. Rarity colors are accurately applied to the dot indicator and material name', async () => {
    const familyObj = {
      familyName: 'TestTiers',
      type: 'mob',
      familyData: {
        familyId: 'TestTiers',
        tiers: [
          { id: 'Tier1', name: 'Tier 1 Mat', rarity: 1 },
          { id: 'Tier2', name: 'Tier 2 Mat', rarity: 2 },
          { id: 'Tier3', name: 'Tier 3 Mat', rarity: 3 },
          { id: 'Tier4', name: 'Tier 4 Mat', rarity: 4 },
          { id: 'Tier5', name: 'Tier 5 Mat', rarity: 5 },
        ],
      },
      items: {
        Tier1: { item: { name: 'Tier1', required: 10, owned: 10, toFarm: 0 } },
        Tier2: { item: { name: 'Tier2', required: 10, owned: 10, toFarm: 0 } },
        Tier3: { item: { name: 'Tier3', required: 10, owned: 10, toFarm: 0 } },
        Tier4: { item: { name: 'Tier4', required: 10, owned: 10, toFarm: 0 } },
        Tier5: { item: { name: 'Tier5', required: 10, owned: 10, toFarm: 0 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'DOMAIN: TEST',
      familyObj,
      accent: '#4ADE80',
      globalCosts: {},
      inventory: {},
      craftingMode: 'raw',
    });

    const expectedColors = {
      1: 'rgb(128, 128, 128)',
      2: 'rgb(107, 142, 35)',
      3: 'rgb(74, 158, 255)',
      4: 'rgb(147, 112, 219)',
      5: 'rgb(216, 122, 52)',
    };

    for (let r = 1; r <= 5; r++) {
      const nameEl = container.querySelector(`span[title="Tier ${r} Mat"]`);
      expect(nameEl).toBeTruthy();
      expect(nameEl.style.color).toBe(expectedColors[r]);
    }
  });

  // ── 9. Progress bar retained ──
  it('9. Progress bar is retained and reflects completion percentage', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
        ],
      },
      items: {
        SlimeCondensate: {
          item: { name: 'SlimeCondensate', required: 100, owned: 50, toFarm: 50, guaranteedToFarm: 50 },
        },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 100 },
      inventory: { SlimeCondensate: 50 },
      craftingMode: 'raw',
    });

    const progressBar = container.querySelector('.h-1 div');
    expect(progressBar).toBeTruthy();
    expect(progressBar.style.width).toBe('50%');
  });

  // ── 10. Family header controls & wrapping ──
  it('10. Family header allows long domain names to wrap without truncation', async () => {
    const familyObj = {
      familyName: 'Hilichurl',
      type: 'domain',
      familyData: {
        familyId: 'Hilichurl',
        tiers: [
          { id: 'DamagedMask', name: 'Damaged Mask', rarity: 1 },
        ],
      },
      items: {
        DamagedMask: { item: { name: 'DamagedMask', required: 10, owned: 10, toFarm: 0 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'Clear Pool and Mountain Cavern (Extremely Long Domain Name)',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { DamagedMask: 10 },
      inventory: { DamagedMask: 10 },
      craftingMode: 'raw',
    });

    const headerTitle = container.querySelector('.text-xs.font-bold.tracking-wider.uppercase');
    expect(headerTitle).toBeTruthy();
    expect(headerTitle.textContent).toContain('Clear Pool and Mountain Cavern');
    expect(headerTitle.className).not.toContain('truncate');
    expect(headerTitle.className).toContain('break-words');
  });

  // ── 11. Start Crafting Assistant button works ──
  it('11. Start Crafting Assistant button starts a new session', async () => {
    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: true,
      steps: [{ outputItemId: 'SlimeConcentrate', totalOutputProduced: 10 }],
    };

    const familyObj = {
      familyName: 'Slime',
      familyId: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 20, owned: 10, toFarm: 0, guaranteedToFarm: 0, craftQuantity: 10 } },
      },
      neededBy: [],
      craftingPlan: familyPlan,
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeConcentrate: 20 },
      inventory: { SlimeConcentrate: 10, Mora: 50000 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Slime: familyPlan } },
    });

    const startBtn = container.querySelector('#domain-crafting-session-btn-Slime');
    expect(startBtn).toBeTruthy();
    expect(startBtn.textContent).toContain('Start');

    await act(async () => {
      startBtn.click();
    });

    const activeSession = useCraftingSessionStore.getState().session;
    expect(activeSession).toBeTruthy();
    expect(activeSession.snapshot.familyId).toBe('Slime');
  });

  // ── 12. Continue active session works ──
  it('12. Continue active session button opens drawer when session is active', async () => {
    useCraftingSessionStore.getState().startSession({
      familyId: 'Slime',
      inventory: { SlimeConcentrate: 10 },
      grossRequirements: { SlimeConcentrate: 20 },
      bonusType: null,
      startingMora: 50000,
    });

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: true,
    };

    const familyObj = {
      familyName: 'Slime',
      familyId: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 20, owned: 10, toFarm: 0 } },
      },
      neededBy: [],
      craftingPlan: familyPlan,
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeConcentrate: 20 },
      inventory: { SlimeConcentrate: 10 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Slime: familyPlan } },
    });

    const continueBtn = container.querySelector('#domain-crafting-session-btn-Slime');
    expect(continueBtn).toBeTruthy();
    expect(continueBtn.textContent).toContain('Continue');

    useCraftingSessionStore.getState().closeDrawer();
    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(false);

    await act(async () => {
      continueBtn.click();
    });

    expect(useCraftingSessionStore.getState().isDrawerOpen).toBe(true);
  });

  // ── 13. Family crafting status pill is visible below title ──
  it('13. Family crafting status pill renders cleanly below title', async () => {
    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: true,
    };

    const familyObj = {
      familyName: 'Slime',
      familyId: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 20, owned: 10, toFarm: 0 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeConcentrate: 20 },
      inventory: { SlimeConcentrate: 10 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Slime: familyPlan } },
    });

    expect(container.textContent).toContain('Crafting required — No additional farming');
  });

  // ── 14. Needed By section functional ──
  it('14. Needed By section renders character and weapon avatars', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 10, owned: 10, toFarm: 0 } },
      },
      neededBy: [
        { type: 'character', name: 'Zhongli' },
        { type: 'weapon', name: 'Staff of Homa' },
      ],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 10 },
      inventory: { SlimeCondensate: 10 },
      craftingMode: 'raw',
    });

    expect(container.textContent).toContain('Needed By');
    expect(container.querySelector('img[title="Zhongli"]')).toBeTruthy();
    expect(container.querySelector('img[title="Staff of Homa"]')).toBeTruthy();
  });

  // ── 15. Expandable crafting instructions toggle works ──
  it('15. Expandable crafting instructions open and close on click', async () => {
    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      steps: [
        {
          recipeId: 'rec_1',
          outputItemId: 'SlimeSecretions',
          outputItemName: 'Slime Secretions',
          inputItemId: 'SlimeCondensate',
          inputItemName: 'Slime Condensate',
          totalOutputProduced: 10,
          totalInputConsumed: 30,
          totalMoraCost: 250,
          count: 10,
        },
      ],
      craftingMora: 250,
    };

    const familyObj = {
      familyName: 'Slime',
      familyId: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
      items: {
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 20, owned: 10, toFarm: 0, craftQuantity: 10 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeSecretions: 20 },
      inventory: { SlimeCondensate: 30, SlimeSecretions: 10 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Slime: familyPlan } },
    });

    const toggleBtn = container.querySelector('button[aria-expanded]');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Craft 10 Slime Secretions');
    expect(container.textContent).toContain('250 Mora');
  });

  // ── 16. Multiple material categories render correctly ──
  it('16. DomainCard renders across various categories without error', async () => {
    const categories = [
      { type: 'weekly_boss', prefix: '👑', domain: 'Wolf of the North' },
      { type: 'world_boss', prefix: '🐉', domain: 'BOSS: ANEMO HYPOSTASIS' },
      { type: 'elite_mob', prefix: '🛡️', domain: 'ENEMY: RUIN GUARD' },
      { type: 'gemstones', prefix: '💎', domain: 'FAMILY: VAYUDA TURQUOISE' },
      { type: 'currency', prefix: '🏛️', domain: 'Blossom of Wealth' },
    ];

    for (const cat of categories) {
      const familyObj = {
        familyName: 'TestFam',
        type: cat.type,
        familyData: {
          tiers: [{ id: 'test_item', name: 'Test Material', rarity: 4 }],
        },
        items: {
          test_item: { item: { name: 'test_item', required: 10, owned: 5, toFarm: 5 } },
        },
        neededBy: [],
      };

      await renderCard({
        domainName: cat.domain,
        familyObj,
        accent: '#D87A34',
        globalCosts: { test_item: 10 },
        inventory: { test_item: 5 },
        craftingMode: 'raw',
      });

      expect(container.textContent).toContain(cat.domain);
      expect(container.textContent).toContain('Test Material');
      expect(container.textContent).toContain('Need: 10');
      expect(container.textContent).toContain('Have: 5');
      expect(container.textContent).toContain('To Farm: 5');
    }
  });

  // ── 18. Large number formatting prevents card overflow ──
  it('18. Large quantity numbers format to compact representations preventing overflow', async () => {
    const familyObj = {
      familyName: 'Currency',
      type: 'currency',
      familyData: {
        tiers: [{ id: 'Mora', name: 'Mora', rarity: 3 }],
      },
      items: {
        Mora: { item: { name: 'Mora', required: 42586360, owned: 299145120, toFarm: 0 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'Blossom of Wealth',
      familyObj,
      accent: '#FAB632',
      globalCosts: { Mora: 42586360 },
      inventory: { Mora: 299145120 },
      craftingMode: 'raw',
    });

    expect(container.textContent).toContain('42.59M');
    expect(container.textContent).toContain('299.15M');
    expect(container.querySelector('[title="Need: 42,586,360"]')).toBeTruthy();
    expect(container.querySelector('[title="Have: 299,145,120"]')).toBeTruthy();
  });

  // ── 19. Responsive Grid Classes in PlannerTabContent ──
  it('19. PlannerTabContent defines grid-cols-1 md:grid-cols-2 xl:grid-cols-3 across all card sections', async () => {
    const mockToFarm = {
      allDone: false,
      mob: [{ name: 'Slime', bossName: 'Slime', bossSortOrder: 1 }],
      eliteMob: [{ name: 'RuinGuard', bossName: 'Ruin Guard', bossSortOrder: 1 }],
    };
    const mockTotals = { totalCosts: {}, breakdown: [] };
    const mockCommonEnemies = {
      Slime: {
        bossName: 'Slime',
        bossSortOrder: 1,
        familyData: { tiers: [{ id: 'sc', name: 'Slime Condensate', rarity: 1 }] },
        items: {},
        neededBy: [],
      },
    };
    const mockEliteEnemies = {
      RuinGuard: {
        bossName: 'Ruin Guard',
        bossSortOrder: 1,
        familyData: { tiers: [{ id: 'rc', name: 'Chaos Device', rarity: 2 }] },
        items: {},
        neededBy: [],
      },
    };

    await act(async () => {
      root.render(
        <PlannerTabContent
          activeTab="common_enhancement"
          toFarm={mockToFarm}
          totals={mockTotals}
          inventory={{}}
          groupedBooksData={{}}
          groupedWeaponMatsData={{}}
          groupedGemstonesData={{}}
          groupedWeeklyBosses={{}}
          groupedNormalBosses={{}}
          groupedLocalSpecialties={{}}
          groupedEliteEnemies={mockEliteEnemies}
          groupedCommonEnemies={mockCommonEnemies}
        />
      );
    });

    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('xl:grid-cols-3');
  });

  // ── 20. No inventory store mutations occur during render ──
  it('20. Rendering DomainCards causes zero inventory store mutations', async () => {
    const initialInv = { SlimeCondensate: 1000, Mora: 500000 };
    useStore.setState({ inventory: initialInv });

    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [{ id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 }],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 100, owned: 1000, toFarm: 0 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'ENEMY: SLIME',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 100 },
      inventory: initialInv,
      craftingMode: 'crafting-aware',
    });

    const currentInv = useStore.getState().inventory;
    expect(currentInv).toEqual(initialInv);
  });

  // ── 21. Noncraftable material with shortage displays Farming Required ──
  it('21. Noncraftable material with shortage displays Farming required badge', async () => {
    const familyObj = {
      familyName: 'Valberry',
      type: 'local_specialty',
      familyData: {
        familyId: 'Valberry',
        tiers: [{ id: 'Valberry', name: 'Valberry', rarity: 1 }],
      },
      items: {
        Valberry: { item: { name: 'Valberry', required: 60 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'Mondstadt',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { Valberry: 60 },
      inventory: { Valberry: 5 },
      craftingMode: 'crafting-aware',
    });

    expect(container.textContent).toContain('Farming required');
    expect(container.textContent).toContain('🌾');
  });

  // ── 22. Craftable family with no crafting steps displays Farming Required ──
  it('22. Craftable family with no crafting steps displays Farming required badge', async () => {
    const familyObj = {
      familyName: 'Humanoid Ruin Machine',
      type: 'elite_mob',
      familyData: {
        familyId: 'Chaos',
        tiers: [
          { id: 'ChaosDevice', name: 'Chaos Device', rarity: 2 },
          { id: 'ChaosCircuit', name: 'Chaos Circuit', rarity: 3 },
          { id: 'ChaosCore', name: 'Chaos Core', rarity: 4 },
        ],
      },
      items: {
        ChaosDevice: { item: { name: 'ChaosDevice', required: 254 } },
        ChaosCircuit: { item: { name: 'ChaosCircuit', required: 273 } },
        ChaosCore: { item: { name: 'ChaosCore', required: 601 } },
      },
      neededBy: [],
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: false,
      allCoveredByCrafting: false,
      totalShortage: 1128,
    };

    await renderCard({
      domainName: 'Overworld',
      familyObj,
      accent: '#F97316',
      globalCosts: { ChaosDevice: 254, ChaosCircuit: 273, ChaosCore: 601 },
      inventory: { ChaosDevice: 0, ChaosCircuit: 0, ChaosCore: 0 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Chaos: familyPlan } },
    });

    expect(container.textContent).toContain('Farming required');
    expect(container.textContent).toContain('🌾');
  });

  // ── 23. Fully stocked non-craftable family displays Already Stocked ──
  it('23. Fully stocked non-craftable family displays Already stocked badge', async () => {
    const familyObj = {
      familyName: 'Philanemo Mushroom',
      type: 'local_specialty',
      familyData: {
        familyId: 'PhilanemoMushroom',
        tiers: [{ id: 'PhilanemoMushroom', name: 'Philanemo Mushroom', rarity: 1 }],
      },
      items: {
        PhilanemoMushroom: { item: { name: 'PhilanemoMushroom', required: 10 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'Mondstadt',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { PhilanemoMushroom: 10 },
      inventory: { PhilanemoMushroom: 18 },
      craftingMode: 'crafting-aware',
    });

    expect(container.textContent).toContain('Already stocked');
    expect(container.textContent).toContain('✅');
  });

  // ── 24. Guaranteed crafting coverage displays Crafting Required ──
  it('24. Guaranteed crafting coverage displays Crafting required — No additional farming badge', async () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 0 } },
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 20 } },
      },
      neededBy: [],
    };

    const familyPlan = {
      isCraftable: true,
      requiresCrafting: true,
      allCoveredByCrafting: true,
      totalShortage: 0,
      steps: [{ outputItemId: 'SlimeSecretions', totalOutputProduced: 20 }],
    };

    await renderCard({
      domainName: 'Overworld',
      familyObj,
      accent: '#4ADE80',
      globalCosts: { SlimeCondensate: 0, SlimeSecretions: 20 },
      inventory: { SlimeCondensate: 500, SlimeSecretions: 0 },
      craftingMode: 'crafting-aware',
      craftingPlan: { families: { Slime: familyPlan } },
    });

    expect(container.textContent).toContain('Crafting required — No additional farming');
    expect(container.textContent).toContain('🔨');
  });

  // ── 25. Currency cards do not display farming badges ──
  it('25. Currency cards omit farming status badge', async () => {
    const familyObj = {
      familyName: 'Mora',
      type: 'currency',
      familyData: {
        familyId: 'Mora',
        tiers: [{ id: 'Mora', name: 'Mora', rarity: 3 }],
      },
      items: {
        Mora: { item: { name: 'Mora', required: 5000000 } },
      },
      neededBy: [],
    };

    await renderCard({
      domainName: 'Ley Line Outcrop',
      familyObj,
      accent: '#EAB308',
      globalCosts: { Mora: 5000000 },
      inventory: { Mora: 1000000 },
      craftingMode: 'crafting-aware',
    });

    expect(container.textContent).not.toContain('Farming required');
    expect(container.textContent).not.toContain('Already stocked');
  });
});

import React, { act } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PlannerCraftingChecklist from './PlannerCraftingChecklist';
import Planner from '../../pages/Planner';
import DomainCard from '../DomainCard';
import useStore from '../../store/useStore';
import useCraftingSessionStore from '../../store/useCraftingSessionStore';
import { resetBodyScrollLockForTesting } from '../../utils/scrollLock';
import {
  TAB_TO_CRAFTING_CATEGORY_MAP,
  getCraftingCategoryForTab,
  getTabLabel,
} from '../../utils/plannerTabs';

describe('PLANNER-UI-R5: Category-Scoped Crafting Checklist, Default Bonuses & Compact Cards Suite', () => {
  beforeEach(() => {
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
    useStore.setState({
      inventory: {},
      roster: {},
      trackedWeapons: [],
    });
  });

  afterEach(() => {
    resetBodyScrollLockForTesting();
    useCraftingSessionStore.getState().discardSession();
  });

  const makeStep = ({
    recipeId,
    familyId,
    category,
    inputItemId,
    inputItemName,
    outputItemId,
    outputItemName,
    count,
    moraCostPerCraft,
  }) => ({
    recipeId,
    familyId,
    category,
    inputItemId,
    inputItemName,
    inputQty: 3,
    outputItemId,
    outputItemName,
    outputQty: 1,
    count,
    totalInputConsumed: count * 3,
    totalOutputProduced: count,
    moraCostPerCraft,
    totalMoraCost: count * moraCostPerCraft,
  });

  // Helper fixture: Multi-category crafting plan spanning all 5 craftable categories
  const createMultiCategoryPlan = () => {
    const families = {
      Slime: {
        familyId: 'Slime',
        familyName: 'Slime',
        category: 'common_enemy',
        isCraftable: true,
        craftingMora: 1500,
        steps: [
          makeStep({
            recipeId: 'Slime_tier_1_to_2',
            familyId: 'Slime',
            category: 'common_enemy',
            inputItemId: 'SlimeCondensate',
            inputItemName: 'Slime Condensate',
            outputItemId: 'SlimeSecretions',
            outputItemName: 'Slime Secretions',
            count: 30,
            moraCostPerCraft: 50,
          }),
        ],
      },
      Ballad: {
        familyId: 'Ballad',
        familyName: 'Teachings of Ballad',
        category: 'talent_materials',
        isCraftable: true,
        craftingMora: 3500,
        steps: [
          makeStep({
            recipeId: 'Ballad_tier_1_to_2',
            familyId: 'Ballad',
            category: 'talent_materials',
            inputItemId: 'TeachingOfBallad',
            inputItemName: 'Teaching of Ballad',
            outputItemId: 'GuideToBallad',
            outputItemName: 'Guide to Ballad',
            count: 20,
            moraCostPerCraft: 175,
          }),
        ],
      },
      Horn: {
        familyId: 'Horn',
        familyName: 'Heavy Horn',
        category: 'elite_enemy',
        isCraftable: true,
        craftingMora: 2000,
        steps: [
          makeStep({
            recipeId: 'Horn_tier_1_to_2',
            familyId: 'Horn',
            category: 'elite_enemy',
            inputItemId: 'HeavyHorn',
            inputItemName: 'Heavy Horn',
            outputItemId: 'MitachurlHorn',
            outputItemName: 'Mitachurl Horn',
            count: 15,
            moraCostPerCraft: 133,
          }),
        ],
      },
      DandelionGladiator: {
        familyId: 'DandelionGladiator',
        familyName: 'Fetters of the Dandelion Gladiator',
        category: 'weapon_ascension',
        isCraftable: true,
        craftingMora: 4000,
        steps: [
          makeStep({
            recipeId: 'DandelionGladiator_tier_1_to_2',
            familyId: 'DandelionGladiator',
            category: 'weapon_ascension',
            inputItemId: 'FettersOfTheDandelionGladiator',
            inputItemName: 'Fetters of the Dandelion Gladiator',
            outputItemId: 'ChainsOfTheDandelionGladiator',
            outputItemName: 'Chains of the Dandelion Gladiator',
            count: 25,
            moraCostPerCraft: 160,
          }),
        ],
      },
      AgnidusAgate: {
        familyId: 'AgnidusAgate',
        familyName: 'Agnidus Agate',
        category: 'character_gems',
        isCraftable: true,
        craftingMora: 5000,
        steps: [
          makeStep({
            recipeId: 'AgnidusAgate_tier_1_to_2',
            familyId: 'AgnidusAgate',
            category: 'character_gems',
            inputItemId: 'AgnidusAgateSliver',
            inputItemName: 'Agnidus Agate Sliver',
            outputItemId: 'AgnidusAgateFragment',
            outputItemName: 'Agnidus Agate Fragment',
            count: 10,
            moraCostPerCraft: 500,
          }),
        ],
      },
    };

    return {
      requiresCrafting: true,
      hasCraftingOperations: true,
      families,
      craftingMora: 16000, // Total global mora across all 5 families
      steps: Object.values(families).flatMap((f) => f.steps),
    };
  };

  const createMultiCategoryForecast = () => {
    return {
      sameDemandCovered: true,
      families: {
        Slime: {
          familyId: 'Slime',
          isEligible: true,
          estimatedCraftingMora: 1200,
          estimatedMoraSavings: 300,
          sameDemandCovered: true,
        },
        Ballad: {
          familyId: 'Ballad',
          isEligible: true,
          estimatedCraftingMora: 2800,
          estimatedMoraSavings: 700,
          sameDemandCovered: true,
        },
        Horn: {
          familyId: 'Horn',
          isEligible: true,
          estimatedCraftingMora: 1600,
          estimatedMoraSavings: 400,
          sameDemandCovered: true,
        },
        DandelionGladiator: {
          familyId: 'DandelionGladiator',
          isEligible: true,
          estimatedCraftingMora: 3200,
          estimatedMoraSavings: 800,
          sameDemandCovered: true,
        },
        AgnidusAgate: {
          familyId: 'AgnidusAgate',
          isEligible: false, // character_gems are ineligible for bonuses
          estimatedCraftingMora: 5000,
          estimatedMoraSavings: 0,
          sameDemandCovered: true,
        },
      },
    };
  };

  // ── 1. Common Mats shows common-enemy families only ──
  it('1. Common Mats shows common-enemy families only', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Common Mats')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    expect(screen.getByTestId('crafting-family-card-Slime')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Ballad')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Horn')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-DandelionGladiator')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-AgnidusAgate')).toBeNull();
  });

  // ── 2. Talent Mats shows talent-material families only ──
  it('2. Talent Mats shows talent-material families only', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="talent"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Talents')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    expect(screen.getByTestId('crafting-family-card-Ballad')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Slime')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Horn')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-DandelionGladiator')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-AgnidusAgate')).toBeNull();
  });

  // ── 3. Elite Mats shows elite-enemy families only ──
  it('3. Elite Mats shows elite-enemy families only', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="elite_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Elite Mats')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    expect(screen.getByTestId('crafting-family-card-Horn')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Slime')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Ballad')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-DandelionGladiator')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-AgnidusAgate')).toBeNull();
  });

  // ── 4. Weapon Mats shows weapon-ascension families only ──
  it('4. Weapon Mats shows weapon-ascension families only', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="weapon_ascension"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Weapon Mats')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    expect(screen.getByTestId('crafting-family-card-DandelionGladiator')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Slime')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Ballad')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Horn')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-AgnidusAgate')).toBeNull();
  });

  // ── 5. Gems shows craftable gem families only ──
  it('5. Gems shows craftable gem families only', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="character_gem"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Gems')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    expect(screen.getByTestId('crafting-family-card-AgnidusAgate')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Slime')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Ballad')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-Horn')).toBeNull();
    expect(screen.queryByTestId('crafting-family-card-DandelionGladiator')).toBeNull();
  });

  // ── 6. Noncraftable Brilliant Diamond never receives a crafting recipe ──
  it('6. Noncraftable Brilliant Diamond never receives a crafting recipe', () => {
    const plan = createMultiCategoryPlan();
    // Add BrilliantDiamond with isCraftable: false and 0 steps
    plan.families.BrilliantDiamond = {
      familyId: 'BrilliantDiamond',
      familyName: 'Brilliant Diamond',
      category: 'character_gems',
      isCraftable: false,
      craftingMora: 0,
      steps: [],
    };

    render(
      <PlannerCraftingChecklist
        activeTab="character_gem"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
    expect(screen.getByTestId('crafting-family-card-AgnidusAgate')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-BrilliantDiamond')).toBeNull();
  });

  // ── 7. Switching categories changes the checklist contents immediately ──
  it('7. Switching categories changes the checklist contents immediately', () => {
    const plan = createMultiCategoryPlan();
    const { rerender } = render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Common Mats')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
    expect(screen.getByTestId('crafting-family-card-Slime')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Horn')).toBeNull();

    // Rerender with activeTab="elite_enhancement"
    rerender(
      <PlannerCraftingChecklist
        activeTab="elite_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText('Crafting Checklist — Elite Mats')).toBeInTheDocument();
    expect(screen.getByTestId('crafting-family-card-Horn')).toBeInTheDocument();
    expect(screen.queryByTestId('crafting-family-card-Slime')).toBeNull();
  });

  // ── 8. Checklist family count matches the selected category ──
  it('8. Checklist family count matches the selected category', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    // Filtered count is 1 family, not 5 global families
    expect(screen.getByText(/1 family • 1 recipe/i)).toBeInTheDocument();
  });

  // ── 9. Checklist recipe count matches the selected category ──
  it('9. Checklist recipe count matches the selected category', () => {
    const plan = createMultiCategoryPlan();
    // Add a second recipe to Slime
    plan.families.Slime.steps.push(
      makeStep({
        recipeId: 'Slime_tier_2_to_3',
        familyId: 'Slime',
        category: 'common_enemy',
        inputItemId: 'SlimeSecretions',
        inputItemName: 'Slime Secretions',
        outputItemId: 'SlimeConcentrate',
        outputItemName: 'Slime Concentrate',
        count: 10,
        moraCostPerCraft: 100,
      })
    );

    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(screen.getByText(/1 family • 2 recipes/i)).toBeInTheDocument();
  });

  // ── 10. Checklist Mora matches filtered family fees ──
  it('10. Checklist Mora matches filtered family fees', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    // Slime mora is 1,500. Total global is 16,000.
    // Header mora pill displays "Fee: 1500 Mora"
    expect(screen.getByText(/Fee: 1500 Mora/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
    // Reconciliation bar uses formatPlannerQuantity which formats 1500 as 1,500
    expect(screen.getAllByText('1,500 Mora')[0]).toBeInTheDocument();
  });

  // ── 11. Bonus estimated Mora uses the correct filtered forecasts ──
  it('11. Bonus estimated Mora uses the correct filtered forecasts', () => {
    const plan = createMultiCategoryPlan();
    const forecast = createMultiCategoryForecast();

    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
        craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
        bonusForecast={forecast}
      />
    );

    // Slime estimated mora is 1,200 (saves 300)
    expect(screen.getByText(/Fee: ~1200 Mora/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated savings:/i)).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
    expect(screen.getByText(/saves ~300/i)).toBeInTheDocument();
  });

  // ── 12. No unrelated category totals leak into the summary ──
  it('12. No unrelated category totals leak into the summary', () => {
    const plan = createMultiCategoryPlan();
    render(
      <PlannerCraftingChecklist
        activeTab="elite_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    // Horn mora is 2,000, 15 produced units, 1 recipe, 1 family
    expect(screen.getByText(/Fee: 2000 Mora/i)).toBeInTheDocument();
    expect(screen.getByText(/1 family • 1 recipe/i)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // 15 units produced
    // Global total 16,000 Mora or global units (95) should not appear as category total
    expect(screen.queryByText(/Fee: 16000 Mora/i)).toBeNull();
    expect(screen.queryByText(/Fee: 16,000 Mora/i)).toBeNull();
  });

  // ── 13. No required crafting in the active category hides the irrelevant checklist ──
  it('13. No required crafting in the active category hides the irrelevant checklist', () => {
    const plan = createMultiCategoryPlan();
    // Zero out Slime steps
    plan.families.Slime.steps = [];

    const { container } = render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  // ── 14. Daily Action does not show global crafting calculations ──
  it('14. Daily Action does not show global crafting calculations', () => {
    const plan = createMultiCategoryPlan();

    const { container: containerDaily } = render(
      <PlannerCraftingChecklist
        activeTab="daily_action"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );
    expect(containerDaily.firstChild).toBeNull();

    const { container: containerSpecialty } = render(
      <PlannerCraftingChecklist
        activeTab="local_specialty"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );
    expect(containerSpecialty.firstChild).toBeNull();
  });

  // ── 15. Fresh Planner mount has bonuses enabled ──
  it('15. Fresh Planner mount has bonuses enabled', () => {
    useStore.setState({
      roster: {
        Razor: {
          id: 'Razor',
          currentLevel: 1,
          targetLevel: 20,
          currentAscension: 0,
          targetAscension: 1,
          skills: {},
        },
      },
      inventory: { DamagedMask: 10 },
    });

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <Planner />
      </MemoryRouter>
    );

    const bonusToggle = screen.getByRole('button', { name: /Include Crafting Bonuses/i });
    expect(bonusToggle).toBeInTheDocument();
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('true');
  });

  // ── 16. 10% Double is selected by default ──
  it('16. 10% Double is selected by default', () => {
    useStore.setState({
      roster: {
        Razor: {
          id: 'Razor',
          currentLevel: 1,
          targetLevel: 20,
          currentAscension: 0,
          targetAscension: 1,
          skills: {},
        },
      },
      inventory: { DamagedMask: 10 },
    });

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <Planner />
      </MemoryRouter>
    );

    const doubleRadio = screen.getByRole('radio', { name: /10% Double/i });
    const refundRadio = screen.getByRole('radio', { name: /25% Refund/i });
    expect(doubleRadio.getAttribute('aria-checked')).toBe('true');
    expect(refundRadio.getAttribute('aria-checked')).toBe('false');
  });

  // ── 17. 25% Refund remains selectable ──
  it('17. 25% Refund remains selectable', () => {
    useStore.setState({
      roster: {
        Razor: {
          id: 'Razor',
          currentLevel: 1,
          targetLevel: 20,
          currentAscension: 0,
          targetAscension: 1,
          skills: {},
        },
      },
      inventory: { DamagedMask: 10 },
    });

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <Planner />
      </MemoryRouter>
    );

    const doubleRadio = screen.getByRole('radio', { name: /10% Double/i });
    const refundRadio = screen.getByRole('radio', { name: /25% Refund/i });

    fireEvent.click(refundRadio);
    expect(refundRadio.getAttribute('aria-checked')).toBe('true');
    expect(doubleRadio.getAttribute('aria-checked')).toBe('false');
  });

  // ── 18. Disabling and re-enabling bonuses works ──
  it('18. Disabling and re-enabling bonuses works', () => {
    useStore.setState({
      roster: {
        Razor: {
          id: 'Razor',
          currentLevel: 1,
          targetLevel: 20,
          currentAscension: 0,
          targetAscension: 1,
          skills: {},
        },
      },
      inventory: { DamagedMask: 10 },
    });

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <Planner />
      </MemoryRouter>
    );

    const bonusToggle = screen.getByRole('button', { name: /Include Crafting Bonuses/i });
    const refundRadio = screen.getByRole('radio', { name: /25% Refund/i });

    // Select 25% Refund
    fireEvent.click(refundRadio);
    expect(refundRadio.getAttribute('aria-checked')).toBe('true');

    // Disable
    fireEvent.click(bonusToggle);
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('radiogroup', { name: /Bonus Type/i })).toBeNull();

    // Re-enable
    fireEvent.click(bonusToggle);
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: /Bonus Type/i })).toBeInTheDocument();
    // Preserves chosen 25% Refund option
    expect(screen.getByRole('radio', { name: /25% Refund/i }).getAttribute('aria-checked')).toBe('true');
  });

  // ── 19. Raw Shortages mode does not apply bonus forecasts ──
  it('19. Raw Shortages mode does not apply bonus forecasts', () => {
    useStore.setState({
      roster: {
        Razor: {
          id: 'Razor',
          currentLevel: 1,
          targetLevel: 20,
          currentAscension: 0,
          targetAscension: 1,
          skills: {},
        },
      },
      inventory: { DamagedMask: 10 },
    });

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <Planner />
      </MemoryRouter>
    );

    // Switch to Raw mode
    const rawBtn = screen.getByRole('button', { name: /Raw Shortages/i });
    fireEvent.click(rawBtn);

    // Controls should not be rendered in raw mode
    expect(screen.queryByRole('button', { name: /Include Crafting Bonuses/i })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /Bonus Type/i })).toBeNull();
  });

  // ── 20. Active crafting session survives category switching ──
  it('20. Active crafting session survives category switching and does not leak header button into other categories', () => {
    const inv = { SlimeCondensate: 1000, SlimeSecretions: 100, SlimeConcentrate: 10, Mora: 100000 };
    const reqs = { SlimeCondensate: 100, SlimeSecretions: 150, SlimeConcentrate: 50 };

    // Start Slime session (category: common_enemy)
    act(() => {
      useCraftingSessionStore.getState().startSession({
        familyId: 'Slime',
        inventory: inv,
        grossRequirements: reqs,
        bonusType: 'double_output',
        startingMora: 100000,
      });
    });

    const plan = createMultiCategoryPlan();

    // Render with activeTab="talent" (targetCategory: talent_materials)
    let rerender;
    act(() => {
      const res = render(
        <PlannerCraftingChecklist
          activeTab="talent"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={100000}
          progressionMora={20000}
        />
      );
      rerender = res.rerender;
    });

    // Slime session is active in store, but targetCategory is talent_materials:
    // header button should NOT be rendered in Talent checklist
    expect(screen.queryByTestId('header-resume-crafting-session-btn')).toBeNull();

    // Now switch to common_enhancement
    act(() => {
      rerender(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={100000}
          progressionMora={20000}
        />
      );
    });

    // Slime session button is rendered in Common Mats checklist
    const resumeBtn = screen.getByTestId('header-resume-crafting-session-btn');
    expect(resumeBtn).toBeInTheDocument();
    expect(resumeBtn).toHaveTextContent('Slime');
  });

  // ── 21. Session transactions still use full authoritative requirements ──
  it('21. Session transactions still use full authoritative requirements', () => {
    const plan = createMultiCategoryPlan();
    const inv = { SlimeCondensate: 200, SlimeSecretions: 10, SlimeConcentrate: 0, Mora: 500000 };
    const reqs = { SlimeCondensate: 200, SlimeSecretions: 50, SlimeConcentrate: 20 };

    act(() => {
      render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          inventory={inv}
          grossRequirements={reqs}
        />
      );
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
    });
    const startBtn = screen.getByTestId('crafting-session-btn-Slime');
    act(() => {
      fireEvent.click(startBtn);
    });

    const session = useCraftingSessionStore.getState().session;
    expect(session).not.toBeNull();
    expect(session.snapshot.familyId).toBe('Slime');
    expect(session.snapshot.grossRequirements).toEqual(reqs);
    expect(session.snapshot.startingInventory.SlimeCondensate).toBe(200);
  });

  // ── 22. Dynamic To Farm / Extra remains correct ──
  it('22. Dynamic To Farm / Extra remains correct in R5', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 50, owned: 50, toFarm: 0 } },
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 30, owned: 10, toFarm: 20 } },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        steps: [],
        projectedInventory: { SlimeCondensate: 1088 },
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209, SlimeSecretions: 50, SlimeConcentrate: 10 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121, SlimeSecretions: 50, SlimeConcentrate: 30 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
      />
    );

    const extraBadge = screen.getByTestId('material-extra-SlimeCondensate');
    expect(extraBadge).toBeInTheDocument();
    expect(extraBadge.textContent).toContain('Extra');
    expect(extraBadge.textContent).toContain('+1,088');
  });

  // ── 23. Inline Have editing still works ──
  it('23. Inline Have editing still works in R5', () => {
    const familyObj = {
      familyName: 'Slime',
      type: 'mob',
      familyData: {
        familyId: 'Slime',
        tiers: [
          { id: 'SlimeCondensate', name: 'Slime Condensate', rarity: 1 },
          { id: 'SlimeSecretions', name: 'Slime Secretions', rarity: 2 },
          { id: 'SlimeConcentrate', name: 'Slime Concentrate', rarity: 3 },
        ],
      },
      items: {
        SlimeCondensate: { item: { name: 'SlimeCondensate', required: 121, owned: 1209, toFarm: 0 } },
        SlimeSecretions: { item: { name: 'SlimeSecretions', required: 50, owned: 50, toFarm: 0 } },
        SlimeConcentrate: { item: { name: 'SlimeConcentrate', required: 30, owned: 10, toFarm: 20 } },
      },
      craftingPlan: {
        familyId: 'Slime',
        isCraftable: true,
        steps: [],
      },
      neededBy: [],
    };

    const initialInv = { SlimeCondensate: 1209, SlimeSecretions: 50, SlimeConcentrate: 10 };
    useStore.setState({ inventory: initialInv });

    render(
      <DomainCard
        domainName="ENEMY: SLIME"
        familyObj={familyObj}
        accent="#4ADE80"
        globalCosts={{ SlimeCondensate: 121, SlimeSecretions: 50, SlimeConcentrate: 30 }}
        inventory={initialInv}
        craftingMode="crafting-aware"
      />
    );

    const secretionsInput = screen.getByRole('textbox', { name: /Have quantity for Slime Secretions/i });
    expect(secretionsInput).toBeInTheDocument();
    expect(secretionsInput.value).toBe('50');

    fireEvent.focus(secretionsInput);
    fireEvent.change(secretionsInput, { target: { value: '85' } });
    fireEvent.keyDown(secretionsInput, { key: 'Enter' });
    fireEvent.blur(secretionsInput);

    expect(useStore.getState().inventory.SlimeSecretions).toBe(85);
  });

  // ── 24. Compact layout does not hide crafting steps or warnings ──
  it('24. Compact layout does not hide crafting steps or warnings', () => {
    const plan = createMultiCategoryPlan();
    // Slime with 2 steps to verify multi-stage dependency note
    plan.families.Slime.steps.push(
      makeStep({
        recipeId: 'Slime_tier_2_to_3',
        familyId: 'Slime',
        category: 'common_enemy',
        inputItemId: 'SlimeSecretions',
        inputItemName: 'Slime Secretions',
        outputItemId: 'SlimeConcentrate',
        outputItemName: 'Slime Concentrate',
        count: 10,
        moraCostPerCraft: 100,
      })
    );

    render(
      <PlannerCraftingChecklist
        activeTab="common_enhancement"
        craftingPlan={plan}
        craftingMode="crafting-aware"
        userMora={500000}
        progressionMora={100000}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));

    // Verify grid alignment classes are present for compact layout
    const grid = screen.getByTestId('crafting-family-card-Slime').parentElement;
    expect(grid.className).toContain('items-start');

    // Family card has self-start and w-full
    const familyCard = screen.getByTestId('crafting-family-card-Slime');
    expect(familyCard.className).toContain('self-start');
    expect(familyCard.className).toContain('w-full');

    // Multi-stage steps are preserved and visible
    expect(screen.getByText('30×')).toBeInTheDocument();
    expect(screen.getByText('10×')).toBeInTheDocument();
    expect(screen.getAllByText(/Slime Secretions/i).length).toBe(2);
    expect(screen.getByText(/Slime Concentrate/i)).toBeInTheDocument();
  });

  // ── 25. Previously passing R1–R4 and CRAFT-D4 tests remain valid ──
  it('25. getCraftingCategoryForTab and TAB_TO_CRAFTING_CATEGORY_MAP contracts remain valid', () => {
    expect(getCraftingCategoryForTab('talent')).toBe('talent_materials');
    expect(getCraftingCategoryForTab('common_enhancement')).toBe('common_enemy');
    expect(getCraftingCategoryForTab('elite_enhancement')).toBe('elite_enemy');
    expect(getCraftingCategoryForTab('weapon_ascension')).toBe('weapon_ascension');
    expect(getCraftingCategoryForTab('character_gem')).toBe('character_gems');

    // Non-craftable tabs return null
    expect(getCraftingCategoryForTab('daily_action')).toBeNull();
    expect(getCraftingCategoryForTab('currency_exp')).toBeNull();
    expect(getCraftingCategoryForTab('normal_boss')).toBeNull();
    expect(getCraftingCategoryForTab('weekly_boss')).toBeNull();
    expect(getCraftingCategoryForTab('local_specialty')).toBeNull();
    expect(getCraftingCategoryForTab('forging_materials')).toBeNull();
    expect(getCraftingCategoryForTab('unknown_tab')).toBeNull();
    expect(getCraftingCategoryForTab(undefined)).toBeNull();

    // Tab labels
    expect(getTabLabel('talent')).toBe('Talents');
    expect(getTabLabel('common_enhancement')).toBe('Common Mats');
    expect(getTabLabel('elite_enhancement')).toBe('Elite Mats');
    expect(getTabLabel('weapon_ascension')).toBe('Weapon Mats');
    expect(getTabLabel('character_gem')).toBe('Gems');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Category Mora Accounting Correction Suite
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Category Mora Accounting Correction', () => {
    // 1. Two eligible families: Family A (guaranteed 100, estimated 70), Family B (guaranteed 100, estimated 120)
    it('1. Two eligible families: calculates net difference (200 - 190 = 10) without falsely claiming 30 saved', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 200,
        families: {
          FamA: {
            familyId: 'FamA',
            familyName: 'Family A',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamA_step',
                familyId: 'FamA',
                category: 'common_enemy',
                inputItemId: 'A1',
                inputItemName: 'A1',
                outputItemId: 'A2',
                outputItemName: 'A2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
          FamB: {
            familyId: 'FamB',
            familyName: 'Family B',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamB_step',
                familyId: 'FamB',
                category: 'common_enemy',
                inputItemId: 'B1',
                inputItemName: 'B1',
                outputItemId: 'B2',
                outputItemName: 'B2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
        },
      };

      const forecast = {
        sameDemandCovered: true,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 70,
            estimatedMoraSavings: 30, // Individual saving is 30
            sameDemandCovered: true,
          },
          FamB: {
            familyId: 'FamB',
            isEligible: true,
            estimatedCraftingMora: 120,
            estimatedMoraSavings: 0, // Fee increased by 20, savings clamped to 0
            sameDemandCovered: true,
          },
        },
      };

      render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Category estimated fee is 70 + 120 = 190
      expect(screen.getByText(/Fee: ~190 Mora/i)).toBeInTheDocument();

      // Net difference is 200 - 190 = 10 (saves ~10, NOT 30)
      expect(screen.getByText(/Estimated savings:/i)).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      // Must NOT claim 30 saved in category header
      expect(screen.queryByText(/saves ~30/i)).toBeNull();
      expect(screen.queryByText('30')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      // Reconciliation bar displays 190 Mora with net saving (saves ~10)
      expect(screen.getByText('190 Mora')).toBeInTheDocument();
      expect(screen.getByText(/saves ~10/i)).toBeInTheDocument();
      expect(screen.queryByText(/saves ~30/i)).toBeNull();
    });

    // 2. Net fee increase: Family A (guaranteed 100, estimated 140)
    it('2. Net fee increase: displays estimated higher fee and does not claim savings', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 100,
        families: {
          FamA: {
            familyId: 'FamA',
            familyName: 'Family A',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamA_step',
                familyId: 'FamA',
                category: 'common_enemy',
                inputItemId: 'A1',
                inputItemName: 'A1',
                outputItemId: 'A2',
                outputItemName: 'A2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
        },
      };

      const forecast = {
        sameDemandCovered: false,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 140,
            estimatedMoraSavings: 0,
            sameDemandCovered: false,
          },
        },
      };

      render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Estimated fee is 140 Mora
      expect(screen.getByText(/Fee: ~140 Mora/i)).toBeInTheDocument();
      // Displays higher fee indicator: +~40 Mora
      expect(screen.getByText(/Estimated higher fee:/i)).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument();
      // No claim of savings
      expect(screen.queryByText(/saves/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      expect(screen.getByText('140 Mora')).toBeInTheDocument();
      expect(screen.getByText(/\+~40 higher fee/i)).toBeInTheDocument();
    });

    // 3. Zero difference: Family A (guaranteed 100, estimated 100)
    it('3. Zero difference: does not render any difference indicator', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 100,
        families: {
          FamA: {
            familyId: 'FamA',
            familyName: 'Family A',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamA_step',
                familyId: 'FamA',
                category: 'common_enemy',
                inputItemId: 'A1',
                inputItemName: 'A1',
                outputItemId: 'A2',
                outputItemName: 'A2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
        },
      };

      const forecast = {
        sameDemandCovered: true,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 100,
            estimatedMoraSavings: 0,
            sameDemandCovered: true,
          },
        },
      };

      render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Fee is 100 Mora
      expect(screen.getByText(/Fee: ~100 Mora/i)).toBeInTheDocument();
      // No difference indicator rendered in header
      expect(screen.queryByText(/Estimated savings:/i)).toBeNull();
      expect(screen.queryByText(/Estimated fee diff:/i)).toBeNull();
      expect(screen.queryByText(/Estimated higher fee:/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      expect(screen.getAllByText('100 Mora')[0]).toBeInTheDocument();
      expect(screen.queryByText(/saves ~/i)).toBeNull();
      expect(screen.queryByText(/fee diff: ~/i)).toBeNull();
      expect(screen.queryByText(/higher fee/i)).toBeNull();
    });

    // 4. Bonus-ineligible family: falls back to guaranteed fee, zero difference
    it('4. Bonus-ineligible family: falls back to guaranteed fee with zero difference indicator', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 5000,
        families: {
          Gems: {
            familyId: 'AgnidusAgate',
            familyName: 'Agnidus Agate',
            category: 'character_gems',
            isCraftable: true,
            craftingMora: 5000,
            steps: [
              makeStep({
                recipeId: 'gem_step',
                familyId: 'AgnidusAgate',
                category: 'character_gems',
                inputItemId: 'G1',
                inputItemName: 'G1',
                outputItemId: 'G2',
                outputItemName: 'G2',
                count: 10,
                moraCostPerCraft: 500,
              }),
            ],
          },
        },
      };

      const forecast = {
        sameDemandCovered: true,
        families: {
          AgnidusAgate: {
            familyId: 'AgnidusAgate',
            isEligible: false,
            estimatedCraftingMora: 5000,
            estimatedMoraSavings: 0,
            sameDemandCovered: true,
          },
        },
      };

      render(
        <PlannerCraftingChecklist
          activeTab="character_gem"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Falls back to guaranteed 5,000 Mora
      expect(screen.getByText(/Fee: ~5000 Mora/i)).toBeInTheDocument();
      expect(screen.queryByText(/Estimated savings:/i)).toBeNull();
      expect(screen.queryByText(/Estimated higher fee:/i)).toBeNull();
    });

    // 5. Forecast missing for one family: falls back to guaranteed fee and computes net difference
    it('5. Forecast missing for one family: falls back to guaranteed fee without errors', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 150,
        families: {
          FamA: {
            familyId: 'FamA',
            familyName: 'Family A',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamA_step',
                familyId: 'FamA',
                category: 'common_enemy',
                inputItemId: 'A1',
                inputItemName: 'A1',
                outputItemId: 'A2',
                outputItemName: 'A2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
          FamB: {
            familyId: 'FamB',
            familyName: 'Family B',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 50,
            steps: [
              makeStep({
                recipeId: 'FamB_step',
                familyId: 'FamB',
                category: 'common_enemy',
                inputItemId: 'B1',
                inputItemName: 'B1',
                outputItemId: 'B2',
                outputItemName: 'B2',
                count: 5,
                moraCostPerCraft: 10,
              }),
            ],
          },
        },
      };

      // Forecast only provides FamA, FamB is missing
      const forecast = {
        sameDemandCovered: true,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 80,
            estimatedMoraSavings: 20,
            sameDemandCovered: true,
          },
        },
      };

      render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // FamA is 80, FamB falls back to 50 -> effectiveMora is 130
      expect(screen.getByText(/Fee: ~130 Mora/i)).toBeInTheDocument();
      // Guaranteed is 150, effective is 130 -> net difference is 20
      expect(screen.getByText(/Estimated savings:/i)).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      expect(screen.getByText('130 Mora')).toBeInTheDocument();
      expect(screen.getByText(/saves ~20/i)).toBeInTheDocument();
    });

    // 6. Equivalent versus additional demand distinction
    it('6. Equivalent versus additional demand: labels lower fee as saving only on equivalent demand', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 100,
        families: {
          FamA: {
            familyId: 'FamA',
            familyName: 'Family A',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 100,
            steps: [
              makeStep({
                recipeId: 'FamA_step',
                familyId: 'FamA',
                category: 'common_enemy',
                inputItemId: 'A1',
                inputItemName: 'A1',
                outputItemId: 'A2',
                outputItemName: 'A2',
                count: 10,
                moraCostPerCraft: 10,
              }),
            ],
          },
        },
      };

      // 6a. sameDemandCovered = true -> "Estimated savings" & "(saves ~30)"
      const forecastEquivalent = {
        sameDemandCovered: true,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 70,
            sameDemandCovered: true,
          },
        },
      };

      const { rerender } = render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecastEquivalent}
        />
      );

      expect(screen.getByText(/Estimated savings:/i)).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      expect(screen.getByText(/saves ~30/i)).toBeInTheDocument();

      // 6b. sameDemandCovered = false -> "Estimated fee diff" & "(fee diff: ~30)"
      const forecastAdditional = {
        sameDemandCovered: false,
        families: {
          FamA: {
            familyId: 'FamA',
            isEligible: true,
            estimatedCraftingMora: 70,
            sameDemandCovered: false,
          },
        },
      };

      rerender(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecastAdditional}
        />
      );

      expect(screen.getByText(/Estimated fee diff:/i)).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText(/fee diff: ~30/i)).toBeInTheDocument();
      expect(screen.queryByText(/saves ~30/i)).toBeNull();
    });

    // 7. Switching categories recalculates values independently
    it('7. Switching categories recalculates values independently', () => {
      const plan = {
        requiresCrafting: true,
        hasCraftingOperations: true,
        craftingMora: 2200,
        families: {
          Slime: {
            familyId: 'Slime',
            familyName: 'Slime',
            category: 'common_enemy',
            isCraftable: true,
            craftingMora: 200,
            steps: [
              makeStep({
                recipeId: 'Slime_step',
                familyId: 'Slime',
                category: 'common_enemy',
                inputItemId: 'S1',
                inputItemName: 'S1',
                outputItemId: 'S2',
                outputItemName: 'S2',
                count: 10,
                moraCostPerCraft: 20,
              }),
            ],
          },
          Horn: {
            familyId: 'Horn',
            familyName: 'Heavy Horn',
            category: 'elite_enemy',
            isCraftable: true,
            craftingMora: 2000,
            steps: [
              makeStep({
                recipeId: 'Horn_step',
                familyId: 'Horn',
                category: 'elite_enemy',
                inputItemId: 'H1',
                inputItemName: 'H1',
                outputItemId: 'H2',
                outputItemName: 'H2',
                count: 10,
                moraCostPerCraft: 200,
              }),
            ],
          },
        },
      };

      const forecast = {
        sameDemandCovered: true,
        families: {
          Slime: {
            familyId: 'Slime',
            isEligible: true,
            estimatedCraftingMora: 190, // diff: 10
            sameDemandCovered: true,
          },
          Horn: {
            familyId: 'Horn',
            isEligible: true,
            estimatedCraftingMora: 1600, // diff: 400
            sameDemandCovered: true,
          },
        },
      };

      const { rerender } = render(
        <PlannerCraftingChecklist
          activeTab="common_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Common Mats: Fee is 190, diff is 10
      expect(screen.getByText(/Fee: ~190 Mora/i)).toBeInTheDocument();
      expect(screen.getByText(/Estimated savings: ~/i)).toBeInTheDocument();
      expect(screen.queryByText(/~1600/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /View Full Checklist/i }));
      expect(screen.getByText(/saves ~10/i)).toBeInTheDocument();
      expect(screen.queryByText(/saves ~400/i)).toBeNull();

      // Switch to Elite Mats
      rerender(
        <PlannerCraftingChecklist
          activeTab="elite_enhancement"
          craftingPlan={plan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={100000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={forecast}
        />
      );

      // Elite Mats: Fee is 1600, diff is 400
      expect(screen.getByText(/Fee: ~1600 Mora/i)).toBeInTheDocument();
      expect(screen.getByText(/saves ~400/i)).toBeInTheDocument();
      expect(screen.queryByText(/~190/)).toBeNull();
      expect(screen.queryByText(/saves ~10/i)).toBeNull();
    });
  });
});

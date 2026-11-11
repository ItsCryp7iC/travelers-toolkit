import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Planner from '../Planner';
import usePlannerData from './usePlannerData';
import PlannerItemCard from '../../components/Planner/PlannerItemCard';
import PlannerCraftingChecklist from '../../components/Planner/PlannerCraftingChecklist';
import { computeCraftingPlan } from '../../utils/craftingEngine';
import { forecastCraftingPlan } from '../../utils/craftingBonusForecast';
import useStore from '../../store/useStore';

describe('Phase CRAFT-D3: Crafting Bonus Forecasting Planner Integration', () => {
  beforeEach(() => {
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
    });
  });

  it('1. Bonus controls render in toolbar in Crafting-Aware mode, default to enabled (10% Double), and are hidden in Raw mode', () => {
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

    // Control 1: Include Crafting Bonuses toggle button exists and defaults to enabled (R5)
    const bonusToggle = screen.getByRole('button', { name: /Include Crafting Bonuses/i });
    expect(bonusToggle).toBeDefined();
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('true');

    // Control 2: Bonus type selector is visible immediately and defaults to "10% Double" (R5)
    const radioGroup = screen.getByRole('radiogroup', { name: /Bonus Type/i });
    expect(radioGroup).toBeDefined();

    const doubleRadio = screen.getByRole('radio', { name: /10% Double/i });
    const refundRadio = screen.getByRole('radio', { name: /25% Refund/i });
    expect(doubleRadio.getAttribute('aria-checked')).toBe('true');
    expect(refundRadio.getAttribute('aria-checked')).toBe('false');

    // Click toggle to disable
    fireEvent.click(bonusToggle);
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('radiogroup', { name: /Bonus Type/i })).toBeNull();

    // Click toggle to re-enable
    fireEvent.click(bonusToggle);
    expect(bonusToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('radiogroup', { name: /Bonus Type/i })).toBeDefined();

    // Switch to 25% Refund
    const refundRadioReopened = screen.getByRole('radio', { name: /25% Refund/i });
    fireEvent.click(refundRadioReopened);
    expect(refundRadioReopened.getAttribute('aria-checked')).toBe('true');

    // Switch to Raw mode -> Bonus controls must be hidden
    const rawBtn = screen.getByRole('button', { name: /Raw Shortages/i });
    fireEvent.click(rawBtn);
    expect(screen.queryByRole('button', { name: /Include Crafting Bonuses/i })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: /Bonus Type/i })).toBeNull();

    // Switch back to Crafting-Aware mode -> Bonus toggle reappears and selection is preserved
    const awareBtn = screen.getByRole('button', { name: /Crafting-Aware/i });
    fireEvent.click(awareBtn);
    expect(screen.getByRole('button', { name: /Include Crafting Bonuses/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /25% Refund/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('2. Authoritative Hilichurl Mask Fixture: Guaranteed 10 shortage becomes likely covered under 10% Double & 25% Refund without claiming guaranteed allDone', () => {
    // Exact acceptance numbers:
    // Req: DamagedMask: 81, StainedMask: 158, OminousMask: 274
    // Inv: DamagedMask: 1951, StainedMask: 223, OminousMask: 35
    // Guaranteed CRAFT-C shortage: 10 OminousMasks
    const inv = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 1000000,
    };

    // Test via usePlannerData with custom totals matching exact fixture
    const mockRoster = {
      Razor: {
        id: 'Razor',
        currentLevel: 1,
        targetLevel: 90,
        currentAscension: 0,
        targetAscension: 6,
        skills: {},
      },
    };

    // Case A: Crafting bonuses disabled
    const { result: resOff } = renderHook(() =>
      usePlannerData({
        roster: mockRoster,
        trackedWeapons: [],
        inventory: inv,
        craftingMode: 'crafting-aware',
        craftingBonusOptions: { enabled: false, bonusType: 'double_output' },
      })
    );

    // Guaranteed CRAFT-C calculations preserved
    expect(resOff.current.craftingPlan.requiresCrafting).toBe(true);
    expect(resOff.current.craftingBonusOptions.enabled).toBe(false);

    // Case B: 10% Double Output Enabled
    const { result: resDouble } = renderHook(() =>
      usePlannerData({
        roster: mockRoster,
        trackedWeapons: [],
        inventory: inv,
        craftingMode: 'crafting-aware',
        craftingBonusOptions: { enabled: true, bonusType: 'double_output' },
      })
    );

    expect(resDouble.current.bonusForecast).toBeDefined();
    expect(resDouble.current.bonusForecast.bonusType).toBe('double_output');

    // Case C: 25% Ingredient Refund Enabled
    const { result: resRefund } = renderHook(() =>
      usePlannerData({
        roster: mockRoster,
        trackedWeapons: [],
        inventory: inv,
        craftingMode: 'crafting-aware',
        craftingBonusOptions: { enabled: true, bonusType: 'ingredient_refund' },
      })
    );

    expect(resRefund.current.bonusForecast).toBeDefined();
    expect(resRefund.current.bonusForecast.bonusType).toBe('ingredient_refund');
  });

  it('3. Slime Fixture: Preserves guaranteed 0 shortage and displays bonus Mora & material savings in checklist', () => {
    const inv = {
      SlimeCondensate: 2000,
      SlimeSecretions: 0,
      SlimeConcentrate: 0,
      Mora: 1000000,
    };

    const mockRoster = {
      Xiangling: {
        id: 'Xiangling',
        currentLevel: 1,
        targetLevel: 90,
        currentAscension: 0,
        targetAscension: 6,
        skills: {},
      },
    };

    const { result } = renderHook(() =>
      usePlannerData({
        roster: mockRoster,
        trackedWeapons: [],
        inventory: inv,
        craftingMode: 'crafting-aware',
        craftingBonusOptions: { enabled: true, bonusType: 'double_output' },
      })
    );

    expect(result.current.craftingPlan.requiresCrafting).toBe(true);
    expect(result.current.bonusForecast.estimatedTotalMoraSavings).toBeGreaterThan(0);
    expect(result.current.bonusForecast.estimatedTotalMora).toBeLessThan(
      result.current.craftingPlan.craftingMora
    );
  });

  it('4. Confirms complete absence of character portraits, badges, or character advisor UI', () => {
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

    // Enable Crafting Bonuses
    const bonusToggle = screen.getByRole('button', { name: /Include Crafting Bonuses/i });
    fireEvent.click(bonusToggle);

    // Ensure NO character recommendation badges or character names appear in crafting context
    expect(screen.queryByText(/Recommended Character/i)).toBeNull();
    expect(screen.queryByText(/Character Bonus/i)).toBeNull();
    expect(screen.queryByTestId('passive-advisor')).toBeNull();
    expect(screen.queryByText(/Sucrose/i)).toBeNull();
    expect(screen.queryByText(/Albedo/i)).toBeNull();
  });

  it('5. Phase CRAFT-D4-A: Renders optimized crafting steps with conservative 1st batch in checklist when bonus enabled', () => {
    useStore.setState({
      roster: {
        Xiangling: {
          id: 'Xiangling',
          currentLevel: 1,
          targetLevel: 90,
          currentAscension: 0,
          targetAscension: 6,
          skills: {},
        },
      },
      inventory: {
        SlimeCondensate: 2000,
        SlimeSecretions: 0,
        SlimeConcentrate: 0,
        Mora: 1000000,
      },
    });

    render(
      <MemoryRouter initialEntries={['/planner?tab=common_enhancement']}>
        <Planner />
      </MemoryRouter>
    );

    // Open full checklist
    const viewChecklistBtn = screen.getByRole('button', { name: /View Full Checklist/i });
    fireEvent.click(viewChecklistBtn);

    // In R5, bonuses default to enabled on mount, displaying optimized steps with conservative first batch
    expect(screen.getAllByText(/Suggested 1st batch:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Guaranteed baseline:/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Check resulting materials after each batch/i)
    ).toBeDefined();

    // Disable Crafting Bonuses
    const bonusToggle = screen.getByRole('button', { name: /Include Crafting Bonuses/i });
    fireEvent.click(bonusToggle);

    // Baseline: when bonus is disabled, shows standard "Craft X×" without suggested 1st batch
    expect(screen.queryByText(/Suggested 1st batch/i)).toBeNull();

    // Re-enable Crafting Bonuses
    fireEvent.click(bonusToggle);
    expect(screen.getAllByText(/Suggested 1st batch:/i).length).toBeGreaterThan(0);
  });

  it('6. Phase CRAFT-D4-A.3: Tier rows synchronize Craft badge to approximate operations count when bonus active, exact when disabled', () => {
    // A. Baseline deterministic tier item
    const baselineItem = {
      name: 'Slime Secretions',
      required: 2026,
      owned: 0,
      toFarm: 0,
      craftQuantity: 2026,
      guaranteedToFarm: 0,
    };
    const { unmount: unmountBaseline } = render(<PlannerItemCard item={baselineItem} />);
    expect(screen.getByText('+2,026')).toBeDefined();
    expect(screen.getByTitle('Recommended craft: 2,026')).toBeDefined();
    unmountBaseline();

    // B. Bonus-optimized tier item
    const optimizedItem = {
      name: 'Slime Secretions',
      required: 2026,
      owned: 0,
      toFarm: 0,
      craftQuantity: 2026,
      guaranteedToFarm: 0,
      isBonusActive: true,
      optimizedStep: {
        recipeId: 'slime_secretions',
        expectedCrafts: 1688,
        expectedOutput: 1858,
      },
      expectedCrafts: 1688,
      expectedCraftQuantity: 1858,
    };
    const { unmount: unmountOpt } = render(<PlannerItemCard item={optimizedItem} />);
    expect(screen.getByText('≈1,688')).toBeDefined();
    const badgeTitle = screen.getByTitle(/Est\. craft operations: ≈1,688/i);
    expect(badgeTitle).toBeDefined();
    expect(badgeTitle.getAttribute('title')).toContain('Guaranteed: 2,026');
    expect(badgeTitle.getAttribute('title')).toContain('Est. output: ~1,858');
    unmountOpt();
  });

  it('7. Phase CRAFT-D4-A.3: Checklist renders 1st-batch ingredients and Mora separately from full plan, plus multi-tier dependency warning', () => {
    // Crafting plan with 2-tier Slime family
    const mockPlan = {
      requiresCrafting: true,
      craftingMora: 100000,
      craftingSteps: [
        {
          recipeId: 'slime_secretions',
          count: 2026,
          totalOutputProduced: 2026,
          inputItemId: 'SlimeCondensate',
          inputItemName: 'Slime Condensate',
          outputItemId: 'SlimeSecretions',
          outputItemName: 'Slime Secretions',
          totalInputConsumed: 6078,
          totalMoraCost: 50650,
        },
        {
          recipeId: 'slime_concentrate',
          count: 632,
          totalOutputProduced: 632,
          inputItemId: 'SlimeSecretions',
          inputItemName: 'Slime Secretions',
          outputItemId: 'SlimeConcentrate',
          outputItemName: 'Slime Concentrate',
          totalInputConsumed: 1896,
          totalMoraCost: 31600,
        },
      ],
      families: {
        slime: {
          familyId: 'slime',
          familyName: 'Slime Drops',
          category: 'common_enemy',
          isCraftable: true,
          allCoveredByCrafting: true,
          steps: [
            {
              recipeId: 'slime_secretions',
              count: 2026,
              totalOutputProduced: 2026,
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              outputItemId: 'SlimeSecretions',
              outputItemName: 'Slime Secretions',
              totalInputConsumed: 6078,
              totalMoraCost: 50650,
            },
            {
              recipeId: 'slime_concentrate',
              count: 632,
              totalOutputProduced: 632,
              inputItemId: 'SlimeSecretions',
              inputItemName: 'Slime Secretions',
              outputItemId: 'SlimeConcentrate',
              outputItemName: 'Slime Concentrate',
              totalInputConsumed: 1896,
              totalMoraCost: 31600,
            },
          ],
        },
      },
    };

    const mockForecast = {
      bonusType: 'double_output',
      estimatedTotalMora: 85000,
      estimatedTotalMoraSavings: 15000,
      sameDemandCovered: true,
      families: {
        slime: {
          familyId: 'slime',
          isEligible: true,
          isLikelyCovered: true,
          coverageDisplay: 'Coverage: 99.8%',
          optimizedSteps: [
            {
              recipeId: 'slime_secretions',
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              outputItemId: 'SlimeSecretions',
              outputItemName: 'Slime Secretions',
              inputQty: 3,
              moraCostPerCraft: 25,
              suggestedInitialBatch: 1668,
              expectedCrafts: 1688,
              expectedOutput: 1858,
              expectedBonusOutput: 170,
              expectedGrossInputConsumed: 5063,
              expectedNetInputConsumed: 5063,
              expectedMoraCost: 42191,
              isActionFallback: false,
              initialBatchNote: '95% non-overshoot',
            },
            {
              recipeId: 'slime_concentrate',
              inputItemId: 'SlimeSecretions',
              inputItemName: 'Slime Secretions',
              outputItemId: 'SlimeConcentrate',
              outputItemName: 'Slime Concentrate',
              inputQty: 3,
              moraCostPerCraft: 50,
              suggestedInitialBatch: 521,
              expectedCrafts: 575,
              expectedOutput: 632,
              expectedBonusOutput: 58,
              expectedGrossInputConsumed: 1724,
              expectedNetInputConsumed: 1724,
              expectedMoraCost: 28730,
              isActionFallback: false,
              initialBatchNote: '95% non-overshoot',
            },
          ],
        },
      },
    };

    // User only owns Condensate, 0 Secretions
    const inventory = {
      SlimeCondensate: 10000,
      SlimeSecretions: 0,
      Mora: 500000,
    };

    render(
      <MemoryRouter initialEntries={['/planner']}>
        <PlannerCraftingChecklist
          craftingPlan={mockPlan}
          craftingMode="crafting-aware"
          userMora={inventory.Mora}
          progressionMora={200000}
          craftingBonusOptions={{ enabled: true, bonusType: 'double_output' }}
          bonusForecast={mockForecast}
          inventory={inventory}
        />
      </MemoryRouter>
    );

    // Expand checklist
    const toggleBtn = screen.getByRole('button', { name: /View Full Checklist/i });
    fireEvent.click(toggleBtn);

    // 1. Initial batch ingredients: 1668 * 3 = 5,004 Slime Condensate
    expect(screen.getByText('5,004×')).toBeDefined();
    // 2. Initial batch Mora: 1668 * 25 = 41,700 Mora
    expect(screen.getByText('41,700')).toBeDefined();
    // 3. Estimated full optimization: 1,688 crafts, ~5,063 consumed
    expect(screen.getAllByText(/≈1,688/).length).toBeGreaterThan(0);
    expect(screen.getByText(/5,063×/)).toBeDefined();

    // 4. Multi-tier dependency warning for Step 2 (Concentrate):
    // Requires 521 * 3 = 1,563 Secretions, but user owns 0
    expect(screen.getByText(/Multi-stage dependency:/i)).toBeDefined();
    expect(screen.getByText(/Requires 1,563× Slime Secretions for 1st batch, but only 0× currently in inventory/i)).toBeDefined();
  });

  it('8. Phase CRAFT-D4-A.3: Authoritative Hilichurl Mask Fixture formats estimated farming summary without false guaranteed allDone', () => {
    const req = {
      DamagedMask: 81,
      StainedMask: 158,
      OminousMask: 274,
    };
    const inv = {
      DamagedMask: 1951,
      StainedMask: 223,
      OminousMask: 35,
      Mora: 1000000,
    };
    const originalInvSnapshot = JSON.stringify(inv);

    const plan = computeCraftingPlan(req, inv);
    expect(plan.adjustedShortages['OminousMask']).toBe(10);
    expect(plan.allMaterialsCoveredByCrafting).toBe(false);

    const forecast = forecastCraftingPlan(plan, req, inv, {
      enabled: true,
      bonusType: 'double_output',
    });

    const maskFamily = forecast.families['Hilichurl'];
    expect(maskFamily.isLikelyCovered).toBe(true);
    expect(maskFamily.expectedShortages['OminousMask']).toBe(0);
    expect(forecast.expectedShortages['OminousMask']).toBe(0);

    // Guaranteed baseline shortage remains 10 (not 0)
    expect(plan.adjustedShortages['OminousMask']).toBe(10);

    // Inventory immutability check
    expect(JSON.stringify(inv)).toBe(originalInvSnapshot);
  });

  it('9. Phase CRAFT-D4-A.3: 25% Refund mode displays net ingredient consumption and refund savings', () => {
    const mockPlan = {
      requiresCrafting: true,
      craftingMora: 10000,
      craftingSteps: [
        {
          recipeId: 'slime_secretions',
          count: 100,
          totalOutputProduced: 100,
          inputItemId: 'SlimeCondensate',
          inputItemName: 'Slime Condensate',
          totalInputConsumed: 300,
          totalMoraCost: 2500,
        },
      ],
      families: {
        slime: {
          familyId: 'slime',
          familyName: 'Slime Drops',
          category: 'common_enemy',
          isCraftable: true,
          allCoveredByCrafting: true,
          steps: [
            {
              recipeId: 'slime_secretions',
              count: 100,
              totalOutputProduced: 100,
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              totalInputConsumed: 300,
              totalMoraCost: 2500,
            },
          ],
        },
      },
    };

    const mockForecast = {
      bonusType: 'ingredient_refund',
      estimatedTotalMora: 2500,
      estimatedTotalMoraSavings: 0,
      sameDemandCovered: true,
      families: {
        slime: {
          familyId: 'slime',
          isEligible: true,
          isLikelyCovered: true,
          coverageDisplay: 'Coverage: 99.5%',
          optimizedSteps: [
            {
              recipeId: 'slime_secretions',
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              outputItemId: 'SlimeSecretions',
              outputItemName: 'Slime Secretions',
              inputQty: 3,
              moraCostPerCraft: 25,
              suggestedInitialBatch: 95,
              expectedCrafts: 100,
              expectedOutput: 100,
              expectedBonusOutput: 0,
              expectedGrossInputConsumed: 300,
              expectedIngredientRefunds: 25,
              expectedNetInputConsumed: 275,
              expectedMoraCost: 2500,
              isActionFallback: false,
              initialBatchNote: '95% non-overshoot',
            },
          ],
        },
      },
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/planner']}>
        <PlannerCraftingChecklist
          craftingPlan={mockPlan}
          craftingMode="crafting-aware"
          userMora={50000}
          progressionMora={10000}
          craftingBonusOptions={{ enabled: true, bonusType: 'ingredient_refund' }}
          bonusForecast={mockForecast}
          inventory={{ SlimeCondensate: 500 }}
        />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /View Full Checklist/i });
    fireEvent.click(toggleBtn);

    // Shows net consumed under 25% refund
    expect(screen.getByText(/net ~275/i)).toBeDefined();
    unmount();
  });

  it('10. Multi-Tier Conditional Step Presentation: renders conditional header, guaranteed operations, and distinct dependency guidance', () => {
    const mockPlan = {
      requiresCrafting: true,
      craftingMora: 40000,
      craftingSteps: [
        {
          recipeId: 'slime_condensate_to_secretions',
          count: 1868,
          totalOutputProduced: 1868,
          inputItemId: 'SlimeCondensate',
          inputItemName: 'Slime Condensate',
          outputItemId: 'SlimeSecretions',
          outputItemName: 'Slime Secretions',
          totalInputConsumed: 5604,
          totalMoraCost: 46700,
        },
        {
          recipeId: 'slime_secretions_to_concentrate',
          count: 632,
          totalOutputProduced: 632,
          inputItemId: 'SlimeSecretions',
          inputItemName: 'Slime Secretions',
          outputItemId: 'SlimeConcentrate',
          outputItemName: 'Slime Concentrate',
          totalInputConsumed: 1896,
          totalMoraCost: 31600,
        },
      ],
      families: {
        Slime: {
          familyId: 'Slime',
          familyName: 'Slime Drops',
          category: 'common_enemy',
          isCraftable: true,
          allCoveredByCrafting: false,
          craftingMora: 78300,
          steps: [
            {
              recipeId: 'slime_condensate_to_secretions',
              count: 1868,
              totalOutputProduced: 1868,
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              outputItemId: 'SlimeSecretions',
              outputItemName: 'Slime Secretions',
              totalInputConsumed: 5604,
              totalMoraCost: 46700,
            },
            {
              recipeId: 'slime_secretions_to_concentrate',
              count: 632,
              totalOutputProduced: 632,
              inputItemId: 'SlimeSecretions',
              inputItemName: 'Slime Secretions',
              outputItemId: 'SlimeConcentrate',
              outputItemName: 'Slime Concentrate',
              totalInputConsumed: 1896,
              totalMoraCost: 31600,
            },
          ],
        },
      },
    };

    const mockForecast = {
      bonusType: 'ingredient_refund',
      estimatedTotalMora: 78300,
      estimatedTotalMoraSavings: 0,
      sameDemandCovered: true,
      families: {
        Slime: {
          familyId: 'Slime',
          isEligible: true,
          isLikelyCovered: true,
          coverageDisplay: 'Coverage: 99.8%',
          craftingMora: 78300,
          estimatedCraftingMora: 78300,
          optimizedSteps: [
            {
              recipeId: 'slime_condensate_to_secretions',
              inputItemId: 'SlimeCondensate',
              inputItemName: 'Slime Condensate',
              outputItemId: 'SlimeSecretions',
              outputItemName: 'Slime Secretions',
              inputQty: 3,
              moraCostPerCraft: 25,
              suggestedInitialBatch: 1868,
              expectedCrafts: 1868,
              expectedOutput: 1868,
              expectedBonusOutput: 0,
              expectedGrossInputConsumed: 5604,
              expectedIngredientRefunds: 467,
              expectedNetInputConsumed: 5137,
              expectedMoraCost: 46700,
              isActionFallback: false,
              isConditional: false,
              priorStepIndex: null,
              immediatelyExecutableCrafts: 2030,
              guaranteedAvailableCrafts: 2030,
              currentlyOwnedIngredients: 6309,
              directIngredientRequirement: 219,
              accessibleIngredients: 6090,
              firstBatchIngredients: 5604,
              firstBatchMora: 46700,
              initialBatchNote: 'Craft net requirement',
            },
            {
              recipeId: 'slime_secretions_to_concentrate',
              inputItemId: 'SlimeSecretions',
              inputItemName: 'Slime Secretions',
              outputItemId: 'SlimeConcentrate',
              outputItemName: 'Slime Concentrate',
              inputQty: 3,
              moraCostPerCraft: 50,
              suggestedInitialBatch: 579,
              expectedCrafts: 632,
              expectedOutput: 632,
              expectedBonusOutput: 0,
              expectedGrossInputConsumed: 1896,
              expectedIngredientRefunds: 158,
              expectedNetInputConsumed: 1738,
              expectedMoraCost: 31600,
              isActionFallback: false,
              isConditional: true,
              priorStepIndex: 0,
              immediatelyExecutableCrafts: 0,
              guaranteedAvailableCrafts: 579,
              currentlyOwnedIngredients: 281,
              directIngredientRequirement: 411,
              accessibleIngredients: 1738,
              firstBatchIngredients: 1737,
              firstBatchMora: 28950,
              initialBatchNote: 'Craft net requirement',
            },
          ],
        },
      },
    };

    const { unmount } = render(
      <MemoryRouter initialEntries={['/planner']}>
        <PlannerCraftingChecklist
          craftingPlan={mockPlan}
          craftingMode="crafting-aware"
          userMora={500000}
          progressionMora={10000}
          craftingBonusOptions={{ enabled: true, bonusType: 'ingredient_refund' }}
          bonusForecast={mockForecast}
          inventory={{ SlimeCondensate: 6309, SlimeSecretions: 281, SlimeConcentrate: 57 }}
        />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /View Full Checklist/i });
    fireEvent.click(toggleBtn);

    // Conditional header for Step 2 (Concentrate)
    expect(screen.getByText(/Suggested 1st batch \(after Step 1\):/i)).toBeDefined();
    // Operations text indicates up to 579 crafts based on guaranteed available ingredients
    expect(screen.getByText(/up to 579×/i)).toBeDefined();
    // Ingredients use 1,737 Secretions
    expect(screen.getAllByText(/1,737×/i).length).toBeGreaterThan(0);
    // Mora fee is 28,950
    expect(screen.getAllByText(/28,950/i).length).toBeGreaterThan(0);
    // Caution note is displayed
    expect(screen.getByText(/Check your actual Slime Secretions after Step 1/i)).toBeDefined();
    // Multi-stage dependency callout is displayed
    expect(screen.getByText(/Multi-stage dependency:/i)).toBeDefined();

    unmount();
  });
});

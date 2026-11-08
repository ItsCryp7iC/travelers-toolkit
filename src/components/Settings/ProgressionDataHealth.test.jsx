import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProgressionDataHealth from './ProgressionDataHealth';
import useStore from '../../store/useStore';
import {
  diagnoseProgressionState,
} from '../../utils/progressionContracts';

// Helper for deep freezing objects to guarantee immutability
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (
      obj[prop] !== null &&
      (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
      !Object.isFrozen(obj[prop])
    ) {
      deepFreeze(obj[prop]);
    }
  });
  return obj;
}

describe('Phase C2B.2B.1 — Progression Data Health Inspection', () => {
  beforeEach(() => {
    // Reset store to a clean state before each test
    useStore.setState({
      roster: {},
      trackedWeapons: [],
    });
  });

  // 1. Valid roster returning zero issues
  it('Scenario 1: Valid roster and weapons return zero issues and a clean status banner', () => {
    const cleanRoster = {
      'Raiden Shogun': {
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
      Amber: {
        level: 20,
        ascension: 1,
        targetLevel: 50,
        targetAscension: 2,
      },
    };
    const cleanWeapons = [
      {
        id: 'w-clean-1',
        weaponName: 'Engulfing Lightning',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        rarity: 5,
      },
    ];

    render(
      <ProgressionDataHealth
        roster={cleanRoster}
        trackedWeapons={cleanWeapons}
      />
    );

    // Clean status elements
    expect(screen.getByText(/✓ Healthy/i)).toBeInTheDocument();
    expect(screen.getByText(/All progression data is healthy/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No invalid level or ascension states detected/i)
    ).toBeInTheDocument();

    // Summary counts (3 scanned, 3 valid)
    const count3Elements = screen.getAllByText('3');
    expect(count3Elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('100% passing')).toBeInTheDocument();
    const count0Elements = screen.getAllByText('0');
    expect(count0Elements.length).toBeGreaterThanOrEqual(1);
  });

  // 2. Invalid character progression
  it('Scenario 2: Invalid character progression (Kuki Shinobu Lv 1 A6) is flagged with complete details', () => {
    const corruptedRoster = {
      'Kuki Shinobu': {
        level: 1,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    };

    render(
      <ProgressionDataHealth
        roster={corruptedRoster}
        trackedWeapons={[]}
      />
    );

    // Overall status indicates issue detected
    expect(screen.getByText(/⚠️ 1 Issue/i)).toBeInTheDocument();
    expect(screen.getAllByText('Kuki Shinobu')[0]).toBeInTheDocument();
    expect(screen.getByText('👤 Character')).toBeInTheDocument();

    // Progression summary line
    expect(screen.getByText(/Current:/i)).toBeInTheDocument();
    expect(screen.getByText(/Level 1 \/ Ascension 6/i)).toBeInTheDocument();

    // Expand details
    const expandBtn = screen.getByRole('button', { name: /Kuki Shinobu/i });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandBtn);
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');

    // Violated rule & bounds
    expect(screen.getByText(/Ascension 6 is invalid for level 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Allowed ascensions for Level 1:/i)).toBeInTheDocument();
    expect(screen.getByText(/Valid level range for Ascension 6:/i)).toBeInTheDocument();
    expect(screen.getByText(/80–100/i)).toBeInTheDocument();

    // Diagnostic suggestion (not applied)
    expect(screen.getByText(/Diagnostic Suggestion \(Not Applied\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Level 1 \/ Ascension 0/i).length).toBeGreaterThanOrEqual(1);
  });

  // 3. Invalid weapon progression
  it('Scenario 3: Invalid weapon progression (Favonius Sword Lv 20 A3) is flagged with complete details', () => {
    const corruptedWeapons = [
      {
        id: 'w-favonius-uuid-001',
        weaponName: 'Favonius Sword',
        level: 20,
        ascension: 3,
        targetLevel: 90,
        targetAscension: 6,
        rarity: 4,
      },
    ];

    render(
      <ProgressionDataHealth
        roster={{}}
        trackedWeapons={corruptedWeapons}
      />
    );

    expect(screen.getByText(/Favonius Sword/i)).toBeInTheDocument();
    expect(screen.getByText('🗡️ Weapon')).toBeInTheDocument();
    expect(screen.getAllByText(/w-favonius-uuid-001/i).length).toBeGreaterThanOrEqual(1);

    // Expand
    const expandBtn = screen.getByRole('button', { name: /Favonius Sword/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText(/Ascension 3 is invalid for level 20/i)).toBeInTheDocument();
    expect(screen.getByText(/Scope: current Progression/i)).toBeInTheDocument();
  });

  // 4. Mixed valid and invalid records
  it('Scenario 4: Mixed valid and invalid records are partitioned accurately with category filtering', () => {
    const mixedRoster = {
      'Valid Jean': { level: 90, ascension: 6, targetLevel: 90, targetAscension: 6 },
      'Invalid Aloy': { level: 40, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    const mixedWeapons = [
      {
        id: 'w-valid',
        weaponName: 'Amenoma Kageuchi',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
        rarity: 4,
      },
      {
        id: 'w-invalid',
        weaponName: 'Dull Blade',
        level: 1,
        ascension: 4,
        targetLevel: 70,
        targetAscension: 4,
        rarity: 1,
      },
    ];

    render(
      <ProgressionDataHealth
        roster={mixedRoster}
        trackedWeapons={mixedWeapons}
      />
    );

    // Scanned: 4 total (2 chars • 2 weapons)
    expect(screen.getByText('4')).toBeInTheDocument();
    // Valid: 2, Invalid: 2
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

    // Filter controls
    const allTab = screen.getByRole('tab', { name: /All \(2\)/i });
    const charsTab = screen.getByRole('tab', { name: /Characters \(1\)/i });
    const weaponsTab = screen.getByRole('tab', { name: /Weapons \(1\)/i });

    expect(screen.getByText('Invalid Aloy')).toBeInTheDocument();
    expect(screen.getByText('Dull Blade')).toBeInTheDocument();

    // Filter by Characters
    fireEvent.click(charsTab);
    expect(screen.getByText('Invalid Aloy')).toBeInTheDocument();
    expect(screen.queryByText('Dull Blade')).not.toBeInTheDocument();

    // Filter by Weapons
    fireEvent.click(weaponsTab);
    expect(screen.queryByText('Invalid Aloy')).not.toBeInTheDocument();
    expect(screen.getByText('Dull Blade')).toBeInTheDocument();

    // Filter by All
    fireEvent.click(allTab);
    expect(screen.getByText('Invalid Aloy')).toBeInTheDocument();
    expect(screen.getByText('Dull Blade')).toBeInTheDocument();
  });

  // 5. Missing or malformed values
  it('Scenario 5: Missing or malformed values are handled gracefully without exceptions', () => {
    const malformedRoster = {
      MissingFieldsChar: {
        level: null,
        ascension: null,
      },
      NonNumberChar: {
        level: 'invalid-string',
        ascension: 2,
      },
      NullEntryChar: null,
    };

    const malformedWeapons = [
      null,
      {
        id: 'w-malformed',
        weaponName: 'Broken Weapon',
        level: NaN,
        ascension: undefined,
      },
    ];

    expect(() => {
      render(
        <ProgressionDataHealth
          roster={malformedRoster}
          trackedWeapons={malformedWeapons}
        />
      );
    }).not.toThrow();

    // Verify issues are captured
    expect(screen.getAllByText(/MissingFieldsChar/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/NonNumberChar/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/NullEntryChar/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Broken Weapon/i).length).toBeGreaterThanOrEqual(1);
  });

  // 6. Ambiguous milestone states
  it('Scenario 6: Ambiguous milestone states require human input and do not assume intent', () => {
    const ambiguousRoster = {
      Sayu: {
        level: 20,
        ascension: 3,
        targetLevel: 90,
        targetAscension: 6,
      },
    };

    render(
      <ProgressionDataHealth
        roster={ambiguousRoster}
        trackedWeapons={[]}
      />
    );

    expect(screen.getByText(/⚠️ Review Required/i)).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /Sayu/i });
    fireEvent.click(expandBtn);

    expect(
      screen.getByText(/Ambiguous Intent — User Review Required/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Multiple valid states exist or intent cannot be assumed/i)
    ).toBeInTheDocument();
  });

  // 7. Duplicate weapon instances with distinct UUIDs
  it('Scenario 7: Duplicate weapon instances with distinct UUIDs are diagnosed accurately', () => {
    const duplicateWeapons = [
      {
        id: 'dup-uuid-1234',
        weaponName: 'Dragon\'s Bane',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
      {
        id: 'dup-uuid-1234',
        weaponName: 'Staff of Homa',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    ];

    const report = diagnoseProgressionState({
      roster: {},
      trackedWeapons: duplicateWeapons,
    });

    expect(report.isValid).toBe(false);
    expect(report.weaponIssuesCount).toBeGreaterThanOrEqual(1);

    const dupIssue = report.weaponIssues.find((i) => i.scope === 'identity');
    expect(dupIssue).toBeDefined();
    expect(dupIssue.reason).toContain('Duplicate tracked weapon UUID: dup-uuid-1234');

    // Distinct UUID weapons do not trigger identity issue
    const distinctWeapons = [
      {
        id: 'uuid-distinct-1',
        weaponName: 'Dragon\'s Bane',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
      {
        id: 'uuid-distinct-2',
        weaponName: 'Staff of Homa',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    ];

    const cleanReport = diagnoseProgressionState({
      roster: {},
      trackedWeapons: distinctWeapons,
    });
    expect(cleanReport.weaponIssues.find((i) => i.scope === 'identity')).toBeUndefined();
  });

  // 8. Scanning does not mutate source objects
  it('Scenario 8: Scanning does not mutate source objects (guaranteed immutability via deep freeze)', () => {
    const rawRoster = {
      'Kuki Shinobu': {
        level: 1,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    };
    const rawWeapons = [
      {
        id: 'w-frozen-1',
        weaponName: 'Favonius Lance',
        level: 20,
        ascension: 4,
        targetLevel: 80,
        targetAscension: 5,
      },
    ];

    const frozenRoster = deepFreeze(rawRoster);
    const frozenWeapons = deepFreeze(rawWeapons);

    // Pure diagnostic execution must not throw
    expect(() => {
      diagnoseProgressionState({
        roster: frozenRoster,
        trackedWeapons: frozenWeapons,
      });
    }).not.toThrow();

    // UI render and scan button click must not throw
    expect(() => {
      render(
        <ProgressionDataHealth
          roster={frozenRoster}
          trackedWeapons={frozenWeapons}
        />
      );
      const scanBtn = screen.getByRole('button', { name: /Scan Progression Data/i });
      fireEvent.click(scanBtn);
    }).not.toThrow();

    // Deep equality verification
    expect(frozenRoster['Kuki Shinobu'].level).toBe(1);
    expect(frozenRoster['Kuki Shinobu'].ascension).toBe(6);
    expect(frozenWeapons[0].level).toBe(20);
    expect(frozenWeapons[0].ascension).toBe(4);
  });

  // 9. Scanning does not call store update methods
  it('Scenario 9: Scanning, inspecting, and filtering do not invoke any store mutation methods', () => {
    const initialRoster = {
      'Raiden Shogun': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };
    const initialWeapons = [
      { id: 'w-spy-1', weaponName: 'Engulfing Lightning', level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    ];

    useStore.setState({
      roster: initialRoster,
      trackedWeapons: initialWeapons,
    });

    const updateCharacterSpy = vi.fn();
    const updateTrackedWeaponSpy = vi.fn();
    const setRosterSpy = vi.fn();

    useStore.setState({
      updateCharacter: updateCharacterSpy,
      updateTrackedWeapon: updateTrackedWeaponSpy,
      setRoster: setRosterSpy,
    });

    render(<ProgressionDataHealth />);

    // Click scan button
    const scanBtn = screen.getByRole('button', { name: /Scan Progression Data/i });
    fireEvent.click(scanBtn);

    // Expand issue card
    const expandBtn = screen.getByRole('button', { name: /Raiden Shogun/i });
    fireEvent.click(expandBtn);

    // Switch categories
    const charsTab = screen.getByRole('tab', { name: /Characters/i });
    fireEvent.click(charsTab);

    // Assert zero mutation calls
    expect(updateCharacterSpy).not.toHaveBeenCalled();
    expect(updateTrackedWeaponSpy).not.toHaveBeenCalled();
    expect(setRosterSpy).not.toHaveBeenCalled();
  });

  // 10. Repeated scans produce consistent results
  it('Scenario 10: Repeated scans produce identical, idempotent diagnostic outcomes', () => {
    const testRoster = {
      Aloy: { level: 40, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };

    const res1 = diagnoseProgressionState({ roster: testRoster, trackedWeapons: [] });
    const res2 = diagnoseProgressionState({ roster: testRoster, trackedWeapons: [] });
    const res3 = diagnoseProgressionState({ roster: testRoster, trackedWeapons: [] });

    expect(res1.issuesCount).toBe(res2.issuesCount);
    expect(res2.issuesCount).toBe(res3.issuesCount);
    expect(res1.invalidRecordsCount).toBe(res2.invalidRecordsCount);
    expect(res1.characterIssues[0].reason).toBe(res3.characterIssues[0].reason);
  });

  // 11. Correct issue counts
  it('Scenario 11: Correctly tallies scanned records, valid records, invalid records, and issue counts', () => {
    const testRoster = {
      DoubleIssueChar: {
        level: 1,
        ascension: 6, // issue 1: current invalid
        targetLevel: 20,
        targetAscension: 6, // issue 2: target invalid
      },
      CleanChar: {
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    };

    const testWeapons = [
      {
        id: 'w-clean',
        weaponName: 'The Catch',
        level: 90,
        ascension: 6,
        targetLevel: 90,
        targetAscension: 6,
      },
    ];

    const report = diagnoseProgressionState({
      roster: testRoster,
      trackedWeapons: testWeapons,
    });

    expect(report.totalCharacters).toBe(2);
    expect(report.totalWeapons).toBe(1);
    expect(report.totalScanned).toBe(3);
    expect(report.validRecordsCount).toBe(2); // CleanChar + w-clean
    expect(report.invalidRecordsCount).toBe(1); // DoubleIssueChar
    expect(report.characterIssuesCount).toBe(2); // 2 issues on DoubleIssueChar
    expect(report.weaponIssuesCount).toBe(0);
    expect(report.issuesCount).toBe(2);
  });

  // 12. Mobile-safe issue list structure and accessible labels
  it('Scenario 12: Includes accessible aria attributes, keyboard navigation support, and disclosure controls', () => {
    const corruptedRoster = {
      'Kuki Shinobu': { level: 1, ascension: 6, targetLevel: 90, targetAscension: 6 },
    };

    render(
      <ProgressionDataHealth
        roster={corruptedRoster}
        trackedWeapons={[]}
      />
    );

    // Section title landmark
    const section = screen.getByRole('region', { name: /Progression Data Health/i });
    expect(section).toBeInTheDocument();

    // Scan button accessible label
    const scanBtn = screen.getByRole('button', { name: /Scan Progression Data/i });
    expect(scanBtn).toHaveAttribute('aria-label', 'Scan Progression Data');

    // Disclosure button
    const disclosureBtn = screen.getByRole('button', { name: /Kuki Shinobu/i });
    expect(disclosureBtn).toHaveAttribute('aria-expanded', 'false');
    expect(disclosureBtn).toHaveAttribute('aria-controls');

    // Expand All button
    const expandAllBtn = screen.getByRole('button', { name: /Expand all issues/i });
    expect(expandAllBtn).toBeInTheDocument();
    fireEvent.click(expandAllBtn);

    expect(disclosureBtn).toHaveAttribute('aria-expanded', 'true');

    // Future Repair Workflow documentation disclosure
    const repairInfoToggle = screen.getByRole('button', { name: /Future Repair Workflow/i });
    expect(repairInfoToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(repairInfoToggle);
    expect(repairInfoToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Repairs are intentionally disabled in this phase/i)).toBeInTheDocument();
    expect(screen.getByText(/strict 9-step atomic workflow/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import Builds from './Builds';
import * as buildsCatalogService from '../services/buildsCatalogService';
import useStore from '../store/useStore';

// Sample mock catalog with varied character profiles
const mockCatalog = {
  schemaVersion: 1,
  licenseNotice: 'Attribution required',
  sourceAttribution: 'https://genshin-impact-helper-team.github.io/genshin-builds/',
  sourceCommitSha: 'be542cba19de28f31e4a352f8711ffaff9d2c838',
  characters: [
    {
      characterId: 'RaidenShogun',
      characterSlug: 'shogun-raiden',
      characterName: 'Raiden Shogun',
      element: 'Electro',
      weaponType: 'Polearm',
      rarity: 5,
      guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/shogun-raiden',
      roles: [
        {
          roleId: 'general-dps',
          roleSlug: 'general-dps',
          displayName: 'General DPS',
          isBest: true,
          status: 'complete',
          reviewedVersion: '5.2',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/shogun-raiden?build=general-dps',
          weapons: { rankedGroups: [{ rank: 1, weapons: [{ name: 'Engulfing Lightning' }] }] },
          artifacts: { rankedSets: [{ rank: 1, sets: [{ name: 'Emblem of Severed Fate', pieces: 4 }] }] },
          talentPriority: ['Burst', 'Skill', 'Normal Attack'],
          notes: ['High ER requirement.'],
        },
        {
          roleId: 'hyperbloom-trigger',
          roleSlug: 'hyperbloom-trigger',
          displayName: 'Hyperbloom Trigger',
          isBest: false,
          status: 'complete',
          reviewedVersion: '5.2',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/shogun-raiden?build=hyperbloom-trigger',
          weapons: { rankedGroups: [{ rank: 1, weapons: [{ name: "Dragon's Bane" }] }] },
          artifacts: { rankedSets: [{ rank: 1, sets: [{ name: 'Flower of Paradise Lost', pieces: 4 }] }] },
          talentPriority: ['Skill'],
          notes: ['Build full Elemental Mastery.'],
        },
      ],
    },
    {
      characterId: 'KamisatoAyaka',
      characterSlug: 'kamisato-ayaka',
      characterName: 'Kamisato Ayaka',
      element: 'Cryo',
      weaponType: 'Sword',
      rarity: 5,
      guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/kamisato-ayaka',
      roles: [
        {
          roleId: 'freeze-dps',
          roleSlug: 'freeze-dps',
          displayName: 'Freeze DPS',
          isBest: true,
          status: 'complete',
          reviewedVersion: '5.0',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/kamisato-ayaka?build=freeze-dps',
          weapons: { rankedGroups: [{ rank: 1, weapons: [{ name: 'Mistsplitter Reforged' }] }] },
          artifacts: { rankedSets: [{ rank: 1, sets: [{ name: 'Blizzard Strayer', pieces: 4 }] }] },
          talentPriority: ['Burst', 'Normal Attack', 'Skill'],
          notes: [],
        },
        {
          roleId: 'mono-cryo',
          roleSlug: 'mono-cryo',
          displayName: 'Mono Cryo',
          isBest: true, // Multi-best role test
          status: 'complete',
          reviewedVersion: '5.0',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/kamisato-ayaka?build=mono-cryo',
          weapons: { rankedGroups: [] },
          artifacts: { rankedSets: [] },
          talentPriority: ['Burst', 'Skill'],
          notes: [],
        },
      ],
    },
    {
      characterId: 'Bennett',
      characterSlug: 'bennett',
      characterName: 'Bennett',
      element: 'Pyro',
      weaponType: 'Sword',
      rarity: 4,
      guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/bennett',
      roles: [
        {
          roleId: 'support',
          roleSlug: 'support',
          displayName: 'Burst Support',
          isBest: true,
          status: 'complete',
          reviewedVersion: '5.2',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/bennett?build=support',
          weapons: { rankedGroups: [] },
          artifacts: { rankedSets: [] },
          talentPriority: ['Burst', 'Skill'],
          notes: [],
        },
      ],
    },
    {
      characterId: 'NewExperimentalChar',
      characterSlug: 'new-experimental-char',
      characterName: 'New Character',
      element: 'Anemo',
      weaponType: 'Catalyst',
      rarity: 5,
      guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/new-experimental-char',
      roles: [
        {
          roleId: 'wip-role',
          roleSlug: 'wip-role',
          displayName: 'Experimental Swirl',
          isBest: true,
          status: 'wip',
          reviewedVersion: '6.0',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/new-experimental-char?build=wip-role',
          weapons: { rankedGroups: [] },
          artifacts: { rankedSets: [] },
          talentPriority: [],
          notes: ['Under development.'],
        },
      ],
    },
    {
      characterId: 'TravelerAnemo',
      characterSlug: 'anemo-traveler',
      characterName: 'Anemo Traveler',
      element: 'Anemo',
      weaponType: 'Sword',
      rarity: 5,
      guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/anemo-traveler',
      roles: [
        {
          roleId: 'anemo-support',
          roleSlug: 'anemo-support',
          displayName: 'Anemo Support',
          isBest: true,
          status: 'complete',
          reviewedVersion: '4.8',
          guideUrl: 'https://genshin-impact-helper-team.github.io/genshin-builds/en/anemo-traveler?build=anemo-support',
          weapons: { rankedGroups: [] },
          artifacts: { rankedSets: [] },
          talentPriority: ['Burst', 'Skill'],
          notes: [],
        },
      ],
    },
  ],
};

// Legacy redirect helper for route testing
function LegacyBuildsRedirect() {
  const { characterId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const params = new URLSearchParams();
  if (characterId) params.set('character', characterId);
  if (role) params.set('role', role);
  return <Navigate to={`/builds?${params.toString()}`} replace />;
}

describe('Character Build Sheet (CB3A.2 Stacking & Role Buttons)', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    buildsCatalogService.clearBuildsCatalogCache();
    vi.spyOn(buildsCatalogService, 'loadBuildsCatalog').mockResolvedValue(mockCatalog);
  });

  describe('Task 1: Character Dropdown Stacking Context & Combobox', () => {
    it('renders toolbar with elevated z-index so dropdown floats above Build Sheet cards', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun&role=general-dps']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      // The toolbar container has relative z-30
      const toolbar = screen.getByLabelText(/Character and Role Selectors/i);
      expect(toolbar).toHaveClass('relative', 'z-30');

      // Open the combobox dropdown
      const combobox = screen.getByRole('combobox');
      fireEvent.focus(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // Listbox is rendered inside the elevated toolbar with shadow and max-h-80
      const listbox = screen.getByRole('listbox', { name: /Select Character/i });
      expect(listbox).toBeInTheDocument();
      expect(listbox).toHaveClass('absolute', 'max-h-80', 'overflow-y-auto', 'z-30');
    });

    it('filters characters by typing and supports keyboard navigation', async () => {
      render(
        <MemoryRouter initialEntries={['/builds']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const combobox = screen.getByRole('combobox');
      fireEvent.focus(combobox);
      fireEvent.change(combobox, { target: { value: 'Raiden' } });

      expect(screen.getByRole('option', { name: /Raiden Shogun/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Kamisato Ayaka/i })).not.toBeInTheDocument();

      // Keyboard arrow and enter
      fireEvent.keyDown(combobox, { key: 'ArrowDown' });
      fireEvent.keyDown(combobox, { key: 'Enter' });

      expect(combobox).toHaveValue('Raiden Shogun');
    });

    it('displays empty search feedback when no character matches', async () => {
      render(
        <MemoryRouter initialEntries={['/builds']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const combobox = screen.getByRole('combobox');
      fireEvent.focus(combobox);
      fireEvent.change(combobox, { target: { value: 'NonexistentCharacterXYZ' } });

      expect(
        screen.getByText(/No characters found matching “NonexistentCharacterXYZ”/i),
      ).toBeInTheDocument();
    });

    it('clears selection when clear button is clicked', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('Raiden Shogun');
      });

      const clearBtn = screen.getByRole('button', { name: /Clear selected character/i });
      fireEvent.click(clearBtn);

      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(
        screen.getByText('Select a character to view available builds.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: /Select a Character to View Recommended Builds/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Task 2: Build Role Button Selection', () => {
    it('shows disabled role prompt before a character is selected', async () => {
      render(
        <MemoryRouter initialEntries={['/builds']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const disabledPrompt = screen.getByText('Select a character to view available builds.');
      expect(disabledPrompt).toBeInTheDocument();
      expect(disabledPrompt.closest('[aria-disabled="true"]')).toBeInTheDocument();
    });

    it('renders single role button for single-role character', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=Bennett']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Select Build Role/i })).toBeInTheDocument();
      });

      const toolbarRoleGroup = screen.getByRole('group', { name: /Select Build Role/i });
      const roleBtnsInToolbar = toolbarRoleGroup.querySelectorAll('button');
      expect(roleBtnsInToolbar.length).toBe(1);
      expect(roleBtnsInToolbar[0]).toHaveAttribute('aria-pressed', 'false');
      expect(within(toolbarRoleGroup).getByRole('button', { name: /Burst Support/i })).toBeInTheDocument();
    });

    it('renders all available roles as buttons for multi-role characters', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Select Build Role/i })).toBeInTheDocument();
      });

      const toolbarRoleGroup = screen.getByRole('group', { name: /Select Build Role/i });
      const roleBtns = toolbarRoleGroup.querySelectorAll('button');
      expect(roleBtns.length).toBe(2);

      const dpsBtn = within(toolbarRoleGroup).getByRole('button', { name: /General DPS/i });
      const hyperBtn = within(toolbarRoleGroup).getByRole('button', { name: /Hyperbloom Trigger/i });
      expect(dpsBtn).toBeInTheDocument();
      expect(hyperBtn).toBeInTheDocument();
    });

    it('indicates isBest with Best badge and supports multiple Best roles', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=KamisatoAyaka']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Select Build Role/i })).toBeInTheDocument();
      });

      // Both Ayaka Freeze DPS and Mono Cryo roles have isBest: true
      const bestBadges = screen.getAllByText('★ Best');
      expect(bestBadges.length).toBeGreaterThanOrEqual(2);
    });

    it('indicates WIP roles with distinct badge', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=NewExperimentalChar']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Select Build Role/i })).toBeInTheDocument();
      });

      const toolbarRoleGroup = screen.getByRole('group', { name: /Select Build Role/i });
      expect(within(toolbarRoleGroup).getByText('WIP')).toBeInTheDocument();
    });

    it('clicking a role button activates it, marks aria-pressed="true", and displays recommendation regions', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Select Build Role/i })).toBeInTheDocument();
      });

      const toolbarRoleGroup = screen.getByRole('group', { name: /Select Build Role/i });
      const dpsBtn = within(toolbarRoleGroup).getByRole('button', { name: /General DPS/i });
      const hyperBtn = within(toolbarRoleGroup).getByRole('button', { name: /Hyperbloom Trigger/i });

      expect(dpsBtn).toHaveAttribute('aria-pressed', 'false');
      expect(hyperBtn).toHaveAttribute('aria-pressed', 'false');

      // Click General DPS
      fireEvent.click(dpsBtn);

      await waitFor(() => {
        expect(dpsBtn).toHaveAttribute('aria-pressed', 'true');
        expect(hyperBtn).toHaveAttribute('aria-pressed', 'false');
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun \(General DPS\)/i }),
        ).toBeInTheDocument();
      });

      // All 4 content regions are present
      expect(screen.getByLabelText(/Weapons Recommendations/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Artifact Recommendations/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Artifact Stats & Substats/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Talent Priorities/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Build Notes and Gameplay Tips/i)).toBeInTheDocument();

      // Switch to Hyperbloom Trigger
      fireEvent.click(hyperBtn);

      await waitFor(() => {
        expect(hyperBtn).toHaveAttribute('aria-pressed', 'true');
        expect(dpsBtn).toHaveAttribute('aria-pressed', 'false');
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun \(Hyperbloom Trigger\)/i }),
        ).toBeInTheDocument();
      });
    });

    it('changing character resets previously selected role', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun&role=general-dps']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun \(General DPS\)/i }),
        ).toBeInTheDocument();
      });

      // Change character to Kamisato Ayaka via combobox
      const combobox = screen.getByRole('combobox');
      fireEvent.focus(combobox);
      fireEvent.change(combobox, { target: { value: 'Ayaka' } });

      const ayakaOption = screen.getByRole('option', { name: /Kamisato Ayaka/i });
      fireEvent.mouseDown(ayakaOption);

      // Previous role is cleared; role selection prompt for Ayaka is shown
      await waitFor(() => {
        expect(
          screen.queryByRole('region', { name: /Build Sheet for Raiden Shogun/i }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByText(/Select a Build Role for Kamisato Ayaka/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Routing, Direct Links & History', () => {
    it('initializes directly from query parameters (?character=...&role=...)', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun&role=hyperbloom-trigger']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun \(Hyperbloom Trigger\)/i }),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('combobox')).toHaveValue('Raiden Shogun');
      const hyperBtn = screen.getByRole('button', { name: /Hyperbloom Trigger/i });
      expect(hyperBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('redirects legacy /builds/:characterId routes to /builds?character=:characterId', async () => {
      render(
        <MemoryRouter initialEntries={['/builds/RaidenShogun?role=general-dps']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
            <Route path="/builds/:characterId" element={<LegacyBuildsRedirect />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun \(General DPS\)/i }),
        ).toBeInTheDocument();
      });
    });

    it('resolves Traveler variants with correct portrait mappings', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=TravelerAnemo&role=anemo-support']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('region', { name: /Build Sheet for Anemo Traveler \(Anemo Support\)/i }),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('combobox')).toHaveValue('Anemo Traveler');
    });

    it('handles invalid character IDs gracefully with not found banner', async () => {
      render(
        <MemoryRouter initialEntries={['/builds?character=nonexistent-id-999']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Character Not Found/i })).toBeInTheDocument();
      });

      const clearBtn = screen.getByRole('button', { name: /Clear and Choose from All Characters/i });
      fireEvent.click(clearBtn);

      expect(
        screen.getByRole('heading', { level: 2, name: /Select a Character to View Recommended Builds/i }),
      ).toBeInTheDocument();
    });
  });

  describe('Zero Mutation & Store Isolation Guarantee', () => {
    it('verifies user store is never mutated by loading or interacting with the Build Sheet', async () => {
      const storeBefore = JSON.stringify(useStore.getState());

      render(
        <MemoryRouter initialEntries={['/builds?character=RaidenShogun&role=general-dps']}>
          <Routes>
            <Route path="/builds" element={<Builds />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole('region', { name: /Build Sheet for Raiden Shogun/i }),
        ).toBeInTheDocument();
      });

      const storeAfter = JSON.stringify(useStore.getState());
      expect(storeAfter).toBe(storeBefore);
    });
  });
});

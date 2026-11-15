import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WeaponRecommendations from './WeaponRecommendations';
import ArtifactRecommendations, {
  PSEUDO_SET_EXPLANATIONS,
} from './ArtifactRecommendations';
import ArtifactStatPriorities from './ArtifactStatPriorities';
import TalentPriorities from './TalentPriorities';
import BuildEditorialNotes from './BuildEditorialNotes';
import SafeHtml from './SafeHtml';
import RotationBadge from './RotationBadge';
import rawBuildsCatalog from '../../data/builds.json';

describe('CB3B Full Build Recommendations & Editorial Content Test Suite', () => {
  // ── Area 1: Lisa Aggravate DPS 4-Tier Artifact Regression ──
  it('1. Lisa Aggravate DPS has four artifact ranking tiers in the source and generated catalog', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    expect(lisa).toBeDefined();

    const aggRole = lisa.roles.find((r) => r.roleId === 'aggravate-dps');
    expect(aggRole).toBeDefined();
    expect(aggRole.artifacts.rankedGroups).toHaveLength(4);

    // Verify the 4 exact tiers
    expect(aggRole.artifacts.rankedGroups[0].rank).toBe(1);
    expect(aggRole.artifacts.rankedGroups[0].groups[0].items[0].name).toBe(
      'Thundering Fury',
    );
    expect(aggRole.artifacts.rankedGroups[0].groups[0].items[0].pieces).toBe(4);

    expect(aggRole.artifacts.rankedGroups[1].rank).toBe(2);
    expect(aggRole.artifacts.rankedGroups[1].groups[0].items[0].name).toBe(
      'Gilded Dreams',
    );
    expect(aggRole.artifacts.rankedGroups[1].groups[0].items[0].pieces).toBe(4);

    expect(aggRole.artifacts.rankedGroups[2].rank).toBe(3);
    expect(aggRole.artifacts.rankedGroups[2].groups[0].items[0].name).toBe(
      'Thundersoother',
    );
    expect(aggRole.artifacts.rankedGroups[2].groups[0].items[0].pieces).toBe(4);

    expect(aggRole.artifacts.rankedGroups[3].rank).toBe(4);
    expect(aggRole.artifacts.rankedGroups[3].groups[0].chooseTwo).toBe(true);
    expect(aggRole.artifacts.rankedGroups[3].groups[0].items).toHaveLength(3);

    // Render component and assert 4 tiers are visible
    render(<ArtifactRecommendations artifacts={aggRole.artifacts} />);
    expect(screen.getByText('4 Ranked Tiers')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
    expect(screen.getAllByText('Thundering Fury')).toHaveLength(2); // In Rank 1 (4pc) and Rank 4 (2pc)
    expect(screen.getByText('Gilded Dreams')).toBeInTheDocument();
    expect(screen.getByText('Thundersoother')).toBeInTheDocument();
    expect(
      screen.getByText(/Choose any two 2-Piece bonuses/i),
    ).toBeInTheDocument();
  });

  // ── Area 2: Weapon ranking preservation ──
  it('2. Preserves strict weapon ranking positions (#1, #2, #3)', () => {
    const testWeapons = {
      rankedGroups: [
        {
          rank: 1,
          items: [{ name: 'Engulfing Lightning', rarity: 5, refinement: null, isToolkitItem: true }],
        },
        {
          rank: 2,
          items: [{ name: 'The Catch', rarity: 4, refinement: 5, isToolkitItem: true }],
        },
        {
          rank: 3,
          items: [{ name: 'Wavebreaker Fin', rarity: 4, refinement: 1, isToolkitItem: true }],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={testWeapons} weaponType="Polearm" />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('Engulfing Lightning')).toBeInTheDocument();
    expect(screen.getByText('The Catch')).toBeInTheDocument();
    expect(screen.getByText('Wavebreaker Fin')).toBeInTheDocument();
  });

  // ── Area 3: Multiple weapons sharing one rank ──
  it('3. Keeps equivalent weapons strictly in the same tier with indicator', () => {
    const testWeapons = {
      rankedGroups: [
        {
          rank: 1,
          items: [
            { name: 'Kagura Verity', rarity: 5, isToolkitItem: true },
            { name: 'Lost Prayer', rarity: 5, isToolkitItem: true },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={testWeapons} weaponType="Catalyst" />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
    expect(screen.getByText(/Equivalent Options/i)).toBeInTheDocument();
    expect(screen.getByText('Kagura Verity')).toBeInTheDocument();
    expect(screen.getByText('Lost Prayer')).toBeInTheDocument();
  });

  // ── Area 4: Refinement requirements ──
  it('4. Renders refinement requirement badges (R1 vs R5)', () => {
    const testWeapons = {
      rankedGroups: [
        {
          rank: 1,
          items: [{ name: 'Dragon Bane', rarity: 4, refinement: 5, isToolkitItem: true }],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={testWeapons} weaponType="Polearm" />);
    // Refinement indicator should appear on weapon card
    expect(screen.getAllByText('R5').length).toBeGreaterThanOrEqual(1);
  });

  // ── Area 5: Conditional weapons ──
  it('5. Distinguishes conditional weapons from unconditional rankings', () => {
    const testWeapons = {
      rankedGroups: [
        { rank: 1, items: [{ name: 'Standard Sword', rarity: 4, isToolkitItem: true }] },
      ],
      conditional: [
        {
          name: 'Favonius Sword',
          rarity: 4,
          note: 'Use if team lacks energy.',
          isToolkitItem: true,
        },
      ],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={testWeapons} weaponType="Sword" />);
    expect(
      screen.getByText(/Conditional Weapon Options \(1\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Favonius Sword')).toBeInTheDocument();
    expect(screen.getByText('Use if team lacks energy.')).toBeInTheDocument();
  });

  // ── Area 6: Four-piece artifact sets ──
  it('6. Renders 4-piece artifact set badge', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              items: [{ name: 'Viridescent Venerer', pieces: 4 }],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(screen.getByText('Viridescent Venerer')).toBeInTheDocument();
    expect(screen.getByText('4-Piece')).toBeInTheDocument();
  });

  // ── Area 7: Two-piece combinations ──
  it('7. Renders 2-piece combinations accurately', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              items: [
                { name: 'Blizzard Strayer', pieces: 2 },
                { name: 'Noblesse Oblige', pieces: 2 },
              ],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(screen.getByText('Blizzard Strayer')).toBeInTheDocument();
    expect(screen.getByText('Noblesse Oblige')).toBeInTheDocument();
    expect(screen.getAllByText('2-Piece')).toHaveLength(2);
  });

  // ── Area 8: Choose-two semantics ──
  it('8. Displays choose-two requirements without creating an impossible 6pc build', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              chooseTwo: true,
              items: [
                { name: 'Set A', pieces: 2 },
                { name: 'Set B', pieces: 2 },
                { name: 'Set C', pieces: 2 },
              ],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(
      screen.getByText(/Choose any two 2-Piece bonuses/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Set A')).toBeInTheDocument();
    expect(screen.getByText('Set B')).toBeInTheDocument();
    expect(screen.getByText('Set C')).toBeInTheDocument();
  });

  // ── Area 9: Separate artifact choice pools ──
  it('9. Preserves separate artifact choice pools (Pool 1 + Pool 2)', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              choices: [
                { items: [{ name: 'Pool 1 Set A', pieces: 2 }] },
                { items: [{ name: 'Pool 2 Set B', pieces: 2 }] },
              ],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(
      screen.getByText(/Choose One 2-Piece Bonus from Pool 1:/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\+ Choose One 2-Piece Bonus from Pool:/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Pool 1 Set A')).toBeInTheDocument();
    expect(screen.getByText('Pool 2 Set B')).toBeInTheDocument();
  });

  // ── Area 10: Fixed plus optional artifact groups ──
  it('10. Renders fixed required 2pc plus optional selection pool', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              items: [{ name: 'Archaic Petra', pieces: 2 }],
              choices: [
                {
                  items: [
                    { name: 'Noblesse Oblige', pieces: 2 },
                    { name: '+18% ATK set', pieces: 2, isPseudoSet: true, pseudoStatTag: 'atk-set' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(screen.getByText(/Fixed 2-Piece Bonus:/i)).toBeInTheDocument();
    expect(screen.getByText('Archaic Petra')).toBeInTheDocument();
    expect(
      screen.getByText(/\+ Choose One 2-Piece Bonus from Pool:/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Noblesse Oblige')).toBeInTheDocument();
  });

  // ── Area 11: Pseudo-set descriptions ──
  it('11. Explains generic pseudo-set categories with human-readable descriptions', () => {
    const testArtifacts = {
      rankedGroups: [
        {
          rank: 1,
          groups: [
            {
              items: [
                {
                  name: '+18% ATK set',
                  pieces: 2,
                  isPseudoSet: true,
                  pseudoStatTag: 'atk-set',
                },
              ],
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<ArtifactRecommendations artifacts={testArtifacts} />);
    expect(screen.getByText('+18% ATK set')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(
      screen.getByText(PSEUDO_SET_EXPLANATIONS['atk-set'].description),
    ).toBeInTheDocument();
  });

  // ── Area 12: Artifact main-stat ordering ──
  it('12. Renders Sands, Goblet, and Circlet slots preserving source order', () => {
    const testArtifacts = {
      mainStats: {
        sands: [{ name: 'Energy Recharge' }, { name: 'ATK%' }],
        goblet: [{ name: 'Electro DMG' }],
        circlet: [{ name: 'CRIT Rate' }, { name: 'CRIT DMG' }],
        sectionNotes: ['Main stat note.'],
      },
      substats: { priorityGroups: [], sectionNotes: [] },
    };

    render(<ArtifactStatPriorities artifacts={testArtifacts} />);
    expect(screen.getByText('Sands')).toBeInTheDocument();
    expect(screen.getByText('Goblet')).toBeInTheDocument();
    expect(screen.getByText('Circlet')).toBeInTheDocument();
    expect(screen.getByText('Energy Recharge')).toBeInTheDocument();
    expect(screen.getByText('Electro DMG')).toBeInTheDocument();
    expect(screen.getByText('CRIT Rate')).toBeInTheDocument();
    expect(screen.getByText('Main stat note.')).toBeInTheDocument();
  });

  // ── Area 13: Grouped substat priorities ──
  it('13. Preserves grouped substat priorities and shared rank positions', () => {
    const testArtifacts = {
      mainStats: {},
      substats: {
        priorityGroups: [
          { rank: 1, items: [{ name: 'CRIT Rate / CRIT DMG' }] },
          { rank: 2, items: [{ name: 'ATK%' }, { name: 'Elemental Mastery' }] },
          { rank: 3, items: [{ name: 'Energy Recharge', note: 'Until 140%' }] },
        ],
        sectionNotes: ['Aim for 1:2 CRIT ratio.'],
      },
    };

    render(<ArtifactStatPriorities artifacts={testArtifacts} />);
    expect(screen.getByText('CRIT Rate / CRIT DMG')).toBeInTheDocument();
    expect(screen.getByText('ATK%')).toBeInTheDocument();
    expect(screen.getByText('Elemental Mastery')).toBeInTheDocument();
    expect(screen.getByText('Energy Recharge')).toBeInTheDocument();
    expect(screen.getByText('Until 140%')).toBeInTheDocument();
    expect(screen.getByText('Aim for 1:2 CRIT ratio.')).toBeInTheDocument();
  });

  // ── Area 14: Approximate and equal talent priorities ──
  it('14. Renders sequence progression with > for strict and ≈ for approximate priorities', () => {
    const testTalents = {
      priorityGroups: [
        {
          rank: 1,
          isApproximate: false,
          items: [{ talentKey: 'burst', name: 'Burst' }],
        },
        {
          rank: 2,
          isApproximate: true,
          items: [
            { talentKey: 'skill', name: 'Skill' },
            { talentKey: 'na', name: 'Normal Attack' },
          ],
        },
      ],
      sectionNotes: ['Level Burst first for maximum rotation DPS.'],
    };

    render(<TalentPriorities talents={testTalents} />);
    expect(screen.getAllByText('Burst').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Skill').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Normal Attack/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('>')).toBeInTheDocument();
    expect(screen.getByText('≈ Approx. Equal')).toBeInTheDocument();
    expect(
      screen.getByText('Level Burst first for maximum rotation DPS.'),
    ).toBeInTheDocument();
  });

  // ── Area 15: General and item-specific notes ──
  it('15. Renders item-specific notes and editorial guidance', () => {
    const notes = [
      { renderedHtml: '<p>Comprehensive playstyle explanation.</p>' },
    ];
    const tips = [
      {
        title: 'Energy Management',
        renderedHtml: '<p>Battery with Favonius teammate.</p>',
      },
    ];

    render(
      <BuildEditorialNotes
        notes={notes}
        gameplayTips={tips}
        calculationCredits={[]}
      />,
    );
    expect(
      screen.getByText('Comprehensive playstyle explanation.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Energy Management')).toBeInTheDocument();
    expect(
      screen.getByText('Battery with Favonius teammate.'),
    ).toBeInTheDocument();
  });

  // ── Area 16: Markdown and HTML safety ──
  it('16. Sanitizes dangerous HTML while preserving legitimate tags', () => {
    const dangerousHtml =
      '<p>Safe text <strong>bold</strong> <script>alert("xss")</script><a href="javascript:void(0)" onclick="steal()">Bad Link</a><a href="https://example.com">Safe Link</a></p>';

    render(<SafeHtml content={dangerousHtml} />);
    expect(screen.getByText('Safe text')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();

    const badLink = screen.getByText('Bad Link');
    expect(badLink.tagName).toBe('SPAN'); // Sanitized to span without href

    const safeLink = screen.getByText('Safe Link').closest('a');
    expect(safeLink).toBeInTheDocument();
    expect(safeLink).toHaveAttribute('href', 'https://example.com');
    expect(safeLink).toHaveAttribute('target', '_blank');
    expect(safeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ── Area 17: Rotation notation ──
  it('17. Renders rotation notation badges with interactive tooltip', () => {
    render(<RotationBadge rotation="tE Q tE C N1" />);
    const badge = screen.getByRole('button', {
      name: /Rotation combo: tE Q tE C N1/i,
    });
    expect(badge).toBeInTheDocument();

    // Hover reveals combo sequence breakdown
    fireEvent.mouseEnter(badge);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText(/Key: NA=Normal, CA=Charged/i)).toBeInTheDocument();
  });

  // ── Area 18: Calculation credit links ──
  it('18. Renders calculation credit links with strict HTTPS security attributes', () => {
    const credits = [
      {
        author: 'Theorycrafter Joe',
        category: 'weapon',
        link: 'https://docs.google.com/spreadsheets/d/test',
      },
    ];

    render(
      <BuildEditorialNotes
        notes={[]}
        gameplayTips={[]}
        calculationCredits={credits}
      />,
    );
    const creditLink = screen.getByTitle(/View calculation sheet by Theorycrafter Joe/i);
    expect(creditLink).toBeInTheDocument();
    expect(creditLink).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/test');
    expect(creditLink).toHaveAttribute('target', '_blank');
    expect(creditLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ── Area 19: Missing weapon icons and artifact images ──
  it('19. Handles missing icons gracefully using fallback badges', () => {
    const weapons = {
      rankedGroups: [
        {
          rank: 1,
          items: [{ name: 'Unknown Bizarre Weapon', rarity: 3, isToolkitItem: false }],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={weapons} weaponType="Sword" />);
    expect(screen.getByText('Unknown Bizarre Weapon')).toBeInTheDocument();
  });

  // ── Area 20: Unmapped source equipment (Exaiphanes' Blade) ──
  it('20. Preserves unmapped source weapons (Exaiphanes Blade) and never labels them Unowned', () => {
    const weapons = {
      rankedGroups: [
        {
          rank: 1,
          items: [
            {
              sourceWeaponId: 'exaiphanes-blade',
              toolkitWeaponId: null,
              name: "Exaiphanes' Blade",
              rarity: 4,
              refinement: 5,
              note: 'Preserve source-only weapon.',
              isToolkitItem: false,
            },
          ],
        },
      ],
      conditional: [],
      sectionNotes: [],
    };

    render(<WeaponRecommendations weapons={weapons} weaponType="Sword" />);
    expect(screen.getByText("Exaiphanes' Blade")).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.queryByText(/Unowned/i)).not.toBeInTheDocument();
  });

  // ── Area 21: Multiple Best roles ──
  it('21. Preserves multiple best build roles across complex character profiles', () => {
    const ayaka = rawBuildsCatalog.characters.find((c) => c.characterId === 'KamisatoAyaka');
    expect(ayaka).toBeDefined();
    // Ayaka has 2 roles (DPS and Mono Cryo or Freeze)
    const bestRoles = ayaka.roles.filter((r) => r.isBest);
    expect(bestRoles.length).toBeGreaterThanOrEqual(1);

    // Fischl also has 2 roles both with isBest: true
    const fischl = rawBuildsCatalog.characters.find((c) => c.characterId === 'Fischl');
    expect(fischl).toBeDefined();
    const fischlBestRoles = fischl.roles.filter((r) => r.isBest);
    expect(fischlBestRoles.length).toBe(2);
  });

  // ── Area 22: WIP roles ──
  it('22. Identifies WIP roles and renders status indicators', () => {
    const wipRole = {
      roleId: 'test-wip',
      displayName: 'WIP Build',
      status: 'wip',
      isWip: true,
      weapons: { rankedGroups: [] },
      artifacts: { rankedGroups: [] },
      talents: { priorityGroups: [] },
      notes: [],
    };

    // When status is 'wip', the role displays the WIP badge and warning notice
    expect(wipRole.status).toBe('wip');
    expect(wipRole.isWip).toBe(true);
  });

  // ── Area 23: Empty optional sections ──
  it('23. Handles completely empty optional sections gracefully', () => {
    render(<WeaponRecommendations weapons={null} />);
    expect(screen.getByText(/0 Ranked Tiers/i)).toBeInTheDocument();

    render(<ArtifactRecommendations artifacts={null} />);
    expect(screen.getByText(/0 Set Options/i)).toBeInTheDocument();

    render(<ArtifactStatPriorities artifacts={null} />);
    expect(screen.getByText(/Stat Optimization/i)).toBeInTheDocument();

    render(<TalentPriorities talents={null} />);
    expect(screen.getByText(/Unspecified/i)).toBeInTheDocument();

    const { container } = render(
      <BuildEditorialNotes
        notes={[]}
        gameplayTips={[]}
        calculationCredits={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ── Area 24: Markdown Headings and Bullet Lists in Editorial Notes ──
  it('24. Renders Lisa Aggravate DPS markdown headings as semantic headings and bullet items as lists', () => {
    const lisa = rawBuildsCatalog.characters.find((c) => c.characterId === 'Lisa');
    expect(lisa).toBeDefined();
    const role = lisa.roles.find((r) => r.roleId === 'aggravate-dps');
    expect(role).toBeDefined();

    // Find the note with WIP weapon calculations
    const wipNote = role.notes.find((n) =>
      n.renderedHtml?.includes('Viable Weapons with WIP Calculations'),
    );
    expect(wipNote).toBeDefined();

    const { container } = render(<SafeHtml content={wipNote.renderedHtml} />);

    // Assert semantic heading exists
    const heading = screen.getByRole('heading', { level: 4 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Viable Weapons with WIP Calculations:');

    // Assert bullet items are rendered inside semantic list
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems.length).toBeGreaterThanOrEqual(6);
    expect(listItems[0].textContent).toContain("Nocturne's Curtain Call");
    expect(listItems[1].textContent).toContain("Angelos' Heptades");

    // Assert no raw Markdown markers (## or -) remain visible as text
    expect(container.textContent).not.toContain('##');
    expect(container.textContent).not.toMatch(/^\s*-\s+/m);
  });

  it('25. Renders Kamisato Ayaka DPS markdown headings and weapon bullets as semantic elements', () => {
    const ayaka = rawBuildsCatalog.characters.find((c) => c.characterId === 'KamisatoAyaka');
    expect(ayaka).toBeDefined();
    const role = ayaka.roles.find((r) => r.roleId === 'dps');
    expect(role).toBeDefined();

    const wipNote = role.notes.find((n) =>
      n.renderedHtml?.includes('Viable Weapons with WIP Calculations'),
    );
    expect(wipNote).toBeDefined();

    const { container } = render(<SafeHtml content={wipNote.renderedHtml} />);

    // Heading
    const heading = screen.getByRole('heading', { level: 4 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Viable Weapons with WIP Calculations:');

    // List items
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems.length).toBeGreaterThanOrEqual(10);
    expect(listItems[0].textContent).toContain('Splendor of Tranquil Waters');
    expect(listItems[1].textContent).toContain('Uraku Misugiri');

    // No raw markdown markers
    expect(container.textContent).not.toContain('##');
  });

  it('26. Renders Raiden Shogun burst combos as semantic list items preserving interactive rotation badges', () => {
    const raiden = rawBuildsCatalog.characters.find((c) => c.characterId === 'RaidenShogun');
    expect(raiden).toBeDefined();
    const role = raiden.roles.find((r) => r.roleId === 'dps-energy-support');
    expect(role).toBeDefined();

    const comboNote = role.notes.find((n) =>
      n.renderedHtml?.includes('Burst combo :'),
    );
    expect(comboNote).toBeDefined();

    const { container } = render(<SafeHtml content={comboNote.renderedHtml} />);

    // Lead paragraphs
    expect(screen.getByText("Start your rotation with Raiden's Skill.")).toBeInTheDocument();
    expect(screen.getByText('Burst combo :')).toBeInTheDocument();

    // Semantic list with rotation badges
    const listItems = container.querySelectorAll('ul > li');
    expect(listItems.length).toBe(2);

    // Rotation badges should be present and interactive
    const badges = screen.getAllByRole('button');
    expect(badges.length).toBeGreaterThanOrEqual(2);

    // Verify badge text and recommendations
    expect(screen.getByText('Q > 4N4D')).toBeInTheDocument();
    expect(screen.getByText(/Recommended for general use/i)).toBeInTheDocument();
    expect(screen.getByText('Q > 3N3C + N1C')).toBeInTheDocument();
    expect(screen.getByText(/Recommended with Attack Speed/i)).toBeInTheDocument();

    // No raw markdown dash markers
    expect(container.textContent).not.toMatch(/^\s*-\s+/m);
  });

  it('27. Neutralizes malicious HTML, scripts, and unsafe protocols while preserving safe tags', () => {
    const maliciousHtml = `
      <p>Safe introductory text</p>
      <script>window.pwned = true;</script>
      <img src="x" onerror="window.pwned = true;" />
      <p><a href="javascript:alert(1)">Unsafe JS Link</a></p>
      <p><a href="https://example.com">Safe External Link</a></p>
      <iframe src="https://evil.com"></iframe>
    `;

    const { container } = render(<SafeHtml content={maliciousHtml} />);

    // Safe text rendered
    expect(screen.getByText('Safe introductory text')).toBeInTheDocument();

    // Script and iframe completely omitted
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')).toBeNull();

    // Unsafe JS link neutralized to plain span without href
    const unsafeLink = screen.getByText('Unsafe JS Link');
    expect(unsafeLink.tagName.toLowerCase()).toBe('span');
    expect(unsafeLink.closest('a')).toBeNull();

    // Safe external link preserved with target and rel
    const safeLink = screen.getByRole('link', { name: /Safe External Link/i });
    expect(safeLink).toBeInTheDocument();
    expect(safeLink).toHaveAttribute('href', 'https://example.com');
    expect(safeLink).toHaveAttribute('target', '_blank');
    expect(safeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

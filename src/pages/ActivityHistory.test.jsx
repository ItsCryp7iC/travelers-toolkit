import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ActivityHistory from './ActivityHistory';
import AppLayout from '../layouts/AppLayout';
import useStore from '../store/useStore';
import {
  useActivityStore,
  clearActivityHistory,
  getActivityEvents,
  createActivityExportPayload,
  ACTIVITY_STORAGE_KEY,
} from '../activity';
import { notify } from '../utils/notify';

function makeTestEvent(overrides = {}) {
  const defaultHex = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
  let id = overrides.id || `00000000-0000-4000-8000-${defaultHex}`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    const hex = (id.replace(/[^0-9a-f]/gi, '') + '0000000000000000').slice(0, 12).padStart(12, '0');
    id = `00000000-0000-4000-8000-${hex}`;
  }
  return {
    id,
    schemaVersion: 1,
    timestamp: overrides.timestamp || new Date('2026-11-12T12:00:00.000Z').toISOString(),
    category: overrides.category || 'inventory',
    action: overrides.action || 'inventory_updated',
    source: overrides.source || 'inventory_page',
    summary: overrides.summary || 'Slime Condensate updated from 10 to 20.',
    entityType: overrides.entityType || 'material',
    entityId: overrides.entityId || 'slime_condensate',
    entityName: overrides.entityName || 'Slime Condensate',
    changes: overrides.changes || [
      { field: 'quantity', before: 10, after: 20, delta: '+10' },
    ],
    metadata: overrides.metadata || {},
    ...(overrides.transactionId ? { transactionId: overrides.transactionId } : {}),
    ...(overrides.truncated ? { truncated: true } : {}),
  };
}

describe('ACTIVITY-HISTORY-A6: User Interface, Navigation & Interchange', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
      goals: [],
      achievementProgress: {},
      displayTimeZone: 'UTC',
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION (Tests 1–4)
  // ─────────────────────────────────────────────────────────────────────────

  it('1. /activity route renders Activity History page', async () => {
    render(
      <MemoryRouter initialEntries={['/activity']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="activity" element={<ActivityHistory />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /Activity History/i })
    ).toBeInTheDocument();
  });

  it('2. Sidebar link exists under Records section directly below Achievements', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    const recordsGroup = container.querySelector('#nav-section-records');
    expect(recordsGroup).not.toBeNull();

    const links = recordsGroup.querySelectorAll('a.sidebar-nav-link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0].getAttribute('href')).toBe('/achievements');
    expect(links[1].getAttribute('href')).toBe('/activity');
    expect(links[1].id).toBe('nav-activity');
    expect(links[1].textContent).toContain('Activity History');
  });

  it('3. Active link styling works when on /activity', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/activity']}>
        <AppLayout />
      </MemoryRouter>
    );

    const activeLink = container.querySelector('#nav-section-records a[href="/activity"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink.classList.contains('active')).toBe(true);
  });

  it('4. Mobile navigation drawer contains Activity History link', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppLayout />
      </MemoryRouter>
    );

    const mobileLink = container.querySelector('.mobile-bottom-nav a[href="/activity"]') ||
      container.querySelector('#nav-section-records a[href="/activity"]');
    expect(mobileLink).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DISPLAY (Tests 5–17)
  // ─────────────────────────────────────────────────────────────────────────

  it('5. Renders empty state when no activity recorded', () => {
    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const emptyState = screen.getByTestId('activity-empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(within(emptyState).getByText('No activity recorded yet.')).toBeInTheDocument();
    expect(
      within(emptyState).getByText(/Changes to your inventory, characters, weapons/i)
    ).toBeInTheDocument();
  });

  it('6. Real stored events render in the activity stream', () => {
    const event = makeTestEvent({ summary: 'Mora increased by 50,000.' });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByText('Mora increased by 50,000.')).toBeInTheDocument();
    expect(screen.getByTestId('activity-event-card')).toBeInTheDocument();
  });

  it('7. Displays correct category labels and badges', () => {
    const event = makeTestEvent({ category: 'crafting', action: 'crafting_transaction_applied' });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const card = screen.getByTestId('activity-event-card');
    expect(card.textContent).toContain('Crafting');
  });

  it('8. Displays readable human source labels', () => {
    const event = makeTestEvent({ source: 'planner_inline' });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByText('Resource Planner')).toBeInTheDocument();
  });

  it('9. Formats timestamps cleanly in the UI', () => {
    const event = makeTestEvent({ timestamp: '2026-11-12T15:30:00.000Z' });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    // In UTC, 15:30 should format to Nov 12, 2026, 3:30:00 PM
    expect(screen.getByText(/Nov 12, 2026/i)).toBeInTheDocument();
  });

  it('10. Respects user configured display timezone setting', () => {
    useStore.setState({ displayTimeZone: 'Asia/Tokyo' }); // UTC+9
    const event = makeTestEvent({ timestamp: '2026-11-12T15:00:00.000Z' }); // In Tokyo: Nov 13, 2026, 00:00
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByText(/Nov 13, 2026/i)).toBeInTheDocument();
  });

  it('11. Missing optional metadata does not crash the card', () => {
    const event = makeTestEvent({ changes: undefined, metadata: undefined, entityName: undefined });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByTestId('activity-event-card')).toBeInTheDocument();
  });

  it('12. Malformed or long text is rendered safely without overflowing', () => {
    const longSummary = 'A'.repeat(500);
    const event = makeTestEvent({ summary: longSummary });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByText(longSummary)).toBeInTheDocument();
  });

  it('13. Expanded details show correct before/after/delta diff table', () => {
    const event = makeTestEvent({
      changes: [
        { field: 'quantity', label: 'Quantity', before: 120, after: 150, delta: '+30' },
        { field: 'level', label: 'Level', before: 80, after: 90, delta: '+10' },
      ],
    });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const expandBtn = screen.getByRole('button', { name: /Slime Condensate updated/i });
    fireEvent.click(expandBtn);

    expect(screen.getByTestId('activity-event-details')).toBeInTheDocument();
    expect(screen.getByText('+30')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
  });

  it('14. Renders crafting transaction metadata breakdown', () => {
    const event = makeTestEvent({
      category: 'crafting',
      action: 'crafting_transaction_applied',
      transactionId: 'tx-craft-999',
      metadata: {
        moraSpent: 12500,
        batchesCrafted: 5,
        recipeName: 'Shivada Jade Gemstone',
      },
    });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const expandBtn = screen.getByRole('button', { name: /Slime Condensate/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText('tx-craft-999')).toBeInTheDocument();
    expect(screen.getByText('12,500')).toBeInTheDocument();
  });

  it('15. Uncertain crafting outcome displays prominent warning banner', () => {
    const event = makeTestEvent({
      category: 'crafting',
      action: 'crafting_transaction_uncertain',
      summary: 'Crafting transaction uncertain.',
    });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByText(/Outcome Uncertain/i)).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /Crafting transaction uncertain/i });
    fireEvent.click(expandBtn);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Uncertain Crafting Transaction:/i)).toBeInTheDocument();
  });

  it('16. Grouped import details display structured counts', () => {
    const event = makeTestEvent({
      category: 'import_sync',
      action: 'good_import_applied',
      summary: 'Imported GOOD data.',
      metadata: {
        materialsUpdated: 15,
        charactersCreated: 2,
        weaponsCreated: 4,
      },
    });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Imported GOOD data/i }));
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('17. Truncation notice renders when event was truncated', () => {
    const event = makeTestEvent({ truncated: true });
    useActivityStore.getState().appendEvent(event);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Slime Condensate/i }));
    expect(
      screen.getByText(/Some details were omitted to stay within Activity History storage limits/i)
    ).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH, FILTERS & PAGINATION (Tests 18–28)
  // ─────────────────────────────────────────────────────────────────────────

  it('18. Search filters events by summary text', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ summary: 'First unique search target' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ summary: 'Second different action' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search by summary/i);
    fireEvent.change(input, { target: { value: 'unique search' } });

    expect(screen.getByText('First unique search target')).toBeInTheDocument();
    expect(screen.queryByText('Second different action')).toBeNull();
  });

  it('19. Search filters events by entity name and entity ID', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ entityName: 'Diluc', summary: 'Level changed' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ entityName: 'Jean', summary: 'Ascension changed' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search by summary/i);
    fireEvent.change(input, { target: { value: 'diluc' } });

    expect(screen.getByText('Level changed')).toBeInTheDocument();
    expect(screen.queryByText('Ascension changed')).toBeNull();
  });

  it('20. Search filters events by transaction ID', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ transactionId: 'tx-spec-1234', summary: 'Alpha craft' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ transactionId: 'tx-other-5678', summary: 'Beta craft' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search by summary/i);
    fireEvent.change(input, { target: { value: '1234' } });

    expect(screen.getByText('Alpha craft')).toBeInTheDocument();
    expect(screen.queryByText('Beta craft')).toBeNull();
  });

  it('21. Category filtering filters events accurately', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ category: 'weapons', summary: 'Wolfs Gravestone added' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ category: 'inventory', summary: 'Crystal chunk added' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const weaponsTab = screen.getByRole('tab', { name: 'Weapons' });
    fireEvent.click(weaponsTab);

    expect(screen.getByText('Wolfs Gravestone added')).toBeInTheDocument();
    expect(screen.queryByText('Crystal chunk added')).toBeNull();
  });

  it('22. Date range filtering filters events accurately', () => {
    const today = new Date().toISOString();
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

    useActivityStore.getState().appendEvent(makeTestEvent({ timestamp: today, summary: 'Recent event' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ timestamp: oldDate, summary: 'Old event' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const dateSelect = screen.getByLabelText(/Date Range/i);
    fireEvent.change(dateSelect, { target: { value: '7days' } });

    expect(screen.getByText('Recent event')).toBeInTheDocument();
    expect(screen.queryByText('Old event')).toBeNull();
  });

  it('23. Newest-first sorting orders events newest to oldest', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ id: '1', timestamp: '2026-11-12T10:00:00Z', summary: 'Early' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ id: '2', timestamp: '2026-11-12T14:00:00Z', summary: 'Late' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const cards = screen.getAllByTestId('activity-event-card');
    expect(cards[0].textContent).toContain('Late');
    expect(cards[1].textContent).toContain('Early');
  });

  it('24. Oldest-first sorting orders events oldest to newest', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ id: '1', timestamp: '2026-11-12T10:00:00Z', summary: 'Early' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ id: '2', timestamp: '2026-11-12T14:00:00Z', summary: 'Late' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const sortSelect = screen.getByLabelText(/Sort Order/i);
    fireEvent.change(sortSelect, { target: { value: 'oldest' } });

    const cards = screen.getAllByTestId('activity-event-card');
    expect(cards[0].textContent).toContain('Early');
    expect(cards[1].textContent).toContain('Late');
  });

  it('25. Stable timestamp ties break deterministically by UUID', () => {
    const time = '2026-11-12T10:00:00Z';
    const idA = '11111111-1111-4111-8111-111111111111';
    const idB = '22222222-2222-4222-8222-222222222222';
    useActivityStore.getState().appendEvent(makeTestEvent({ id: idB, timestamp: time, summary: 'B Tie' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ id: idA, timestamp: time, summary: 'A Tie' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const cards = screen.getAllByTestId('activity-event-card');
    expect(cards[0].getAttribute('data-event-id')).toBe(idA);
    expect(cards[1].getAttribute('data-event-id')).toBe(idB);
  });

  it('26. Load More button loads 50 more items', () => {
    for (let i = 0; i < 60; i++) {
      useActivityStore.getState().appendEvent(
        makeTestEvent({ id: `item-${String(i).padStart(3, '0')}`, summary: `Event number ${i}` })
      );
    }

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getAllByTestId('activity-event-card')).toHaveLength(50);
    const loadMoreBtn = screen.getByRole('button', { name: /Load More/i });
    fireEvent.click(loadMoreBtn);

    expect(screen.getAllByTestId('activity-event-card')).toHaveLength(60);
  });

  it('27. Filters reset pagination window back to initial 50', () => {
    for (let i = 0; i < 60; i++) {
      useActivityStore.getState().appendEvent(
        makeTestEvent({ id: `item-${String(i).padStart(3, '0')}`, summary: `Event number ${i}` })
      );
    }

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Load More/i }));
    expect(screen.getAllByTestId('activity-event-card')).toHaveLength(60);

    // Filter change resets window
    const input = screen.getByPlaceholderText(/Search by summary/i);
    fireEvent.change(input, { target: { value: 'Event' } });

    expect(screen.getAllByTestId('activity-event-card')).toHaveLength(50);
  });

  it('28. Renders "No matching activities" state with Clear Filters button', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ summary: 'Existing activity' }));

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search by summary/i);
    fireEvent.change(input, { target: { value: 'non_existent_query_xyz' } });

    expect(screen.getByTestId('activity-no-matches')).toBeInTheDocument();
    expect(screen.getByText('No matching activities.')).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Filters/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Existing activity')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT (Tests 29–32)
  // ─────────────────────────────────────────────────────────────────────────

  it('29. Export uses the exact A2 envelope schema', () => {
    const testId = '11111111-1111-4111-8111-111111111111';
    const e1 = makeTestEvent({ id: testId });
    const payload = createActivityExportPayload([e1]);

    expect(payload.app).toBe('travelers-toolkit');
    expect(payload.format).toBe('travelers-toolkit-activity-history');
    expect(payload.schemaVersion).toBe(1);
    expect(payload.eventCount).toBe(1);
    expect(payload.events[0].id).toBe(testId);
  });

  it('30. Export includes all retained history regardless of active filters', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ category: 'inventory', summary: 'Item 1' }));
    useActivityStore.getState().appendEvent(makeTestEvent({ category: 'weapons', summary: 'Item 2' }));

    const notifySpy = vi.spyOn(notify, 'success');
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    // Apply filter to only see weapons
    fireEvent.click(screen.getByRole('tab', { name: 'Weapons' }));
    expect(screen.queryByText('Item 1')).toBeNull();

    // Export button exports all 2
    fireEvent.click(screen.getByRole('button', { name: /Export History/i }));
    expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Exported 2 activity event(s)'));
  });

  it('31. Export preserves original event timestamps', () => {
    const originalTime = '2026-10-01T08:00:00.000Z';
    const e = makeTestEvent({ timestamp: originalTime });
    const payload = createActivityExportPayload([e]);

    expect(payload.events[0].timestamp).toBe(originalTime);
  });

  it('32. Export does not modify domain state', () => {
    useStore.setState({ roster: { Amber: { name: 'Amber', level: 20 } } });
    useActivityStore.getState().appendEvent(makeTestEvent());

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Export History/i }));
    expect(useStore.getState().roster.Amber.level).toBe(20);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IMPORT (Tests 33–44)
  // ─────────────────────────────────────────────────────────────────────────

  it('33. Valid import opens preview modal and confirms merge', async () => {
    const notifySpy = vi.spyOn(notify, 'success');
    const validFileContent = JSON.stringify({
      app: 'travelers-toolkit',
      format: 'travelers-toolkit-activity-history',
      schemaVersion: 1,
      exportedAt: '2026-11-12T12:00:00.000Z',
      eventCount: 1,
      events: [makeTestEvent({ id: 'imported-valid-1', summary: 'Imported Hero' })],
    });

    const file = new File([validFileContent], 'activity-backup.json', { type: 'application/json' });

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByRole('dialog', { name: /Import Activity History/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Import/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Import complete: 1 new event(s) added'));
    });

    expect(await screen.findByText('Imported Hero')).toBeInTheDocument();

    // Verify storage key usage: written to travelers-toolkit-activity-log, not travelers-toolkit-activity-history
    const rawStored = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    expect(rawStored).not.toBeNull();
    expect(rawStored).toContain('Imported Hero');
    expect(window.localStorage.getItem('travelers-toolkit-activity-history')).toBeNull();
  });

  it('34. Invalid envelope format rejection displays notification error', async () => {
    const notifySpy = vi.spyOn(notify, 'error');
    const invalidFile = new File(['{"app":"unknown-app"}'], 'bad.json', { type: 'application/json' });

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Invalid application identifier'));
    });
  });

  it('35. Unsupported future schema rejection displays error', async () => {
    const notifySpy = vi.spyOn(notify, 'error');
    const futureFile = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 99,
          events: [],
        }),
      ],
      'future.json',
      { type: 'application/json' }
    );

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [futureFile] } });

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Unsupported schema version'));
    });
  });

  it('36. Malformed individual events are counted as skipped', async () => {
    const fileWithCorruptEvent = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 2,
          events: [
            makeTestEvent({ id: 'valid-event' }),
            { id: 'corrupt-event', invalidKey: true },
          ],
        }),
      ],
      'mixed.json',
      { type: 'application/json' }
    );

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [fileWithCorruptEvent] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/1 malformed\/invalid event\(s\) will be skipped/i)).toBeInTheDocument();
  });

  it('37. Duplicate UUIDs in imported file are detected and suppressed', async () => {
    const existing = makeTestEvent({ id: 'existing-id-1', summary: 'Pre-existing event' });
    useActivityStore.getState().appendEvent(existing);

    const duplicateFile = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 1,
          events: [existing],
        }),
      ],
      'dup.json',
      { type: 'application/json' }
    );

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [duplicateFile] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Existing Duplicates').nextSibling.textContent).toBe('1');
  });

  it('38. Original timestamps are preserved during import', async () => {
    const historicalTime = '2026-01-15T09:00:00.000Z';
    const testId = '22222222-2222-4222-8222-222222222222';
    const importPayload = [makeTestEvent({ id: testId, timestamp: historicalTime })];

    const result = useActivityStore.getState().setEventsFromImport(importPayload);
    expect(result.success).toBe(true);

    const saved = useActivityStore.getState().events.find((e) => e.id === testId);
    expect(saved.timestamp).toBe(historicalTime);
  });

  it('39. Deterministic chronological ordering is maintained after import', () => {
    const idMid = '22222222-2222-4222-8222-222222222222';
    const idLate = '33333333-3333-4333-8333-333333333333';
    const idEarly = '11111111-1111-4111-8111-111111111111';

    useActivityStore.getState().appendEvent(makeTestEvent({ id: idMid, timestamp: '2026-11-12T12:00:00Z' }));

    const imported = [
      makeTestEvent({ id: idLate, timestamp: '2026-11-12T18:00:00Z' }),
      makeTestEvent({ id: idEarly, timestamp: '2026-11-12T06:00:00Z' }),
    ];

    useActivityStore.getState().setEventsFromImport(imported);

    const events = getActivityEvents();
    expect(events.map((e) => e.id)).toEqual([idEarly, idMid, idLate]);
  });

  it('40. Retention bounds prune oldest events when import exceeds limits', () => {
    const largeBatch = [];
    for (let i = 0; i < 1050; i++) {
      largeBatch.push(
        makeTestEvent({
          id: `imp-${String(i).padStart(4, '0')}`,
          timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        })
      );
    }

    const result = useActivityStore.getState().setEventsFromImport(largeBatch);
    expect(result.success).toBe(true);
    expect(result.prunedCount).toBe(50);
    expect(getActivityEvents()).toHaveLength(1000);
  });

  it('41. Cancelling import preview modal leaves history completely unchanged', async () => {
    const initialId = '11111111-1111-4111-8111-111111111111';
    useActivityStore.getState().appendEvent(makeTestEvent({ id: initialId }));
    expect(getActivityEvents()).toHaveLength(1);

    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 1,
          events: [makeTestEvent({ id: '22222222-2222-4222-8222-222222222222' })],
        }),
      ],
      'cancel.json',
      { type: 'application/json' }
    );

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getActivityEvents()).toHaveLength(1);
    expect(getActivityEvents()[0].id).toBe(initialId);
  });

  it('42. Storage failure during import produces no false success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Disk full');
    });

    const result = useActivityStore.getState().setEventsFromImport([makeTestEvent()]);
    expect(result.success).toBe(false);
    expect(result.imported).toBe(0);
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('43. Successful import creates exactly one informational activity_history_imported event', async () => {
    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 1,
          events: [makeTestEvent({ id: 'info-test-1' })],
        }),
      ],
      'info.json',
      { type: 'application/json' }
    );

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Import/i }));

    await waitFor(() => {
      const all = getActivityEvents();
      expect(all.some((e) => e.action === 'activity_history_imported')).toBe(true);
      const infoEvt = all.find((e) => e.action === 'activity_history_imported');
      expect(infoEvt.category).toBe('import_sync');
      expect(infoEvt.source).toBe('activity_history_import');
    });
  });

  it('44. Importing activity history NEVER modifies domain state (inventory/roster/weapons/achievements)', () => {
    useStore.setState({
      inventory: { mora: 100 },
      roster: { Diluc: { name: 'Diluc', level: 1 } },
      trackedWeapons: [],
      achievementProgress: {},
    });

    const fileEvents = [
      makeTestEvent({
        category: 'inventory',
        action: 'inventory_updated',
        summary: 'Mora updated to 9999999',
        changes: [{ field: 'mora', before: 100, after: 9999999 }],
      }),
    ];

    useActivityStore.getState().setEventsFromImport(fileEvents);

    // Invariant check: Domain state remains 100!
    expect(useStore.getState().inventory.mora).toBe(100);
    expect(useStore.getState().roster.Diluc.level).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR HISTORY (Tests 45–50)
  // ─────────────────────────────────────────────────────────────────────────

  it('45. Cancelling clear confirmation modal leaves history intact', async () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ summary: 'Do not delete me' }));
    expect(getActivityEvents()).toHaveLength(1);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Clear History/i }));
    expect(await screen.findByRole('dialog', { name: /Clear Activity History\?/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('46. Confirming clear removes all activity history', async () => {
    useActivityStore.getState().appendEvent(makeTestEvent());
    expect(getActivityEvents()).toHaveLength(1);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Clear History/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const confirmBtns = screen.getAllByRole('button', { name: /Clear History/i });
    const modalConfirmBtn = confirmBtns[confirmBtns.length - 1];
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(getActivityEvents()).toHaveLength(0);
      expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument();
    });
  });

  it('47. Page refresh (reconcileFromDisk) preserves cleared state', () => {
    useActivityStore.getState().appendEvent(makeTestEvent());
    expect(getActivityEvents()).toHaveLength(1);

    useActivityStore.getState().clearHistory();
    expect(getActivityEvents()).toHaveLength(0);

    // Simulate page reload
    useActivityStore.getState().reconcileFromDisk();
    expect(getActivityEvents()).toHaveLength(0);
  });

  it('48. Storage failure during clear is reported accurately', async () => {
    useActivityStore.getState().appendEvent(makeTestEvent());
    const notifySpy = vi.spyOn(notify, 'error');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage locked');
    });

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Clear History/i }));
    const confirmBtns = screen.getAllByRole('button', { name: /Clear History/i });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith(expect.stringContaining('Failed to clear activity history'));
    });

    // Invariant: failure during clear preserves all existing events
    expect(getActivityEvents()).toHaveLength(1);
  });

  it('49. Clearing activity history never deletes unrelated localStorage keys', () => {
    window.localStorage.setItem('my_custom_key', 'keep_me_safe');
    useActivityStore.getState().appendEvent(makeTestEvent());

    useActivityStore.getState().clearHistory();

    expect(window.localStorage.getItem('my_custom_key')).toBe('keep_me_safe');
  });

  it('50. Clearing activity history leaves domain records untouched', () => {
    useStore.setState({
      inventory: { mora: 50000 },
      roster: { Zhongli: { name: 'Zhongli', level: 90 } },
    });
    useActivityStore.getState().appendEvent(makeTestEvent());

    useActivityStore.getState().clearHistory();

    expect(useStore.getState().inventory.mora).toBe(50000);
    expect(useStore.getState().roster.Zhongli.level).toBe(90);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRATION (Tests 51–56)
  // ─────────────────────────────────────────────────────────────────────────

  it('51. Real inventory mutation produces an event visible on Activity History', async () => {
    useStore.getState().setInventory('crystal_chunk', 50, 'inventory_page');

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(await screen.findByText(/crystal_chunk changed from 0 to 50/i)).toBeInTheDocument();
  });

  it('52. Real character mutation produces an event visible on Activity History', async () => {
    useStore.getState().addCharacter('Keqing', 'character_modal');

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Added Keqing to the character roster/i)).toBeInTheDocument();
  });

  it('53. Live same-tab store update immediately renders on mounted page', async () => {
    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument();

    act(() => {
      useStore.getState().setInventory('white_iron_chunk', 20, 'inventory_page');
    });

    expect(await screen.findByText(/white_iron_chunk changed from 0 to 20/i)).toBeInTheDocument();
  });

  it('54. Cross-tab storage synchronization updates mounted page', async () => {
    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    expect(screen.getByTestId('activity-empty-state')).toBeInTheDocument();

    // Simulate external tab write to localStorage
    const newExternalEvent = makeTestEvent({ summary: 'External Tab Activity' });
    const envelope = {
      schemaVersion: 1,
      lastUpdated: new Date().toISOString(),
      events: [newExternalEvent],
    };
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(envelope));

    // Fire native storage event
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: ACTIVITY_STORAGE_KEY,
          newValue: JSON.stringify(envelope),
        })
      );
    });

    expect(await screen.findByText('External Tab Activity')).toBeInTheDocument();
  });

  it('55. A5 factory reset retains or clears history correctly and reflects in UI', () => {
    useActivityStore.getState().appendEvent(makeTestEvent({ summary: 'Pre-reset event' }));
    expect(getActivityEvents()).toHaveLength(1);

    // Factory reset retaining history
    useStore.getState().resetStore({ logActivity: true, clearHistory: false });
    const eventsRetained = getActivityEvents();
    expect(eventsRetained).toHaveLength(2);
    expect(eventsRetained.some((e) => e.action === 'factory_reset_performed')).toBe(true);

    // Factory reset clearing history
    useStore.getState().resetStore({ logActivity: true, clearHistory: true });
    const eventsCleared = getActivityEvents();
    expect(eventsCleared).toHaveLength(1);
    expect(eventsCleared[0].action === 'factory_reset_performed');
  });

  it('56. Activity History UI has zero undo or rollback controls', () => {
    useActivityStore.getState().appendEvent(makeTestEvent());

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    // Invariant: no undo, revert, rollback, restore buttons exist!
    expect(screen.queryByText(/undo/i)).toBeNull();
    expect(screen.queryByText(/revert/i)).toBeNull();
    expect(screen.queryByText(/rollback/i)).toBeNull();
    expect(screen.queryByText(/restore this state/i)).toBeNull();
  });
});


import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ActivityHistory from './ActivityHistory';
import ActivityImportModal from '../components/ActivityHistory/ActivityImportModal';
import ActivityClearModal from '../components/ActivityHistory/ActivityClearModal';
import useStore from '../store/useStore';
import {
  useActivityStore,
  clearActivityHistory,
  getActivityEvents,
  createActivityExportPayload,
  getSerializedByteSize,
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

describe('ACTIVITY-HISTORY-A7: Integration, Reconciliation & Accessibility Audit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearActivityHistory();
    useStore.setState({
      roster: {},
      trackedWeapons: [],
      inventory: {},
      achievementProgress: {},
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Issue A: Duplicate Counting & Totals Reconciliation
  // ───────────────────────────────────────────────────────────────────────────
  it('1. Reconciles fileDuplicatesCount, existingDuplicatesCount, and newCandidateCount', async () => {
    const existingId = '11111111-1111-4111-8111-111111111111';
    const newIdA = '22222222-2222-4222-8222-222222222222';
    const newIdB = '33333333-3333-4333-8333-333333333333';

    // Seed existing event in ledger
    useActivityStore.getState().appendEvent(makeTestEvent({ id: existingId }));

    // File contains 4 events total:
    // - 1 existing in ledger (existingId)
    // - 2 instances of newIdA (first is candidate, second is file duplicate)
    // - 1 instance of newIdB (candidate)
    const importEvents = [
      makeTestEvent({ id: existingId }),
      makeTestEvent({ id: newIdA }),
      makeTestEvent({ id: newIdA }),
      makeTestEvent({ id: newIdB }),
    ];

    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 4,
          events: importEvents,
        }),
      ],
      'recon-test.json',
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

    // Invariant: validCount (4) === fileDuplicates (1) + existingDuplicates (1) + newCandidate (2)
    expect(screen.getByText('Valid Events').nextSibling.textContent).toBe('4');
    expect(screen.getByText('New to Add').nextSibling.textContent).toBe('2');
    expect(screen.getByText('Existing Duplicates').nextSibling.textContent).toBe('1');
    expect(screen.getByText('Duplicate Records in File').nextSibling.textContent).toBe('1');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Issue B: Informational Import Event Includes Skipped Validation Records
  // ───────────────────────────────────────────────────────────────────────────
  it('2. Records skipped invalid file records in activity_history_imported event', async () => {
    const validId = '44444444-4444-4444-8444-444444444444';
    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 3,
          events: [
            makeTestEvent({ id: validId }),
            { notAnEvent: true }, // invalid record 1
            { schemaVersion: 'bad_version' }, // invalid record 2
          ],
        }),
      ],
      'invalid-records.json',
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
    expect(screen.getByText(/2 malformed\/invalid event\(s\) will be skipped/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Import/i }));

    await waitFor(() => {
      const all = getActivityEvents();
      const infoEvt = all.find((e) => e.action === 'activity_history_imported');
      expect(infoEvt).toBeDefined();
      expect(infoEvt.metadata.invalidCount).toBe(2);
      expect(infoEvt.metadata.importedCount).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Issue C: Retention Pruning Differentiation (accepted vs retained vs pruned)
  // ───────────────────────────────────────────────────────────────────────────
  it('3. Distinguishes acceptedCount, retainedImportedCount, and prunedImportedCount', () => {
    const largeBatch = [];
    for (let i = 0; i < 1050; i++) {
      largeBatch.push(
        makeTestEvent({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        })
      );
    }

    const result = useActivityStore.getState().setEventsFromImport(largeBatch);
    expect(result.success).toBe(true);
    expect(result.acceptedCount).toBe(1050);
    expect(result.retainedImportedCount).toBe(1000);
    expect(result.prunedImportedCount).toBe(50);
    expect(result.retainedCount).toBe(1000);
    expect(result.imported).toBe(1000); // Truthful retained count
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility: Roving Tabindex & Keyboard Navigation on Category Tabs
  // ───────────────────────────────────────────────────────────────────────────
  it('4. Navigates category filter tabs via roving tabindex and arrow keys', () => {
    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const allTab = screen.getByRole('tab', { name: 'All Categories' });
    const invTab = screen.getByRole('tab', { name: 'Inventory' });
    const charTab = screen.getByRole('tab', { name: 'Characters' });
    const goalsTab = screen.getByRole('tab', { name: 'Goals' });

    // Initial state: 'All' is selected with tabIndex 0, other tabs have tabIndex -1
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(allTab).toHaveAttribute('tabIndex', '0');
    expect(invTab).toHaveAttribute('aria-selected', 'false');
    expect(invTab).toHaveAttribute('tabIndex', '-1');

    // ArrowRight navigates to Inventory
    fireEvent.keyDown(allTab, { key: 'ArrowRight' });
    expect(invTab).toHaveAttribute('aria-selected', 'true');
    expect(invTab).toHaveAttribute('tabIndex', '0');
    expect(allTab).toHaveAttribute('aria-selected', 'false');
    expect(allTab).toHaveAttribute('tabIndex', '-1');

    // ArrowRight again navigates to Characters
    fireEvent.keyDown(invTab, { key: 'ArrowRight' });
    expect(charTab).toHaveAttribute('aria-selected', 'true');
    expect(charTab).toHaveAttribute('tabIndex', '0');

    // ArrowLeft navigates back to Inventory
    fireEvent.keyDown(charTab, { key: 'ArrowLeft' });
    expect(invTab).toHaveAttribute('aria-selected', 'true');

    // End key navigates directly to Goals (last tab)
    fireEvent.keyDown(invTab, { key: 'End' });
    expect(goalsTab).toHaveAttribute('aria-selected', 'true');
    expect(goalsTab).toHaveAttribute('tabIndex', '0');

    // Home key navigates directly to All (first tab)
    fireEvent.keyDown(goalsTab, { key: 'Home' });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(allTab).toHaveAttribute('tabIndex', '0');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility: Focus Trap & Return Focus for Modals
  // ───────────────────────────────────────────────────────────────────────────
  it('5. Traps Tab and Shift+Tab focus inside ActivityImportModal', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ActivityImportModal
        importData={{
          fileName: 'test.json',
          declaredCount: 1,
          validCount: 1,
          invalidCount: 0,
          duplicateCount: 0,
          newCount: 1,
        }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const closeBtn = screen.getByLabelText('Close dialog');
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    const confirmBtn = screen.getByRole('button', { name: /Confirm Import/i });
    expect(cancelBtn).toBeInTheDocument();

    // Focus last element (confirm button)
    confirmBtn.focus();
    expect(document.activeElement).toBe(confirmBtn);

    // Press Tab: wraps around to first focusable element (close button)
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Press Shift+Tab from first element: wraps around to last element (confirm button)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
  });

  it('6. Restores focus to the trigger button when ActivityImportModal closes', async () => {
    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const importTriggerBtn = screen.getByRole('button', { name: /Import History/i });
    importTriggerBtn.focus();
    expect(document.activeElement).toBe(importTriggerBtn);

    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 1,
          events: [makeTestEvent()],
        }),
      ],
      'focus-return.json',
      { type: 'application/json' }
    );

    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Close the modal
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Focus returned to the button that triggered the modal
    await waitFor(() => {
      expect(document.activeElement).toBe(importTriggerBtn);
    });
  });

  it('7. Traps Tab and Shift+Tab focus inside ActivityClearModal', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(<ActivityClearModal onConfirm={onConfirm} onCancel={onCancel} />);

    const closeBtn = screen.getByLabelText('Close dialog');
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    const clearBtn = screen.getByRole('button', { name: /Clear History/i });
    expect(cancelBtn).toBeInTheDocument();

    // Focus last element (clear button)
    clearBtn.focus();
    expect(document.activeElement).toBe(clearBtn);

    // Tab wraps to close button
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab wraps back to clear button
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(clearBtn);
  });

  it('8. Restores focus to trigger button when ActivityClearModal closes', async () => {
    // Add event so Clear History button is enabled
    useActivityStore.getState().appendEvent(makeTestEvent());

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    const clearTriggerBtn = screen.getByRole('button', { name: /Clear History/i });
    clearTriggerBtn.focus();
    fireEvent.click(clearTriggerBtn);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Cancel modal
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(clearTriggerBtn);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Round Trip & Security Checks
  // ───────────────────────────────────────────────────────────────────────────
  it('9. Round trip preserves all events, UUIDs, timestamps, and changes intact', () => {
    const originalEvents = [
      makeTestEvent({
        id: '11111111-2222-4333-8444-555555555555',
        timestamp: '2026-05-01T10:00:00.000Z',
        category: 'characters',
        action: 'character_added',
        summary: 'Added Furina to roster',
        changes: [{ field: 'level', before: null, after: 90 }],
      }),
      makeTestEvent({
        id: '22222222-3333-4444-8555-666666666666',
        timestamp: '2026-05-02T11:00:00.000Z',
        category: 'weapons',
        action: 'weapon_added',
        summary: 'Added Splendor of Tranquil Waters',
      }),
    ];

    for (const ev of originalEvents) {
      useActivityStore.getState().appendEvent(ev);
    }

    const payload = createActivityExportPayload(getActivityEvents());
    expect(payload.eventCount).toBe(2);

    // Clear history completely
    clearActivityHistory();
    expect(getActivityEvents()).toHaveLength(0);

    // Re-import payload
    const importResult = useActivityStore.getState().setEventsFromImport(payload.events);
    expect(importResult.success).toBe(true);
    expect(importResult.retainedImportedCount).toBe(2);

    const restored = getActivityEvents();
    expect(restored).toHaveLength(2);
    expect(restored[0].id).toBe(originalEvents[0].id);
    expect(restored[0].summary).toBe('Added Furina to roster');
    expect(restored[1].id).toBe(originalEvents[1].id);
    expect(restored[1].summary).toBe('Added Splendor of Tranquil Waters');
  });

  it('10. Safely escapes malicious XSS strings and renders as text without execution', () => {
    const xssEvent = makeTestEvent({
      summary: '<script>window.__xss_attack_executed = true;</script>',
      entityName: '<img src="x" onerror="window.__xss_attack_executed = true;" />',
    });

    useActivityStore.getState().appendEvent(xssEvent);

    render(
      <MemoryRouter>
        <ActivityHistory />
      </MemoryRouter>
    );

    // Script must not execute
    expect(window.__xss_attack_executed).toBeUndefined();

    // Renders safely as text inside the DOM
    expect(
      screen.getByText('<script>window.__xss_attack_executed = true;</script>')
    ).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A7.1: Import Retention Accounting for Informational Event
  // ───────────────────────────────────────────────────────────────────────────
  it('11. Importing 1,000 events accounts for informational event retention pruning truthfully', async () => {
    const notifySpy = vi.spyOn(notify, 'success');
    const thousandEvents = [];
    for (let i = 0; i < 1000; i++) {
      thousandEvents.push(
        makeTestEvent({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          timestamp: new Date(1700000000000 + i * 1000).toISOString(),
        })
      );
    }

    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: 1000,
          events: thousandEvents,
        }),
      ],
      'thousand-events.json',
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
      // Ledger maximum retained count remains 1,000
      expect(all).toHaveLength(1000);

      // Informational event is included
      const infoEvt = all.find((e) => e.action === 'activity_history_imported');
      expect(infoEvt).toBeDefined();

      // Truthful retained imported count is 999 (1 was pruned for informational event)
      expect(infoEvt.metadata.importedCount).toBe(999);
      expect(infoEvt.metadata.retainedImportedCount).toBe(999);
      expect(infoEvt.metadata.acceptedCount).toBe(1000);
      expect(infoEvt.metadata.prunedImportedCount).toBe(1);
      expect(infoEvt.metadata.prunedCount).toBe(1);
      expect(infoEvt.metadata.retainedCount).toBe(1000);

      // Verify success notification does not overstate retained entries
      expect(notifySpy).toHaveBeenCalledWith(
        'Import complete: 999 new event(s) added. 1 oldest event(s) pruned for storage retention.'
      );
    });
  });

  it('12. Large payload near 768 KiB enforces size-based pruning atomically with informational event', async () => {
    const notifySpy = vi.spyOn(notify, 'success');
    // Create large events with ~1,500 bytes each to fill ~750 KiB
    const largeBatch = [];
    const largeText = 'A'.repeat(1200);
    for (let i = 0; i < 520; i++) {
      largeBatch.push(
        makeTestEvent({
          id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          timestamp: new Date(1700000000000 + i * 1000).toISOString(),
          summary: `Large event ${i}: ${largeText}`,
        })
      );
    }

    const file = new File(
      [
        JSON.stringify({
          app: 'travelers-toolkit',
          format: 'travelers-toolkit-activity-history',
          schemaVersion: 1,
          eventCount: largeBatch.length,
          events: largeBatch,
        }),
      ],
      'large-batch.json',
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
      // Informational event is included
      const infoEvt = all.find((e) => e.action === 'activity_history_imported');
      expect(infoEvt).toBeDefined();

      // Total serialized bytes must be <= 768,000
      const totalBytes = getSerializedByteSize({
        schemaVersion: 1,
        lastUpdated: new Date().toISOString(),
        events: all,
      });
      expect(totalBytes).toBeLessThanOrEqual(768000);

      // Pruned count > 0 and accurately tracked
      expect(infoEvt.metadata.prunedCount).toBeGreaterThan(0);
      expect(infoEvt.metadata.importedCount).toBe(all.length - 1);
      expect(notifySpy).toHaveBeenCalled();
    });
  });
});

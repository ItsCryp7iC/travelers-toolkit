import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Lightweight test helper to render a component wrapped in a MemoryRouter.
 */
export function renderWithRouter(
  ui,
  { initialEntries = ['/'], ...options } = {}
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
    options
  );
}

/**
 * Helper to produce a standard fetch response mock.
 */
export function mockFetchResponse(data, { ok = true, status = 200 } = {}) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () =>
      Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

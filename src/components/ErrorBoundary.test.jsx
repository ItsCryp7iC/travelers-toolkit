import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function ProblemChild({ shouldThrow = true }) {
  if (shouldThrow) {
    throw new Error('Secret internal sensitive database stack trace 0xdeadbeef');
  }
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary Component', () => {
  let container = null;
  let root = null;
  let originalConsoleError;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalConsoleError = console.error;
    console.error = vi.fn(); // Suppress noisy React error boundary logs
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    root = null;
    console.error = originalConsoleError;
  });

  it('renders children normally when there is no error', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toContain('Everything is fine');
  });

  it('catches render error and displays user-friendly fallback UI', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('Something went wrong');
    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);
    expect(buttonTexts).toContain('Reload App');
    expect(buttonTexts).toContain('Go to Dashboard');
  });

  it('does NOT expose raw internal error details to end users', () => {
    act(() => {
      root.render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).not.toContain('0xdeadbeef');
    expect(container.textContent).not.toContain('Secret internal sensitive');
  });

  it('supports custom fallback if provided', () => {
    act(() => {
      root.render(
        <ErrorBoundary fallback={<div>Custom fallback message</div>}>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );
    });

    expect(container.textContent).toContain('Custom fallback message');
    expect(container.textContent).not.toContain('Something went wrong');
  });
});

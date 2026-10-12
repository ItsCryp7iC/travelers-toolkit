import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// In React 19 + Vitest/jsdom, React requires IS_REACT_ACT_ENVIRONMENT to be explicitly enabled
// so that act(...) environments are recognized, preventing false "not configured to support act" warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

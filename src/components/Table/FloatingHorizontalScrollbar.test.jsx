import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FloatingHorizontalScrollbar } from './FloatingHorizontalScrollbar';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  // Mock window.innerHeight
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = null;
  root = null;
  vi.restoreAllMocks();
});

describe('FloatingHorizontalScrollbar', () => {
  const TestComponent = ({
    scrollWidth = 1000,
    clientWidth = 500,
    rect = { top: 100, bottom: 1200, left: 200, width: 500 }
  }) => {
    const containerRef = useRef(null);

    // Mock dimensions on ref attach
    const setRef = (el) => {
      if (el) {
        Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
        Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
        el.getBoundingClientRect = () => rect;
      }
      containerRef.current = el;
    };

    return (
      <div>
        <div ref={setRef} className="table-container table-horizontal-scroll-source" style={{ overflowX: 'auto', width: clientWidth }}>
          <div style={{ width: scrollWidth, height: '100px' }}>Table Content</div>
        </div>
        <FloatingHorizontalScrollbar scrollContainerRef={containerRef} />
      </div>
    );
  };

  it('is visible when middle of table intersects viewport', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: 100, bottom: 1200, left: 200, width: 500 }} />);
    });
    const innerSpacer = container.querySelector('.fixed > div');
    expect(innerSpacer).not.toBeNull();
    expect(innerSpacer.style.width).toBe('1000px');
    const stickyContainer = container.querySelector('.fixed');
    expect(stickyContainer.style.left).toBe('200px');
    expect(stickyContainer.style.width).toBe('500px');
  });

  it('is hidden when no horizontal overflow exists', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={500} clientWidth={500} rect={{ top: 100, bottom: 1200, left: 200, width: 500 }} />);
    });
    const stickyContainer = container.querySelector('.fixed');
    expect(stickyContainer).toBeNull();
  });

  it('is hidden when table is entirely outside viewport (above)', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: -500, bottom: -100, left: 200, width: 500 }} />);
    });
    const stickyContainer = container.querySelector('.fixed');
    expect(stickyContainer).toBeNull();
  });

  it('is hidden when table is entirely outside viewport (below)', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: 1500, bottom: 2000, left: 200, width: 500 }} />);
    });
    const stickyContainer = container.querySelector('.fixed');
    expect(stickyContainer).toBeNull();
  });

  it('is visible when table bottom is visible in viewport', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: 100, bottom: 800, left: 200, width: 500 }} />);
    });
    const innerSpacer = container.querySelector('.fixed > div');
    expect(innerSpacer).not.toBeNull();
    const stickyContainer = container.querySelector('.fixed');
    expect(stickyContainer).not.toBeNull();
  });

  it('synchronizes scroll from table to sticky scrollbar', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: 100, bottom: 1200, left: 200, width: 500 }} />);
    });

    const tableContainer = container.querySelector('.table-container');
    const stickyContainer = container.querySelector('.fixed');

    act(() => {
      tableContainer.scrollLeft = 250;
      tableContainer.dispatchEvent(new Event('scroll'));
    });

    expect(stickyContainer.scrollLeft).toBe(250);
  });

  it('synchronizes scroll from sticky scrollbar to table', () => {
    act(() => {
      root.render(<TestComponent scrollWidth={1000} clientWidth={500} rect={{ top: 100, bottom: 1200, left: 200, width: 500 }} />);
    });

    const tableContainer = container.querySelector('.table-container');
    const stickyContainer = container.querySelector('.fixed');

    act(() => {
      stickyContainer.scrollLeft = 150;
      stickyContainer.dispatchEvent(new Event('scroll'));
    });

    expect(tableContainer.scrollLeft).toBe(150);
  });
});

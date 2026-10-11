import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 8 Static Assets & Delivery Invariants', () => {
  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');

  it('genshin-font.woff2 exists and is well under size threshold (< 50 KB)', () => {
    const fontPath = path.join(publicDir, 'fonts', 'genshin-font.woff2');
    expect(fs.existsSync(fontPath)).toBe(true);
    const size = fs.statSync(fontPath).size;
    expect(size).toBeLessThan(50 * 1024);
    expect(size).toBeGreaterThan(10 * 1024);
  });

  it('bg.webp exists and is well under size threshold (< 120 KB)', () => {
    const bgPath = path.join(publicDir, 'bg.webp');
    expect(fs.existsSync(bgPath)).toBe(true);
    const size = fs.statSync(bgPath).size;
    expect(size).toBeLessThan(120 * 1024);
    expect(size).toBeGreaterThan(20 * 1024);
  });

  it('navigation icons are cleaned and under size threshold (< 25 KB each)', () => {
    for (const icon of ['Planner.png', 'Dashboard.png', 'Weapons.png']) {
      const iconPath = path.join(publicDir, icon);
      expect(fs.existsSync(iconPath)).toBe(true);
      const size = fs.statSync(iconPath).size;
      expect(size).toBeLessThan(25 * 1024);
    }
  });

  it('index.css @font-face references woff2 format and has no stale TTF references', () => {
    const cssPath = path.join(rootDir, 'src', 'index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain("url('/fonts/genshin-font.woff2') format('woff2')");
    expect(cssContent).not.toContain('genshin-font.ttf');
  });

  it('AppLayout references bg.webp and has no stale bg.png references', () => {
    const layoutPath = path.join(rootDir, 'src', 'layouts', 'AppLayout.jsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    expect(layoutContent).toContain("bg-[url('/bg.webp')]");
    const legacyBgClass = "bg-[url('" + "/bg." + "png')]";
    expect(layoutContent).not.toContain(legacyBgClass);
  });

  it('index.html preloads woff2 font and preserves Google site verification tag', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    expect(htmlContent).toContain('rel="preload"');
    expect(htmlContent).toContain('href="/fonts/genshin-font.woff2"');
    expect(htmlContent).toContain('name="google-site-verification"');
    // Ensure unused Inter font is not requested
    expect(htmlContent).not.toContain('family=Inter');
    // Ensure Cinzel is requested
    expect(htmlContent).toContain('family=Cinzel');
  });
});

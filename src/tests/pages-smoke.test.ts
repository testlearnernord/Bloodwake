import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('pages smoke script', () => {
  it('passes for valid built artifact shape', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bloodwake-smoke-'));
    const dist = join(dir, 'dist');
    const assets = join(dist, 'assets');
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<html><head><link href="/Bloodwake/assets/app.css" rel="stylesheet"></head><body><script src="/Bloodwake/assets/app.js"></script></body></html>');
    writeFileSync(join(assets, 'app.js'), 'console.log("ok")');
    writeFileSync(join(assets, 'app.css'), 'body{}');
    const script = join(process.cwd(), 'scripts', 'smoke-pages.mjs');
    const result = spawnSync('node', [script], { cwd: dir, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('smoke:pages passed');
  });
});

describe('CSS layout regression checks', () => {
  const css = readFileSync(join(process.cwd(), 'src', 'style.css'), 'utf8');

  it('overlay-root does not apply full-height to all direct children', () => {
    // The old broken rule targeted .overlay-root > * with a fixed height
    expect(css).not.toContain('.overlay-root > *');
  });

  it('.overlay-panel class exists', () => {
    expect(css).toContain('.overlay-panel');
  });

  it('.overlay-body uses overflow for internal scrolling', () => {
    // overlay-body must have overflow set so it scrolls internally
    const bodyIdx = css.indexOf('.overlay-body');
    expect(bodyIdx, '.overlay-body selector must exist in style.css').toBeGreaterThanOrEqual(0);
    const bodyBlock = css.slice(bodyIdx);
    expect(bodyBlock).toContain('overflow');
  });

  it('game shell uses content-aware top and bottom rows', () => {
    // grid-template-rows must contain auto rows (not fixed topbar-h / hud-h only)
    const appIdx = css.indexOf('.game-app');
    expect(appIdx, '.game-app selector must exist in style.css').toBeGreaterThanOrEqual(0);
    const appBlock = css.slice(appIdx);
    expect(appBlock).toContain('auto');
    // Must not use the old fixed-only row pattern
    expect(appBlock).not.toMatch(/grid-template-rows:\s*var\(--topbar-h\)\s+minmax/);
  });
});

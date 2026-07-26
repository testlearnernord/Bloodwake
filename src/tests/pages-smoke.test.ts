import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

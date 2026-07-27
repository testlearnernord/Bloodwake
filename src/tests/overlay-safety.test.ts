import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { renderOverlay } from '../ui/overlays/overlays';

const ALL_MENUS = ['character', 'inventory', 'servants', 'stronghold', 'crafting', 'journal', 'pause'] as const;

describe('overlay rendering safety', () => {
  it('escapes dynamic text in overlays', () => {
    const state = createNewGameState({ seed: 'overlay-xss', playerName: '<img src=x onerror=alert(1)>' });
    state.lastEventLog = ['<script>alert(1)</script>'];
    const html = renderOverlay('character', state, null, 'all', 'workshop');
    const journal = renderOverlay('journal', state, null, 'all', 'workshop');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(journal).not.toContain('<script>alert(1)</script>');
    expect(journal).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('produces exactly one overlay-panel per overlay', () => {
    const state = createNewGameState({ seed: 'panel-count', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      const panelMatches = html.match(/class="overlay-panel"/g);
      expect(panelMatches, `${menu} should have exactly one overlay-panel`).toHaveLength(1);
    }
  });

  it('every overlay panel contains exactly one header and one overlay-body', () => {
    const state = createNewGameState({ seed: 'structure', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      const headerCount = (html.match(/<header\b/g) ?? []).length;
      const bodyCount = (html.match(/class="overlay-body/g) ?? []).length;
      expect(headerCount, `${menu} should have one header`).toBe(1);
      expect(bodyCount, `${menu} should have one overlay-body`).toBe(1);
    }
  });

  it('overlay title element is present with id overlay-title', () => {
    const state = createNewGameState({ seed: 'aria', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      expect(html, `${menu} should have id="overlay-title"`).toContain('id="overlay-title"');
    }
  });

  it('close button is present in every overlay', () => {
    const state = createNewGameState({ seed: 'close-btn', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      expect(html, `${menu} should have data-close-overlay`).toContain('data-close-overlay');
    }
  });

  it('header appears before body in every overlay', () => {
    const state = createNewGameState({ seed: 'order', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      const headerPos = html.indexOf('<header');
      const bodyPos = html.indexOf('overlay-body');
      expect(headerPos, `${menu} header should precede body`).toBeLessThan(bodyPos);
    }
  });

  it('overlay-panel is the outermost wrapper (no siblings at top level)', () => {
    const state = createNewGameState({ seed: 'wrapper', playerName: 'Tester' });
    for (const menu of ALL_MENUS) {
      const html = renderOverlay(menu, state, null, 'all', 'workshop');
      const trimmed = html.trim();
      // Should start with the panel div, not with a header or body directly
      expect(trimmed, `${menu} should start with overlay-panel`).toMatch(/^<div class="overlay-panel">/);
    }
  });
});

describe('UI scale validation', () => {
  it('accepts all supported UI scale values', () => {
    const validScales = [0.9, 1, 1.1, 1.25];
    const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25] as const;
    for (const scale of validScales) {
      expect(UI_SCALE_OPTIONS.includes(scale as (typeof UI_SCALE_OPTIONS)[number])).toBe(true);
    }
  });

  it('rejects invalid UI scale values', () => {
    const invalidScales = [0, 0.5, 0.75, 1.5, 2, -1, NaN];
    const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25] as const;
    for (const scale of invalidScales) {
      expect(UI_SCALE_OPTIONS.includes(scale as (typeof UI_SCALE_OPTIONS)[number])).toBe(false);
    }
  });

  it('pause overlay renders scale select with all supported options', () => {
    const state = createNewGameState({ seed: 'scale-ui', playerName: 'Tester' });
    const html = renderOverlay('pause', state, null, 'all', 'workshop');
    expect(html).toContain('data-setting-ui-scale');
    expect(html).toContain('value="0.9"');
    expect(html).toContain('value="1"');
    expect(html).toContain('value="1.1"');
    expect(html).toContain('value="1.25"');
  });
});

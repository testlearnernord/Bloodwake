import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { getRecipeReadiness, renderOverlay } from '../ui/overlays/overlays';

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

  it('renders human servants when the save contains them', () => {
    const state = createNewGameState({ seed: 'human-servants', playerName: 'Tester' });
    const human = state.npcs[0]!;
    state.humanServants = [
      {
        kind: 'human_servant',
        id: `servant-${human.id}`,
        name: human.name,
        age: human.age,
        professionId: human.professionId,
        attributes: { ...human.attributes },
        traitIds: [...human.traitIds],
        familyName: human.familyName,
        factionId: human.factionId,
        bloodResonance: human.bloodResonance,
        resolve: human.resolve,
        disposition: human.disposition,
        fear: human.fear,
        relationships: { ...human.relationships },
        resistance: human.resolve,
        control: 70,
        health: human.health,
        maxHealth: human.maxHealth,
        stress: human.stress,
        combat: human.combat,
        professionSkills: {},
        priorities: {
          Building: 'Low',
          Crafting: 'Disabled',
          Gathering: 'Normal',
          Guarding: 'Low',
          Research: 'Disabled',
          Hunting: 'Disabled',
        },
        currentJob: null,
        currentTask: null,
        taskReason: 'Held under vampiric control.',
        equipped: {},
      },
    ];

    const html = renderOverlay('servants', state, null, 'all', 'workshop');
    expect(html).toContain(human.name);
    expect(html).not.toContain('No human thralls.');
  });
});

describe('overlay readiness text', () => {
  it('uses vassal terminology for missing crafters', () => {
    const state = createNewGameState({ seed: 'crafting-vassal-text', playerName: 'Tester' });
    state.rooms.push({
      id: 'room-workshop-1-0',
      roomId: 'workshop',
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      status: 'built',
      progress: 0,
      assignedWorkerIds: [],
    });

    expect(getRecipeReadiness(state, 'wood_planks')).toEqual({
      ready: false,
      reason: 'Need a vassal with Crafting enabled.',
    });
  });
});

describe('UI scale validation', () => {
  it('pause overlay renders scale select with all supported options', () => {
    const state = createNewGameState({ seed: 'scale-ui', playerName: 'Tester' });
    const html = renderOverlay('pause', state, null, 'all', 'workshop');
    expect(html).toContain('data-setting-ui-scale');
    const optionValues = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    expect(optionValues).toEqual(['0.9', '1', '1.1', '1.25']);
  });
});

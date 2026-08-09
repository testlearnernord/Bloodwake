import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction, validateHumanAction } from '../simulation/combat/bite';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import { isHumanPresentInWorld } from '../simulation/world/humans';
import {
  getNightlyEnemySpawns,
  getNightlyHumanPosition,
  getNightlyResourceNodes,
  markHumanEscaped,
  resolveNightlyHumanPopulation,
} from '../simulation/world/nightlyWorld';

const cycleToNight = (state: ReturnType<typeof createNewGameState>) => advanceWorldPhase(advanceWorldPhase(state).state).state;

describe('0.6.3c nightly world variation', () => {
  it('generates deterministic but day-varying enemies, resources, and human positions', () => {
    const enemiesA = getNightlyEnemySpawns('variation', 3);
    const enemiesAgain = getNightlyEnemySpawns('variation', 3);
    const enemiesNext = getNightlyEnemySpawns('variation', 4);
    expect(enemiesAgain).toEqual(enemiesA);
    expect(enemiesNext).not.toEqual(enemiesA);

    const resourcesA = getNightlyResourceNodes('variation', 3);
    expect(getNightlyResourceNodes('variation', 3)).toEqual(resourcesA);
    expect(getNightlyResourceNodes('variation', 4)).not.toEqual(resourcesA);

    const point = getNightlyHumanPosition('variation', 3, 'human-1', 0);
    expect(getNightlyHumanPosition('variation', 3, 'human-1', 0)).toEqual(point);
    expect(getNightlyHumanPosition('variation', 4, 'human-1', 0)).not.toEqual(point);
  });

  it('rotates a bounded regional human roster and generates replacements without duplicating IDs', () => {
    const state = createNewGameState({ seed: 'regional-pool' });
    const result = resolveNightlyHumanPopulation(state.npcs, state.seed, 2, 5);
    expect(result.npcs.filter(isHumanPresentInWorld)).toHaveLength(5);
    expect(result.npcs.filter((human) => human.status === 'wandering')).toHaveLength(8);
    expect(new Set(result.npcs.map((human) => human.id)).size).toBe(result.npcs.length);
    expect(result.newHumanIds).toHaveLength(3);
  });

  it('keeps escaped thralls off-map for a deterministic delay and only allows interaction after resurfacing', () => {
    let state = createNewGameState({ seed: 'returning-escape' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    state.humanServants[0]!.control = 1;
    state = cycleToNight(state);
    let escaped = state.npcs.find((human) => human.id === humanId)!;
    expect(escaped.worldPresence).toBe('dormant');
    expect(escaped.dormantReason).toBe('escaped');
    expect(isHumanPresentInWorld(escaped)).toBe(false);
    expect(validateHumanAction(state, escaped, 'feed').ok).toBe(false);

    if (escaped.scheduledReturnDay !== null) {
      const result = resolveNightlyHumanPopulation(state.npcs, state.seed, escaped.scheduledReturnDay, 8);
      escaped = result.npcs.find((human) => human.id === humanId)!;
      expect(escaped.dormantReason).not.toBe('escaped');
      expect(isHumanPresentInWorld(escaped)).toBe(true);
      expect(validateHumanAction({ ...state, npcs: result.npcs }, escaped, 'feed').ok).toBe(true);
    }
  });

  it('prunes old escaped records and hard-caps the dormant escaped population', () => {
    const base = createNewGameState({ seed: 'prune-escape' });
    const template = base.npcs[0]!;
    const escaped = Array.from({ length: 55 }, (_, index) => markHumanEscaped({
      ...template,
      id: `escaped-${index}`,
      relationships: {},
    }, base.seed, 1));
    const result = resolveNightlyHumanPopulation(escaped, base.seed, 40, 5);
    const escapedLeft = result.npcs.filter((human) => human.dormantReason === 'escaped');
    expect(escapedLeft.length).toBeLessThanOrEqual(40);
    expect(result.prunedHumanIds.length).toBeGreaterThan(0);
  });
});

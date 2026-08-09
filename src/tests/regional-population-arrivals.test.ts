import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { resolveNightlyHumanPopulation } from '../simulation/world/nightlyWorld';

const regionalCount = (state: ReturnType<typeof createNewGameState>): number =>
  state.npcs.filter((human) => human.status === 'wandering').length;

describe('regional population recovery', () => {
  it('does not instantly replace a Human lost to enthrallment on the following night', () => {
    let state = createNewGameState({ seed: 'no-instant-replacement' });
    state.player.vitae = 10;
    const before = regionalCount(state);
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    const resolved = resolveNightlyHumanPopulation(state.npcs, state.seed, state.time.day + 1, 5);
    expect(resolved.newHumanIds).toHaveLength(0);
    expect(resolved.npcs.filter((human) => human.status === 'wandering')).toHaveLength(before - 1);
  });

  it('treats the regional target as a soft cap and admits at most one newcomer per later night', () => {
    const state = createNewGameState({ seed: 'slow-regional-recovery' });
    const reduced = state.npcs.slice(0, 2);
    const resolved = resolveNightlyHumanPopulation(reduced, state.seed, 20, 5);
    expect(resolved.newHumanIds.length).toBeLessThanOrEqual(1);
    expect(resolved.npcs.filter((human) => human.status === 'wandering').length).toBeLessThanOrEqual(3);
  });

  it('keeps nightly arrival decisions deterministic for the same seed and day', () => {
    const state = createNewGameState({ seed: 'deterministic-arrivals' });
    const reduced = state.npcs.slice(0, 3);
    const first = resolveNightlyHumanPopulation(reduced, state.seed, 12, 5);
    const second = resolveNightlyHumanPopulation(reduced, state.seed, 12, 5);
    expect(first.newHumanIds).toEqual(second.newHumanIds);
    expect(first.npcs).toEqual(second.npcs);
  });
});

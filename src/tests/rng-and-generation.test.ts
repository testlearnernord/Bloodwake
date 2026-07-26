import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { generateHumans } from '../simulation/world/humans';
import { SeededRng } from '../utilities/rng';

describe('deterministic RNG', () => {
  it('produces the same number sequence for the same seed', () => {
    const first = new SeededRng('bloodwake');
    const second = new SeededRng('bloodwake');
    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()]);
  });
});

describe('new game world seed and character roll determinism', () => {
  it('keeps world generation stable for same world seed', () => {
    const first = generateHumans('world-seed-1', 5);
    const second = generateHumans('world-seed-1', 5);
    expect(first).toEqual(second);
  });

  it('changes starting vampire when character roll changes', () => {
    const first = createNewGameState({ seed: 'shared-world', characterRoll: 0 });
    const second = createNewGameState({ seed: 'shared-world', characterRoll: 1 });
    expect(first.player).not.toEqual(second.player);
    expect(first.seed).toBe(second.seed);
  });

  it('preserves starting vampire for same world seed and roll', () => {
    const first = createNewGameState({ seed: 'shared-world', characterRoll: 3 });
    const second = createNewGameState({ seed: 'shared-world', characterRoll: 3 });
    expect(first.player).toEqual(second.player);
    expect(first.npcs).toEqual(second.npcs);
  });

  it('starts new games without a starter servant', () => {
    const state = createNewGameState({ seed: 'no-servant' });
    expect(state.servants).toEqual([]);
  });
});

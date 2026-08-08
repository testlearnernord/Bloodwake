import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { generateHumans } from '../simulation/world/humans';
import { SeededRng } from '../utilities/rng';
import { BLOOD_RESONANCE_WEIGHTS, getBloodResonanceLabel } from '../simulation/blood/bloodResonance';

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

  it('starts new games with empty population arrays and no servants field', () => {
    const state = createNewGameState({ seed: 'no-servant' });
    expect(state.humanServants).toEqual([]);
    expect(state.vampireVassals).toEqual([]);
    expect('servants' in state).toBe(false);
  });
});


describe('human Blood Resonance and metadata', () => {
  it('uses the authoritative 35/35/20/8/2 weight table totaling 100', () => {
    expect(BLOOD_RESONANCE_WEIGHTS.map(({ resonance, weight }) => [resonance, weight])).toEqual([
      [1, 35],
      [2, 35],
      [3, 20],
      [4, 8],
      [5, 2],
    ]);
    expect(BLOOD_RESONANCE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100);
  });

  it('maps every Blood Resonance label exactly', () => {
    expect(getBloodResonanceLabel(1)).toBe('Thin');
    expect(getBloodResonanceLabel(2)).toBe('Common');
    expect(getBloodResonanceLabel(3)).toBe('Rich');
    expect(getBloodResonanceLabel(4)).toBe('Potent');
    expect(getBloodResonanceLabel(5)).toBe('Exceptional');
  });

  it('generates deterministic Blood Resonance and Resolve for the same seed', () => {
    const first = generateHumans('metadata-seed', 20);
    const second = generateHumans('metadata-seed', 20);
    expect(first.map((human) => [human.bloodResonance, human.resolve])).toEqual(
      second.map((human) => [human.bloodResonance, human.resolve]),
    );
  });

  it('keeps generated Blood Resonance and Resolve inside their integer ranges', () => {
    const humans = generateHumans('metadata-ranges', 100);
    for (const human of humans) {
      expect(Number.isInteger(human.bloodResonance)).toBe(true);
      expect(human.bloodResonance).toBeGreaterThanOrEqual(1);
      expect(human.bloodResonance).toBeLessThanOrEqual(5);
      expect(Number.isInteger(human.resolve)).toBe(true);
      expect(human.resolve).toBeGreaterThanOrEqual(1);
      expect(human.resolve).toBeLessThanOrEqual(5);
    }
  });

  it('starts free humans neutral and unafraid', () => {
    const humans = generateHumans('neutral-humans', 12);
    expect(humans.every((human) => human.disposition === 0)).toBe(true);
    expect(humans.every((human) => human.fear === 0)).toBe(true);
  });

  it('does not generate obsolete bloodQuality or recruitability properties', () => {
    const human = generateHumans('no-legacy-human-fields', 1)[0] as unknown as Record<string, unknown>;
    expect('bloodQuality' in human).toBe(false);
    expect('recruitability' in human).toBe(false);
  });
});

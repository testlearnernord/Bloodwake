import { describe, expect, it } from 'vitest';
import { TRAITS } from '../data/traits';
import { generateStartingVampire } from '../simulation/bloodlines/generation';
import { resolveTraitSet } from '../simulation/traits/traitUtils';
import { SeededRng } from '../utilities/rng';

describe('deterministic RNG', () => {
  it('produces the same number sequence for the same seed', () => {
    const first = new SeededRng('bloodwake');
    const second = new SeededRng('bloodwake');
    expect([first.next(), first.next(), first.next()]).toEqual([second.next(), second.next(), second.next()]);
  });
});

describe('starting vampire generation', () => {
  it('creates the same starting vampire for the same seed', () => {
    const first = generateStartingVampire({ seed: 'seed-1042', playerName: 'Radu' });
    const second = generateStartingVampire({ seed: 'seed-1042', playerName: 'Radu' });
    expect(first).toEqual(second);
  });

  it('only assigns configured trait rarities', () => {
    const { vampire } = generateStartingVampire({ seed: 'rarity-check' });
    const rarities = new Set(TRAITS.map((trait) => trait.rarity));
    for (const traitId of vampire.traitIds) {
      const rarity = TRAITS.find((trait) => trait.id === traitId)?.rarity;
      expect(rarity && rarities.has(rarity)).toBe(true);
    }
  });

  it('resolves incompatible traits', () => {
    expect(resolveTraitSet(['strong', 'frail'])).toEqual(['strong']);
  });
});

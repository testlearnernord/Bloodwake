import { PROFESSIONS } from '../../data/professions';
import { TRAITS } from '../../data/traits';
import type { HumanCharacter } from '../../types/models';
import { applyAttributeDelta, createAttributeSet } from '../../utilities/attributes';
import { SeededRng } from '../../utilities/rng';
import { calculateTraitModifiers, resolveTraitSet } from '../traits/traitUtils';

const FIRST_NAMES = ['Adela', 'Berta', 'Clara', 'Dieter', 'Egon', 'Frieda', 'Greta', 'Heinrich'];
const FAMILY_NAMES = ['Klein', 'Waldmann', 'Roth', 'Vogel', 'Falk', 'Stein'];

export const generateHumans = (seed: string, count: number): HumanCharacter[] => {
  const rng = new SeededRng(`${seed}-humans`);
  return Array.from({ length: count }, (_, index) => {
    const profession = rng.pickOne(PROFESSIONS);
    const baseAttributes = createAttributeSet(2);
    const availableTraits = TRAITS.filter((trait) => !trait.vampireOnly && trait.rarity !== 'legendary');
    const rawTraits = [rng.pickOne(availableTraits).id];
    if (rng.chance(0.3)) {
      rawTraits.push(rng.pickOne(availableTraits).id);
    }
    const traitIds = resolveTraitSet(rawTraits);
    const attributes = applyAttributeDelta(
      applyAttributeDelta(baseAttributes, profession.attributeBonuses),
      calculateTraitModifiers(traitIds),
    );
    const name = rng.pickOne(FIRST_NAMES);
    const familyName = rng.pickOne(FAMILY_NAMES);
    const combat = profession.jobBonuses.Guarding ?? profession.jobBonuses.Hunting ?? 0;
    return {
      id: `human-${index + 1}`,
      name,
      familyName,
      age: rng.nextInt(18, 52),
      professionId: profession.id,
      attributes,
      traitIds,
      factionId: profession.defaultFaction,
      health: 12 + attributes.vitality,
      maxHealth: 12 + attributes.vitality,
      morale: 50,
      loyalty: 40,
      ambition: rng.nextInt(20, 80),
      stress: 10,
      combat,
      bloodQuality: rng.nextInt(1, 5),
      recruitability: rng.nextInt(20, 90),
      status: 'wandering',
      relationships: {},
    };
  });
};

import { PROFESSIONS } from '../../data/professions';
import { TRAITS } from '../../data/traits';
import type { HumanCharacter } from '../../types/models';
import { applyAttributeDelta, createAttributeSet } from '../../utilities/attributes';
import { SeededRng } from '../../utilities/rng';
import { calculateTraitModifiers, resolveTraitSet } from '../traits/traitUtils';
import { rollBloodResonance } from '../blood/bloodResonance';

export const isHumanPresentInWorld = (human: HumanCharacter): boolean =>
  human.worldPresence === 'active'
  && human.status !== 'drained'
  && human.status !== 'turned'
  && human.status !== 'enthralled';

const FIRST_NAMES = ['Adela', 'Berta', 'Clara', 'Dieter', 'Egon', 'Frieda', 'Greta', 'Heinrich'];
const FAMILY_NAMES = ['Klein', 'Waldmann', 'Roth', 'Vogel', 'Falk', 'Stein'];

const generateSingleHuman = (rng: SeededRng, id: string, day: number): HumanCharacter => {
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
    id,
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
    bloodResonance: rollBloodResonance(rng),
    resolve: rng.nextInt(1, 5),
    disposition: 0,
    fear: 0,
    status: 'wandering',
    relationships: {},
    worldPresence: 'active',
    dormantReason: null,
    dormantSinceDay: null,
    scheduledReturnDay: null,
    lastSeenDay: day,
  };
};

export const generateHumanFromSeed = (seed: string, id: string, day: number): HumanCharacter =>
  generateSingleHuman(new SeededRng(seed), id, day);

export const generateHumans = (seed: string, count: number): HumanCharacter[] => {
  const rng = new SeededRng(`${seed}-humans`);
  return Array.from({ length: count }, (_, index) => generateSingleHuman(rng, `human-${index + 1}`, 1));
};

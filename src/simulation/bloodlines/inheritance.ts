import { INHERITANCE_BALANCING } from '../../config/balancing';
import { TRAITS } from '../../data/traits';
import type { HumanCharacter, InheritanceReport, VampireCharacter } from '../../types/models';
import { applyAttributeDelta } from '../../utilities/attributes';
import { SeededRng } from '../../utilities/rng';
import { applyRetainedTraitEffects } from '../traits/traitEffects';
import { calculateTraitModifiers, getTraitById, getTraitEffectIds, resolveTraitSet } from '../traits/traitUtils';

const sampleTraits = (rng: SeededRng, traitIds: string[], count: number): string[] => {
  const pool = [...traitIds];
  const result: string[] = [];
  while (pool.length > 0 && result.length < count) {
    const nextIndex = rng.nextInt(0, pool.length - 1);
    result.push(pool.splice(nextIndex, 1)[0]);
  }
  return result;
};

export const inheritVampire = (
  sire: VampireCharacter,
  human: HumanCharacter,
  seed: string,
): { vampire: VampireCharacter; report: InheritanceReport } => {
  const rng = new SeededRng(`${seed}-${human.id}-${sire.id}`);
  const sireEffectIds = getTraitEffectIds(sire.traitIds);
  const retainedCount = applyRetainedTraitEffects(sireEffectIds);
  const retainedTraits = sampleTraits(
    rng,
    human.traitIds.filter((traitId) => {
      const trait = getTraitById(traitId);
      return trait.inheritable && !trait.humanOnly;
    }),
    retainedCount,
  );
  const sireTraits = sampleTraits(
    rng,
    sire.traitIds.filter((traitId) => getTraitById(traitId).inheritable),
    INHERITANCE_BALANCING.sireTraits,
  );
  const chosenTraitIds = [...retainedTraits, ...sireTraits];

  const mutations: string[] = [];
  if (rng.chance(INHERITANCE_BALANCING.mutationChance)) {
    const mutationPool = TRAITS.filter(
      (trait) =>
        trait.vampireOnly && !chosenTraitIds.includes(trait.id) && (trait.rarity === 'common' || trait.rarity === 'uncommon'),
    );
    if (mutationPool.length > 0) {
      const mutation = rng.pickOne(mutationPool).id;
      mutations.push(mutation);
      chosenTraitIds.push(mutation);
    }
  }
  if (rng.chance(INHERITANCE_BALANCING.rareMutationChance)) {
    const rarePool = TRAITS.filter(
      (trait) => trait.vampireOnly && !chosenTraitIds.includes(trait.id) && ['rare', 'legendary'].includes(trait.rarity),
    );
    if (rarePool.length > 0) {
      const mutation = rng.pickOne(rarePool).id;
      mutations.push(mutation);
    }
  }

  const traitIds = resolveTraitSet([...chosenTraitIds, ...mutations]);
  const attemptedTraitIds = [...new Set([...chosenTraitIds, ...mutations])];
  const removedIncompatibleTraits = attemptedTraitIds.filter((traitId) => !traitIds.includes(traitId));
  const baseAttributes = applyAttributeDelta(human.attributes, sire.attributes);
  const traitModifiers = calculateTraitModifiers(traitIds);
  const finalAttributes = Object.fromEntries(
    Object.entries(baseAttributes).map(([key, value]) => [key, Math.max(1, Math.round(value / 2))]),
  ) as VampireCharacter['attributes'];
  const attributes = applyAttributeDelta(finalAttributes, traitModifiers);
  const professionSkills = { ...sire.professionSkills };
  const vampire: VampireCharacter = {
    id: `vampire-${human.id}`,
    name: `${human.name} ${human.familyName}`,
    age: human.age,
    professionId: human.professionId,
    attributes,
    traitIds,
    health: 16 + attributes.vitality,
    maxHealth: 16 + attributes.vitality,
    morale: 45,
    loyalty: 55,
    ambition: human.ambition,
    stress: human.stress,
    combat: 3 + attributes.strength,
    vitae: 2,
    maxVitae: 8,
    bloodEssence: 0,
    hunger: 1,
    memoryFragments: [],
    professionSkills,
  };
  return {
    vampire,
    report: {
      originalHumanTraits: human.traitIds,
      sireTraits: sire.traitIds,
      finalTraits: traitIds,
      inheritedTraits: sireTraits.filter((traitId) => traitIds.includes(traitId)),
      retainedTraits: retainedTraits.filter((traitId) => traitIds.includes(traitId)),
      mutations: mutations.filter((traitId) => traitIds.includes(traitId)),
      removedIncompatibleTraits,
    },
  };
};

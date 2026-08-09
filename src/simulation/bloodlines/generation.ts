import { STARTING_ATTRIBUTE_RANGE, STARTING_TRAIT_RULES, TRAIT_RARITY_WEIGHTS } from '../../config/balancing';
import { PROFESSIONS } from '../../data/professions';
import { TRAITS } from '../../data/traits';
import type { AttributeKey, NewGameOptions, TraitDefinition, TraitRarity, VampireCharacter } from '../../types/models';
import { applyAttributeDelta, createAttributeSet } from '../../utilities/attributes';
import { SeededRng, createDefaultSeed } from '../../utilities/rng';
import { calculateTraitModifiers, resolveTraitSet } from '../traits/traitUtils';

const ATTRIBUTE_KEYS: AttributeKey[] = [
  'strength',
  'agility',
  'vitality',
  'willpower',
  'intelligence',
  'presence',
  'bloodControl',
];

const countStartingTraits = (rng: SeededRng): number => {
  if (rng.chance(STARTING_TRAIT_RULES.noneChance)) {
    return 0;
  }
  let count = 1;
  while (count < STARTING_TRAIT_RULES.maxTraits && rng.chance(STARTING_TRAIT_RULES.extraTraitChance)) {
    count += 1;
  }
  return count;
};

const buildTraitPool = (rarity: TraitRarity): TraitDefinition[] =>
  TRAITS.filter((trait) => trait.rarity === rarity && !trait.humanOnly);

const pickTrait = (rng: SeededRng, rarity: TraitRarity, chosenIds: string[]): string | null => {
  const candidates = buildTraitPool(rarity)
    .filter((trait) => !chosenIds.includes(trait.id))
    .map((trait) => ({ trait, weight: trait.inheritanceWeight * TRAIT_RARITY_WEIGHTS[trait.rarity] }));
  if (candidates.length === 0) {
    return null;
  }
  return rng.weightedPick(candidates).trait.id;
};

export const generateStartingVampire = (options: NewGameOptions = {}): { seed: string; vampire: VampireCharacter } => {
  const seed = options.seed?.trim() || createDefaultSeed();
  const rng = new SeededRng(seed);
  const attributes = ATTRIBUTE_KEYS.reduce((result, key) => {
    result[key] = rng.nextInt(STARTING_ATTRIBUTE_RANGE.min, STARTING_ATTRIBUTE_RANGE.max);
    return result;
  }, createAttributeSet());

  const traitCount = countStartingTraits(rng);
  const traitIds: string[] = [];
  for (let index = 0; index < traitCount; index += 1) {
    const rarity: TraitRarity = rng.chance(STARTING_TRAIT_RULES.legendaryChance)
      ? 'legendary'
      : rng.chance(STARTING_TRAIT_RULES.rareUpgradeChance)
        ? 'rare'
        : 'common';
    const traitId = pickTrait(rng, rarity, traitIds);
    if (traitId) {
      traitIds.push(traitId);
    }
    if (rng.chance(STARTING_TRAIT_RULES.negativeChance)) {
      const negativeTraitId = pickTrait(rng, 'negative', traitIds);
      if (negativeTraitId) {
        traitIds.push(negativeTraitId);
      }
    }
  }

  const resolvedTraitIds = resolveTraitSet(traitIds);
  const profession = rng.pickOne(PROFESSIONS);
  const modifiedAttributes = applyAttributeDelta(
    applyAttributeDelta(attributes, profession.attributeBonuses),
    calculateTraitModifiers(resolvedTraitIds),
  );

  return {
    seed,
    vampire: {
      id: 'player',
      name: options.playerName?.trim() || 'The Forgotten Lord',
      age: 1000,
      professionId: profession.id,
      attributes: modifiedAttributes,
      traitIds: resolvedTraitIds,
      health: 20 + modifiedAttributes.vitality,
      maxHealth: 20 + modifiedAttributes.vitality,
      morale: 60,
      loyalty: 100,
      ambition: 70,
      stress: 10,
      combat: 4 + modifiedAttributes.strength,
      vitae: 6,
      maxVitae: 10,
      professionSkills: profession.jobBonuses,
      equipment: {},
    },
  };
};

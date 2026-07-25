import { TRAITS_BY_ID } from '../../data/traits';
import type { AttributeSet, TraitDefinition, TraitEffectId } from '../../types/models';
import { applyAttributeDelta, createAttributeSet } from '../../utilities/attributes';

export const getTraitById = (traitId: string): TraitDefinition => {
  const trait = TRAITS_BY_ID[traitId];
  if (!trait) {
    throw new Error(`Unknown trait: ${traitId}`);
  }
  return trait;
};

export const resolveTraitSet = (traitIds: string[]): string[] => {
  const resolved: string[] = [];
  for (const traitId of traitIds) {
    const trait = getTraitById(traitId);
    const hasAllRequirements = trait.requiredTraitIds.every((requiredId) => resolved.includes(requiredId) || traitIds.includes(requiredId));
    const hasConflict = trait.incompatibleTraitIds.some((incompatibleId) => resolved.includes(incompatibleId));
    if (hasAllRequirements && !hasConflict && !resolved.includes(traitId)) {
      resolved.push(traitId);
    }
  }
  return resolved;
};

export const calculateTraitModifiers = (traitIds: string[]): AttributeSet => {
  return resolveTraitSet(traitIds).reduce((attributes, traitId) => {
    const { modifiers } = getTraitById(traitId);
    return applyAttributeDelta(attributes, modifiers);
  }, createAttributeSet());
};

export const getTraitEffectIds = (traitIds: string[]): TraitEffectId[] => {
  return resolveTraitSet(traitIds)
    .map((traitId) => getTraitById(traitId).effectId)
    .filter((value): value is TraitEffectId => Boolean(value));
};

import type { AttributeSet } from '../types/models';

export const createAttributeSet = (base = 0): AttributeSet => ({
  strength: base,
  agility: base,
  vitality: base,
  willpower: base,
  intelligence: base,
  presence: base,
  bloodControl: base,
});

export const cloneAttributes = (attributes: AttributeSet): AttributeSet => ({ ...attributes });

export const applyAttributeDelta = (attributes: AttributeSet, delta: Partial<AttributeSet>): AttributeSet => {
  const next = cloneAttributes(attributes);
  for (const [key, value] of Object.entries(delta) as Array<[keyof AttributeSet, number | undefined]>) {
    next[key] += value ?? 0;
  }
  return next;
};

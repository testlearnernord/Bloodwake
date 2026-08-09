import { describe, expect, it } from 'vitest';
import { inheritVampire } from '../simulation/bloodlines/inheritance';
import type { HumanCharacter, VampireCharacter } from '../types/models';

const sire: VampireCharacter = {
  id: 'sire',
  name: 'Elda',
  age: 400,
  professionId: 'scribe',
  attributes: {
    strength: 4,
    agility: 4,
    vitality: 5,
    willpower: 6,
    intelligence: 6,
    presence: 4,
    bloodControl: 6,
  },
  traitIds: ['memories_of_the_blood', 'blood_mage', 'strong'],
  health: 20,
  maxHealth: 20,
  morale: 60,
  loyalty: 90,
  ambition: 70,
  stress: 10,
  combat: 6,
  vitae: 8,
  maxVitae: 10,
  bloodEssence: 1,
  memoryFragments: [],
  professionSkills: { Crafting: 2, Research: 2 },
  equipment: {},
};

const human: HumanCharacter = {
  id: 'human-1',
  name: 'Adela',
  familyName: 'Stein',
  age: 24,
  professionId: 'blacksmith',
  attributes: {
    strength: 4,
    agility: 3,
    vitality: 4,
    willpower: 3,
    intelligence: 3,
    presence: 2,
    bloodControl: 0,
  },
  traitIds: ['blacksmith_training', 'frail'],
  factionId: 'village',
  health: 11,
  maxHealth: 11,
  morale: 50,
  loyalty: 35,
  ambition: 44,
  stress: 12,
  combat: 2,
  bloodResonance: 4,
  resolve: 4,
  disposition: 0,
  fear: 0,
  status: 'wandering',
  relationships: {},
  worldPresence: 'active',
  dormantReason: null,
  dormantSinceDay: null,
  scheduledReturnDay: null,
  lastSeenDay: 1,
};

describe('vampire inheritance', () => {
  it('combines sire and human traits into a new vampire', () => {
    const result = inheritVampire(sire, human, 'inheritance-seed');
    expect(result.vampire.id).toBe('vampire-human-1');
    expect(result.vampire.professionId).toBe('blacksmith');
    expect(result.report.finalTraits.length).toBeGreaterThan(0);
    expect(result.report.retainedTraits.length).toBeGreaterThanOrEqual(1);
    expect(result.vampire.equipment).toEqual({});
    expect(result.vampire.professionSkills).toEqual({});
  });

  it('retains explicitly supplied learned skills instead of copying the sire skills', () => {
    const result = inheritVampire(sire, human, 'trained-host', { Crafting: 6, Building: 2 });
    expect(result.vampire.professionSkills).toEqual({ Crafting: 6, Building: 2 });
    expect(result.vampire.professionSkills).not.toEqual(sire.professionSkills);
  });

  it('can generate deterministic mutations from the configured algorithm', () => {
    const seeds = Array.from({ length: 400 }, (_, index) => `mutation-${index}`);
    const mutationResult = seeds
      .map((seed) => inheritVampire(sire, human, seed))
      .find((result) => result.report.mutations.length > 0);
    expect(mutationResult).toBeDefined();
    expect(mutationResult?.report.mutations.length).toBeGreaterThan(0);
  });
});

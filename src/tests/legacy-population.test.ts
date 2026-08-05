import { describe, expect, it } from 'vitest';
import {
  convertLegacyHumanServant,
  convertLegacyVampireVassal,
  InvalidServantTypeError,
  splitLegacyServants,
} from '../simulation/population/legacyPopulation';
import type { Servant } from '../types/models';

const BASE_ATTRIBUTES = {
  strength: 4,
  agility: 3,
  vitality: 4,
  willpower: 3,
  intelligence: 2,
  presence: 2,
  bloodControl: 0,
};

const BASE_PRIORITIES = {
  Building: 'Normal' as const,
  Crafting: 'High' as const,
  Gathering: 'Low' as const,
  Guarding: 'Normal' as const,
  Research: 'Disabled' as const,
  Hunting: 'Low' as const,
};

const humanServant: Servant = {
  id: 'servant-h1',
  name: 'Marta',
  age: 28,
  professionId: 'woodcutter',
  attributes: { ...BASE_ATTRIBUTES },
  traitIds: ['industrious', 'hardy'],
  health: 10,
  maxHealth: 12,
  morale: 55,
  loyalty: 60,
  ambition: 30,
  stress: 5,
  combat: 2,
  type: 'human',
  professionSkills: { Building: 2, Gathering: 2 },
  priorities: { ...BASE_PRIORITIES },
  currentJob: 'Gathering',
  currentTask: 'gather-wood',
  taskReason: 'Wood stores are low.',
  hunger: 0,
  equipped: { Weapon: 'simple_sword' },
};

const vampireServant: Servant = {
  id: 'servant-v1',
  name: 'Erik Dawnless',
  age: 32,
  professionId: 'guard',
  attributes: { ...BASE_ATTRIBUTES, bloodControl: 2 },
  traitIds: ['predatory'],
  health: 18,
  maxHealth: 20,
  morale: 45,
  loyalty: 55,
  ambition: 70,
  stress: 12,
  combat: 6,
  type: 'vampire',
  professionSkills: { Guarding: 3 },
  priorities: { ...BASE_PRIORITIES, Guarding: 'Critical' },
  currentJob: 'Guarding',
  currentTask: 'guard-post',
  taskReason: 'Standing watch.',
  hunger: 2,
  equipped: { Armor: 'leather_armor' },
};

describe('convertLegacyHumanServant', () => {
  it('converts a human servant and sets the correct discriminator', () => {
    const result = convertLegacyHumanServant(humanServant);
    expect(result.kind).toBe('human_servant');
  });

  it('preserves all required fields', () => {
    const result = convertLegacyHumanServant(humanServant);
    expect(result.id).toBe(humanServant.id);
    expect(result.name).toBe(humanServant.name);
    expect(result.age).toBe(humanServant.age);
    expect(result.professionId).toBe(humanServant.professionId);
    expect(result.traitIds).toEqual(humanServant.traitIds);
    expect(result.health).toBe(humanServant.health);
    expect(result.maxHealth).toBe(humanServant.maxHealth);
    expect(result.morale).toBe(humanServant.morale);
    expect(result.loyalty).toBe(humanServant.loyalty);
    expect(result.stress).toBe(humanServant.stress);
    expect(result.currentJob).toBe(humanServant.currentJob);
    expect(result.currentTask).toBe(humanServant.currentTask);
    expect(result.taskReason).toBe(humanServant.taskReason);
  });

  it('clones priorities (not the same reference)', () => {
    const result = convertLegacyHumanServant(humanServant);
    expect(result.priorities).toEqual(humanServant.priorities);
    expect(result.priorities).not.toBe(humanServant.priorities);
  });

  it('clones equipped (not the same reference)', () => {
    const result = convertLegacyHumanServant(humanServant);
    expect(result.equipped).toEqual(humanServant.equipped);
    expect(result.equipped).not.toBe(humanServant.equipped);
  });

  it('does not mutate the source object', () => {
    const snapshot = JSON.stringify(humanServant);
    convertLegacyHumanServant(humanServant);
    expect(JSON.stringify(humanServant)).toBe(snapshot);
  });

  it('throws InvalidServantTypeError when given a vampire servant', () => {
    expect(() => convertLegacyHumanServant(vampireServant)).toThrow(InvalidServantTypeError);
  });

  it('repeated conversion produces equivalent results', () => {
    const first = convertLegacyHumanServant(humanServant);
    const second = convertLegacyHumanServant(humanServant);
    expect(first).toEqual(second);
  });
});

describe('convertLegacyVampireVassal', () => {
  it('converts a vampire servant and sets the correct discriminator', () => {
    const result = convertLegacyVampireVassal(vampireServant);
    expect(result.kind).toBe('vampire_vassal');
  });

  it('preserves all required fields', () => {
    const result = convertLegacyVampireVassal(vampireServant);
    expect(result.id).toBe(vampireServant.id);
    expect(result.name).toBe(vampireServant.name);
    expect(result.age).toBe(vampireServant.age);
    expect(result.professionId).toBe(vampireServant.professionId);
    expect(result.traitIds).toEqual(vampireServant.traitIds);
    expect(result.health).toBe(vampireServant.health);
    expect(result.maxHealth).toBe(vampireServant.maxHealth);
    expect(result.morale).toBe(vampireServant.morale);
    expect(result.loyalty).toBe(vampireServant.loyalty);
    expect(result.ambition).toBe(vampireServant.ambition);
    expect(result.stress).toBe(vampireServant.stress);
    expect(result.combat).toBe(vampireServant.combat);
    expect(result.hunger).toBe(vampireServant.hunger);
    expect(result.currentJob).toBe(vampireServant.currentJob);
    expect(result.currentTask).toBe(vampireServant.currentTask);
    expect(result.taskReason).toBe(vampireServant.taskReason);
  });

  it('uses fledgling defaults for vitae and maxVitae', () => {
    const result = convertLegacyVampireVassal(vampireServant);
    expect(result.vitae).toBe(2);
    expect(result.maxVitae).toBe(8);
  });

  it('clones priorities (not the same reference)', () => {
    const result = convertLegacyVampireVassal(vampireServant);
    expect(result.priorities).toEqual(vampireServant.priorities);
    expect(result.priorities).not.toBe(vampireServant.priorities);
  });

  it('clones equipped (not the same reference)', () => {
    const result = convertLegacyVampireVassal(vampireServant);
    expect(result.equipped).toEqual(vampireServant.equipped);
    expect(result.equipped).not.toBe(vampireServant.equipped);
  });

  it('does not mutate the source object', () => {
    const snapshot = JSON.stringify(vampireServant);
    convertLegacyVampireVassal(vampireServant);
    expect(JSON.stringify(vampireServant)).toBe(snapshot);
  });

  it('throws InvalidServantTypeError when given a human servant', () => {
    expect(() => convertLegacyVampireVassal(humanServant)).toThrow(InvalidServantTypeError);
  });

  it('repeated conversion produces equivalent results', () => {
    const first = convertLegacyVampireVassal(vampireServant);
    const second = convertLegacyVampireVassal(vampireServant);
    expect(first).toEqual(second);
  });
});

describe('splitLegacyServants', () => {
  it('splits a mixed array into separate human and vampire groups', () => {
    const result = splitLegacyServants([humanServant, vampireServant]);
    expect(result.humanServants).toHaveLength(1);
    expect(result.vampireVassals).toHaveLength(1);
    expect(result.humanServants[0]?.kind).toBe('human_servant');
    expect(result.vampireVassals[0]?.kind).toBe('vampire_vassal');
  });

  it('preserves input order within each group', () => {
    const h1: Servant = { ...humanServant, id: 'h1', name: 'Alpha' };
    const h2: Servant = { ...humanServant, id: 'h2', name: 'Beta' };
    const v1: Servant = { ...vampireServant, id: 'v1', name: 'Cain' };
    const v2: Servant = { ...vampireServant, id: 'v2', name: 'Dusk' };
    const result = splitLegacyServants([h1, v1, h2, v2]);
    expect(result.humanServants.map((s) => s.id)).toEqual(['h1', 'h2']);
    expect(result.vampireVassals.map((s) => s.id)).toEqual(['v1', 'v2']);
  });

  it('handles an empty array', () => {
    const result = splitLegacyServants([]);
    expect(result.humanServants).toEqual([]);
    expect(result.vampireVassals).toEqual([]);
  });

  it('handles an all-human array', () => {
    const result = splitLegacyServants([humanServant]);
    expect(result.humanServants).toHaveLength(1);
    expect(result.vampireVassals).toHaveLength(0);
  });

  it('handles an all-vampire array', () => {
    const result = splitLegacyServants([vampireServant]);
    expect(result.humanServants).toHaveLength(0);
    expect(result.vampireVassals).toHaveLength(1);
  });

  it('throws on an invalid servant type', () => {
    const badServant = { ...humanServant, type: 'ghost' as Servant['type'] };
    expect(() => splitLegacyServants([badServant])).toThrow(InvalidServantTypeError);
  });

  it('does not mutate source objects', () => {
    const snapshot1 = JSON.stringify(humanServant);
    const snapshot2 = JSON.stringify(vampireServant);
    splitLegacyServants([humanServant, vampireServant]);
    expect(JSON.stringify(humanServant)).toBe(snapshot1);
    expect(JSON.stringify(vampireServant)).toBe(snapshot2);
  });
});

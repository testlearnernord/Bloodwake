import { describe, expect, it } from 'vitest';
import {
  convertLegacyHumanServant,
  convertLegacyVampireVassal,
} from '../simulation/population/legacyPopulation';
import type { JobPriorityMap, Servant } from '../types/models';

const priorities: JobPriorityMap = {
  Building: 'Normal',
  Crafting: 'High',
  Gathering: 'Low',
  Guarding: 'Normal',
  Research: 'Disabled',
  Hunting: 'Low',
};

const baseServant: Servant = {
  id: 'clone-check',
  name: 'Clone Check',
  age: 30,
  professionId: 'blacksmith',
  attributes: {
    strength: 3,
    agility: 3,
    vitality: 3,
    willpower: 3,
    intelligence: 3,
    presence: 3,
    bloodControl: 0,
  },
  traitIds: [],
  health: 10,
  maxHealth: 10,
  morale: 50,
  loyalty: 50,
  ambition: 50,
  stress: 0,
  combat: 3,
  type: 'human',
  professionSkills: { Crafting: 2 },
  priorities,
  currentJob: null,
  currentTask: null,
  taskReason: '',
  hunger: 0,
  equipped: {},
};

describe('legacy population professionSkills cloning', () => {
  it('clones professionSkills for human servants', () => {
    const result = convertLegacyHumanServant(baseServant);
    expect(result.professionSkills).toEqual(baseServant.professionSkills);
    expect(result.professionSkills).not.toBe(baseServant.professionSkills);
  });

  it('clones professionSkills for vampire vassals', () => {
    const vampire: Servant = { ...baseServant, type: 'vampire' };
    const result = convertLegacyVampireVassal(vampire);
    expect(result.professionSkills).toEqual(vampire.professionSkills);
    expect(result.professionSkills).not.toBe(vampire.professionSkills);
  });
});

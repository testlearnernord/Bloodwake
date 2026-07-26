import { describe, expect, it } from 'vitest';
import { runWorkShift } from '../simulation/servants/production';
import { selectTaskForServant } from '../simulation/servants/tasks';
import { canPlayerExplore, servantCanWork } from '../simulation/time/dayNight';
import type { BuiltRoom, CraftingOrder, Servant } from '../types/models';

const room: BuiltRoom = {
  id: 'build-1',
  roomId: 'workshop',
  x: 1,
  y: 0,
  width: 1,
  height: 1,
  status: 'under_construction',
  progress: 0,
  assignedWorkerIds: [],
};

const servant: Servant = {
  id: 'servant-1',
  name: 'Matilda',
  age: 34,
  professionId: 'woodcutter',
  attributes: {
    strength: 4,
    agility: 3,
    vitality: 4,
    willpower: 3,
    intelligence: 2,
    presence: 2,
    bloodControl: 0,
  },
  traitIds: ['industrious'],
  health: 12,
  maxHealth: 12,
  morale: 52,
  loyalty: 60,
  ambition: 35,
  stress: 8,
  combat: 2,
  type: 'human',
  professionSkills: { Building: 2, Gathering: 2 },
  priorities: {
    Building: 'Critical',
    Crafting: 'Low',
    Gathering: 'Normal',
    Guarding: 'Low',
    Research: 'Disabled',
    Hunting: 'Disabled',
  },
  currentJob: null,
  currentTask: null,
  taskReason: '',
  hunger: 0,
  equipped: {},
};

describe('servant priority selection', () => {
  it('prefers the highest-priority valid task', () => {
    const task = selectTaskForServant(servant, [room], [] as CraftingOrder[], [{ itemId: 'wood', quantity: 10 }], 'day');
    expect(task?.type).toBe('construct_room');
  });
});

describe('resource production', () => {
  it('gathers item inventory during work shifts', () => {
    const shift = runWorkShift(
      [{ ...servant, priorities: { ...servant.priorities, Building: 'Disabled', Gathering: 'Critical' } }],
      [],
      [],
      { bloodEssence: 0, security: 0, gold: 0, knowledge: 0, influence: 0 },
      [{ itemId: 'wood', quantity: 2 }, { itemId: 'food', quantity: 0 }],
      'day',
      'shift-seed',
    );
    expect(shift.inventory.find((entry) => entry.itemId === 'wood')?.quantity).toBeGreaterThan(2);
  });
});

describe('day and night restrictions', () => {
  it('allows exploration only at night', () => {
    expect(canPlayerExplore('night')).toBe(true);
    expect(canPlayerExplore('day')).toBe(false);
  });

  it('prevents humans from working at night', () => {
    expect(servantCanWork(servant, 'night')).toBe(false);
    expect(servantCanWork(servant, 'day')).toBe(true);
  });
});

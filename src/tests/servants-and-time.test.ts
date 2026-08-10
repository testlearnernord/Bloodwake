import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { runWorkShift } from '../simulation/servants/production';
import { selectTaskForVassal, canVassalWorkInPhase } from '../simulation/servants/tasks';
import { canPlayerExplore, vassalCanWork } from '../simulation/time/dayNight';
import { applyHumanAction } from '../simulation/combat/bite';
import type { BuiltRoom, CraftingOrder, VampireVassal } from '../types/models';

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

const vassal: VampireVassal = {
  kind: 'vampire_vassal',
  id: 'vassal-1',
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
  vitae: 2,
  maxVitae: 8,
  state: 'active',
  torporSinceDay: null,
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
  equipped: {},
};

describe('vampire vassal priority selection', () => {
  it('prefers the highest-priority valid task at night', () => {
    const task = selectTaskForVassal(vassal, [room], [] as CraftingOrder[], [{ itemId: 'wood', quantity: 10 }], 'night');
    expect(task?.type).toBe('construct_room');
  });

  it('cannot work during day phase', () => {
    const task = selectTaskForVassal(vassal, [room], [] as CraftingOrder[], [{ itemId: 'wood', quantity: 10 }], 'day');
    expect(task?.score).toBe(-1);
  });
});

describe('resource production', () => {
  it('gathers item inventory during night work shifts', () => {
    const shift = runWorkShift(
      [{ ...vassal, priorities: { ...vassal.priorities, Building: 'Disabled', Gathering: 'Critical' } }],
      [],
      [],
      { bloodEssence: 0, security: 0, gold: 0, knowledge: 0, influence: 0 },
      [{ itemId: 'wood', quantity: 2 }, { itemId: 'food', quantity: 0 }],
      'night',
      'shift-seed',
    );
    expect(shift.inventory.find((entry) => entry.itemId === 'wood')?.quantity).toBeGreaterThan(2);
  });

  it('lets a newly turned vampire vassal contribute to the stronghold loop', () => {
    const state = createNewGameState({ seed: 'turn-loop' });
    state.player.vitae = 5;
    const turned = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn').state;
    turned.rooms.push({
      id: 'room-workshop-1-0',
      roomId: 'workshop',
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      status: 'under_construction',
      progress: 0,
      assignedWorkerIds: [],
    });
    const shift = runWorkShift(
      turned.vampireVassals,
      turned.rooms,
      turned.craftingQueue,
      turned.strategicResources,
      turned.inventory,
      'night',
      turned.seed,
    );
    expect(shift.vampireVassals).toHaveLength(1);
    expect(shift.vampireVassals[0]?.currentJob).toBe('Building');
    expect(shift.rooms.find((entry) => entry.id === 'room-workshop-1-0')?.progress).toBe(1);
    expect(shift.log[0]).toContain(shift.vampireVassals[0]?.name ?? '');
  });
});

describe('day and night restrictions', () => {
  it('allows exploration only at night', () => {
    expect(canPlayerExplore('night')).toBe(true);
    expect(canPlayerExplore('day')).toBe(false);
  });

  it('vampire vassals can only work at night', () => {
    expect(vassalCanWork(vassal, 'night')).toBe(true);
    expect(vassalCanWork(vassal, 'day')).toBe(false);
  });

  it('canVassalWorkInPhase returns same result as vassalCanWork', () => {
    expect(canVassalWorkInPhase(vassal, 'night')).toBe(true);
    expect(canVassalWorkInPhase(vassal, 'day')).toBe(false);
  });
});

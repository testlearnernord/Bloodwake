import { describe, expect, it } from 'vitest';
import { canPlaceRoom, queueRoomConstruction } from '../simulation/building/building';
import { completeCraftingOrder, queueCraftingOrder } from '../simulation/crafting/crafting';
import type { Servant } from '../types/models';

const servant: Servant = {
  id: 'smith',
  name: 'Hilda',
  age: 33,
  professionId: 'blacksmith',
  attributes: {
    strength: 4,
    agility: 3,
    vitality: 3,
    willpower: 3,
    intelligence: 4,
    presence: 2,
    bloodControl: 0,
  },
  traitIds: ['strong'],
  health: 12,
  maxHealth: 12,
  morale: 50,
  loyalty: 50,
  ambition: 40,
  stress: 5,
  combat: 2,
  type: 'human',
  professionSkills: { Crafting: 2 },
  priorities: {
    Building: 'Normal',
    Crafting: 'High',
    Gathering: 'Low',
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

describe('room placement validation', () => {
  it('rejects overlapping or out-of-bounds rooms', () => {
    const first = queueRoomConstruction([], { Wood: 10, Stone: 10 }, 'workshop', 0, 0);
    expect(canPlaceRoom(first.updatedRooms, 'storage_room', 0, 0)).toBe(false);
    expect(canPlaceRoom(first.updatedRooms, 'storage_room', 4, 0)).toBe(false);
    expect(canPlaceRoom(first.updatedRooms, 'storage_room', 1, 0)).toBe(true);
  });
});

describe('crafting results', () => {
  it('consumes inputs when crafting completes', () => {
    const queue = queueCraftingOrder([], 'simple_sword');
    const result = completeCraftingOrder({ 'Iron Ore': 3, Wood: 2 }, [], queue[0], servant, 'craft-seed');
    expect(result.resources['Iron Ore']).toBe(1);
    expect(result.resources.Wood).toBe(1);
  });

  it('creates recipe outputs in inventory', () => {
    const queue = queueCraftingOrder([], 'healing_draught');
    const result = completeCraftingOrder({ Herbs: 3, Food: 2 }, [], queue[0], servant, 'healing-seed');
    expect(result.inventory[0].itemId).toBe('healing_draught');
    expect(result.inventory[0].quantity).toBe(1);
  });
});

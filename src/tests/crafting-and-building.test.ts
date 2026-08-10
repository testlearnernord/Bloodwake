import { describe, expect, it } from 'vitest';
import { queueRoomConstruction } from '../simulation/building/building';
import { completeCraftingOrder, queueCraftingOrder } from '../simulation/crafting/crafting';
import { addItem, consumeItems, hasItems } from '../simulation/inventory/inventory';
import type { VampireVassal } from '../types/models';

const vassal: VampireVassal = {
  kind: 'vampire_vassal',
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
  vitae: 2,
  maxVitae: 8,
  state: 'active',
  torporSinceDay: null,
  operationalOrder: { type: 'none', issuedDay: null },
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
  equipped: {},
};

describe('item inventory helpers', () => {
  it('stacks, removes, and guards insufficient item consumption', () => {
    let inventory = addItem([], 'wood', 5);
    inventory = addItem(inventory, 'wood', 2);
    expect(hasItems(inventory, { wood: 7 })).toBe(true);
    inventory = consumeItems(inventory, { wood: 4 });
    expect(hasItems(inventory, { wood: 3 })).toBe(true);
    expect(() => consumeItems(inventory, { wood: 10 })).toThrow();
  });
});

describe('room placement and building costs', () => {
  it('consumes item and strategic costs for room construction', () => {
    const result = queueRoomConstruction([], [{ itemId: 'wood', quantity: 8 }, { itemId: 'stone', quantity: 8 }], {
      bloodEssence: 2,
      security: 0,
      gold: 0,
      knowledge: 0,
      influence: 0,
    }, 'workshop', 0, 0);
    expect(result.updatedInventory.find((entry) => entry.itemId === 'wood')?.quantity).toBe(2);
    expect(result.updatedInventory.find((entry) => entry.itemId === 'stone')?.quantity).toBe(4);
  });
});

describe('crafting results', () => {
  it('consumes input items and creates recipe output item', () => {
    const queue = queueCraftingOrder([], 'simple_sword');
    const result = completeCraftingOrder(
      [
        { itemId: 'iron_ingot', quantity: 2 },
        { itemId: 'wood', quantity: 2 },
      ],
      queue[0],
      vassal,
      'craft-seed',
    );
    expect(result.inventory.find((entry) => entry.itemId === 'simple_sword')?.quantity).toBe(1);
    expect(result.inventory.find((entry) => entry.itemId === 'iron_ingot')).toBeUndefined();
  });
});

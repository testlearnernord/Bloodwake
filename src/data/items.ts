import type { ItemDefinition } from '../types/models';

export const ITEMS: ItemDefinition[] = [
  { id: 'wood_planks', name: 'Wood Planks', description: 'Processed timber for building.', modifiers: {}, tags: ['material'] },
  { id: 'iron_ingot', name: 'Iron Ingot', description: 'Smelted metal ready for crafting.', modifiers: {}, tags: ['material'] },
  { id: 'simple_sword', name: 'Simple Sword', description: 'Reliable weapon for guards or fledgling vampires.', slot: 'Weapon', modifiers: { damage: 2 }, tags: ['weapon'] },
  { id: 'leather_armor', name: 'Leather Armor', description: 'Basic armor that improves survivability.', slot: 'Armor', modifiers: { armor: 2 }, tags: ['armor'] },
  { id: 'healing_draught', name: 'Healing Draught', description: 'Simple restorative for servants.', slot: 'Accessory', modifiers: { healing: 3 }, tags: ['consumable'] },
  { id: 'memory_talisman', name: 'Memory Talisman', description: 'A reminder of ancient rule.', slot: 'Accessory', modifiers: { willpower: 1 }, tags: ['memory'] },
];

export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

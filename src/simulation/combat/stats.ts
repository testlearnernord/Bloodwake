import { ITEMS_BY_ID } from '../../data/items';
import type { AttributeSet, InventoryEntry, ItemSlot, VampireCharacter } from '../../types/models';

export interface CombatStats {
  attackDamage: number;
  armor: number;
  healingPower: number;
  baseAttributes: AttributeSet;
  equipmentBonuses: Partial<AttributeSet>;
  traitBonuses: Partial<AttributeSet>;
  finalAttributes: AttributeSet;
}

const createZeroAttributes = (): AttributeSet => ({
  strength: 0,
  agility: 0,
  vitality: 0,
  willpower: 0,
  intelligence: 0,
  presence: 0,
  bloodControl: 0,
});

export const calculatePlayerCombatStats = (player: VampireCharacter): CombatStats => {
  const equipmentBonuses = createZeroAttributes();
  let attackDamage = Math.max(1, 2 + player.attributes.strength);
  let armor = 0;
  let healingPower = 0;

  for (const slot of ['Weapon', 'Armor', 'Accessory'] as const satisfies ItemSlot[]) {
    const itemId = player.equipment[slot];
    if (!itemId) continue;
    const item = ITEMS_BY_ID[itemId];
    attackDamage += item.modifiers.damage ?? 0;
    armor += item.modifiers.armor ?? 0;
    healingPower += item.modifiers.healing ?? 0;
    for (const key of Object.keys(equipmentBonuses) as Array<keyof AttributeSet>) {
      equipmentBonuses[key] += item.modifiers[key] ?? 0;
    }
  }

  const finalAttributes: AttributeSet = {
    strength: player.attributes.strength + equipmentBonuses.strength,
    agility: player.attributes.agility + equipmentBonuses.agility,
    vitality: player.attributes.vitality + equipmentBonuses.vitality,
    willpower: player.attributes.willpower + equipmentBonuses.willpower,
    intelligence: player.attributes.intelligence + equipmentBonuses.intelligence,
    presence: player.attributes.presence + equipmentBonuses.presence,
    bloodControl: player.attributes.bloodControl + equipmentBonuses.bloodControl,
  };

  return {
    attackDamage: Math.max(1, attackDamage),
    armor: Math.max(0, armor),
    healingPower: Math.max(0, healingPower),
    baseAttributes: { ...player.attributes },
    equipmentBonuses,
    traitBonuses: {},
    finalAttributes,
  };
};

export const applyIncomingDamage = (rawDamage: number, armor: number): number => Math.max(1, rawDamage - Math.floor(armor / 2));

export const useHealingDraught = (
  player: VampireCharacter,
  inventory: InventoryEntry[],
): { player: VampireCharacter; inventory: InventoryEntry[]; healed: number } => {
  const entryIndex = inventory.findIndex((entry) => entry.itemId === 'healing_draught' && entry.quantity > 0);
  if (entryIndex === -1) {
    throw new Error('No Healing Draught available.');
  }
  const stats = calculatePlayerCombatStats(player);
  const healAmount = Math.max(1, (ITEMS_BY_ID.healing_draught.modifiers.healing ?? 0) + stats.healingPower);
  const nextPlayer = { ...player, health: Math.min(player.maxHealth, player.health + healAmount) };
  const nextInventory = inventory.map((entry, index) =>
    index === entryIndex ? { ...entry, quantity: entry.quantity - 1 } : { ...entry },
  );
  return { player: nextPlayer, inventory: nextInventory.filter((entry) => entry.quantity > 0), healed: healAmount };
};

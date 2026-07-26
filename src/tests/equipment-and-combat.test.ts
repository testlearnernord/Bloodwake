import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { addItem, canEquipItem, equipItem } from '../simulation/inventory/inventory';
import { applyIncomingDamage, calculatePlayerCombatStats, useHealingDraught } from '../simulation/combat/stats';

describe('equipment and combat stats', () => {
  it('prevents equipping non-equippable items', () => {
    expect(canEquipItem('wood').ok).toBe(false);
  });

  it('applies weapon bonuses to attack damage', () => {
    const state = createNewGameState({ seed: 'equip' });
    const inventory = addItem(state.inventory, 'simple_sword', 1, 'Common');
    const equipped = equipItem(state.player, inventory, 'simple_sword');
    const stats = calculatePlayerCombatStats(equipped.player);
    expect(stats.attackDamage).toBeGreaterThan(2 + state.player.attributes.strength);
  });

  it('applies armor mitigation with minimum damage floor', () => {
    expect(applyIncomingDamage(5, 10)).toBe(1);
    expect(applyIncomingDamage(8, 2)).toBe(7);
  });

  it('consumes Healing Draught and restores health', () => {
    const state = createNewGameState({ seed: 'heal' });
    state.player.health = 5;
    const inventory = addItem(state.inventory, 'healing_draught', 1, 'Common');
    const result = useHealingDraught(state.player, inventory);
    expect(result.player.health).toBeGreaterThan(5);
    expect(result.inventory.find((entry) => entry.itemId === 'healing_draught')).toBeUndefined();
  });
});

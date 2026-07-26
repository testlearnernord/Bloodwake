import { ITEMS_BY_ID } from '../../data/items';
import type { EquipmentLoadout, InventoryEntry, ItemId, ItemSlot, QualityLevel, VampireCharacter } from '../../types/models';

const qualityWeight: Record<QualityLevel, number> = {
  Poor: 0,
  Common: 1,
  Fine: 2,
  Masterwork: 3,
};

const normalize = (inventory: InventoryEntry[]): InventoryEntry[] => inventory.filter((entry) => entry.quantity > 0);

const sameStack = (entry: InventoryEntry, itemId: ItemId, quality?: QualityLevel): boolean => entry.itemId === itemId && entry.quality === quality;

export const getItemQuantity = (inventory: InventoryEntry[], itemId: ItemId): number =>
  inventory.filter((entry) => entry.itemId === itemId).reduce((total, entry) => total + entry.quantity, 0);

export const findInventoryEntry = (inventory: InventoryEntry[], itemId: ItemId, quality?: QualityLevel): InventoryEntry | undefined =>
  inventory.find((entry) => sameStack(entry, itemId, quality));

export const addItem = (inventory: InventoryEntry[], itemId: ItemId, quantity: number, quality?: QualityLevel): InventoryEntry[] => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Item quantity must be a positive integer.');
  }
  const item = ITEMS_BY_ID[itemId];
  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }
  const updated = inventory.map((entry) => ({ ...entry }));
  let remaining = quantity;
  for (const entry of updated) {
    if (!sameStack(entry, itemId, quality)) continue;
    const free = item.stackLimit - entry.quantity;
    if (free <= 0) continue;
    const add = Math.min(free, remaining);
    entry.quantity += add;
    remaining -= add;
    if (remaining === 0) {
      return normalize(updated);
    }
  }
  while (remaining > 0) {
    const amount = Math.min(item.stackLimit, remaining);
    updated.push({ itemId, quantity: amount, quality });
    remaining -= amount;
  }
  return normalize(updated);
};

export const removeItem = (inventory: InventoryEntry[], itemId: ItemId, quantity: number, quality?: QualityLevel): InventoryEntry[] => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Item quantity must be a positive integer.');
  }
  const available = quality
    ? inventory.filter((entry) => sameStack(entry, itemId, quality)).reduce((total, entry) => total + entry.quantity, 0)
    : getItemQuantity(inventory, itemId);
  if (available < quantity) {
    throw new Error(`Insufficient ${ITEMS_BY_ID[itemId].name}.`);
  }
  let remaining = quantity;
  const updated = inventory.map((entry) => ({ ...entry }));
  for (const entry of updated) {
    if (entry.itemId !== itemId) continue;
    if (quality && entry.quality !== quality) continue;
    const spend = Math.min(entry.quantity, remaining);
    entry.quantity -= spend;
    remaining -= spend;
    if (remaining === 0) break;
  }
  return normalize(updated);
};

export const hasItems = (inventory: InventoryEntry[], costs: Partial<Record<ItemId, number>>): boolean =>
  Object.entries(costs).every(([itemId, amount]) => {
    const needed = amount ?? 0;
    if (needed <= 0) return true;
    return getItemQuantity(inventory, itemId as ItemId) >= needed;
  });

export const consumeItems = (inventory: InventoryEntry[], costs: Partial<Record<ItemId, number>>): InventoryEntry[] => {
  if (!hasItems(inventory, costs)) {
    throw new Error('Insufficient items.');
  }
  let updated = [...inventory];
  for (const [itemId, amount] of Object.entries(costs)) {
    const quantity = amount ?? 0;
    if (quantity > 0) {
      updated = removeItem(updated, itemId as ItemId, quantity);
    }
  }
  return updated;
};

export const mergeCompatibleStacks = (inventory: InventoryEntry[]): InventoryEntry[] => {
  const sorted = [...inventory].sort((left, right) => {
    if (left.itemId === right.itemId) {
      return qualityWeight[left.quality ?? 'Common'] - qualityWeight[right.quality ?? 'Common'];
    }
    return left.itemId.localeCompare(right.itemId);
  });
  let merged: InventoryEntry[] = [];
  for (const entry of sorted) {
    merged = addItem(merged, entry.itemId, entry.quantity, entry.quality);
  }
  return merged;
};

const slotForItem = (itemId: ItemId): ItemSlot | null => ITEMS_BY_ID[itemId].equipSlot ?? null;

export const canEquipItem = (itemId: ItemId): { ok: boolean; reason?: string } => {
  const slot = slotForItem(itemId);
  if (!slot) {
    return { ok: false, reason: `${ITEMS_BY_ID[itemId].name} cannot be equipped.` };
  }
  return { ok: true };
};

export const equipItem = (player: VampireCharacter, inventory: InventoryEntry[], itemId: ItemId): { player: VampireCharacter; inventory: InventoryEntry[] } => {
  const check = canEquipItem(itemId);
  if (!check.ok) {
    throw new Error(check.reason);
  }
  if (getItemQuantity(inventory, itemId) < 1) {
    throw new Error(`You do not own ${ITEMS_BY_ID[itemId].name}.`);
  }
  const slot = slotForItem(itemId) as ItemSlot;
  const nextEquipment: EquipmentLoadout = { ...player.equipment };
  const replacedItem = nextEquipment[slot];
  nextEquipment[slot] = itemId;

  let updatedInventory = removeItem(inventory, itemId, 1);
  if (replacedItem) {
    updatedInventory = addItem(updatedInventory, replacedItem, 1);
  }
  return {
    player: { ...player, equipment: nextEquipment },
    inventory: mergeCompatibleStacks(updatedInventory),
  };
};

export const unequipItem = (player: VampireCharacter, inventory: InventoryEntry[], slot: ItemSlot): { player: VampireCharacter; inventory: InventoryEntry[] } => {
  const equippedItem = player.equipment[slot];
  if (!equippedItem) {
    throw new Error(`No item equipped in ${slot}.`);
  }
  const nextEquipment: EquipmentLoadout = { ...player.equipment };
  delete nextEquipment[slot];
  const updatedInventory = addItem(inventory, equippedItem, 1);
  return {
    player: { ...player, equipment: nextEquipment },
    inventory: mergeCompatibleStacks(updatedInventory),
  };
};

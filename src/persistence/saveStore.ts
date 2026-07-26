import { SAVE_FORMAT_VERSION } from '../config/game';
import { ITEMS_BY_ID } from '../data/items';
import type { DomainResourcePool, InventoryEntry, ItemId, QualityLevel, SaveGame, SaveSlot } from '../types/models';

const DATABASE_NAME = 'bloodwake-db';
const STORE_NAME = 'save-slots';

const openDatabase = async (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
  });

const runTransaction = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

const QUALITY_LEVELS: QualityLevel[] = ['Poor', 'Common', 'Fine', 'Masterwork'];

const RESOURCE_TO_ITEM_ID: Record<string, ItemId> = {
  Wood: 'wood',
  Stone: 'stone',
  'Iron Ore': 'iron_ore',
  Leather: 'leather',
  Herbs: 'herbs',
  Food: 'food',
};

const normalizeInventoryEntry = (value: unknown): InventoryEntry | null => {
  if (!isRecord(value) || typeof value.itemId !== 'string' || typeof value.quantity !== 'number') {
    return null;
  }
  if (value.quantity <= 0 || !Number.isFinite(value.quantity)) {
    return null;
  }
  const quantity = Math.floor(value.quantity);
  if (quantity <= 0) {
    return null;
  }
  if (!(value.itemId in ITEMS_BY_ID)) {
    throw new Error(`Unknown item in save: ${String(value.itemId)}`);
  }
  return {
    itemId: value.itemId as ItemId,
    quantity,
    quality: typeof value.quality === 'string' && QUALITY_LEVELS.includes(value.quality as QualityLevel) ? (value.quality as QualityLevel) : undefined,
  };
};

const mergeInventory = (inventory: InventoryEntry[]): InventoryEntry[] => {
  const map = new Map<string, InventoryEntry>();
  for (const entry of inventory) {
    const key = `${entry.itemId}:${entry.quality ?? 'none'}`;
    const current = map.get(key);
    if (current) {
      current.quantity += entry.quantity;
    } else {
      map.set(key, { ...entry });
    }
  }
  return [...map.values()];
};

export const validateSaveGame = (value: unknown): value is SaveGame => {
  if (!isRecord(value)) {
    return false;
  }
  const requiredArrays = ['rooms', 'inventory', 'servants', 'npcs', 'craftingQueue', 'constructionTasks', 'quests', 'collectibles'];
  if (typeof value.version !== 'number' || typeof value.seed !== 'string' || typeof value.title !== 'string') {
    return false;
  }
  if (!isRecord(value.player) || !isRecord(value.time) || !Array.isArray(value.lastEventLog)) {
    return false;
  }
  return requiredArrays.every((field) => Array.isArray(value[field]));
};

const migrateV1ToV2 = (value: Record<string, unknown>): SaveGame => {
  const rawResources = isRecord(value.resources) ? value.resources : {};
  const inventoryFromSave = Array.isArray(value.inventory)
    ? value.inventory.map(normalizeInventoryEntry).filter((entry): entry is InventoryEntry => entry !== null)
    : [];

  const migratedFromResources: InventoryEntry[] = Object.entries(rawResources)
    .filter(([resourceId, amount]) => typeof amount === 'number' && (amount as number) > 0 && RESOURCE_TO_ITEM_ID[resourceId])
    .map(([resourceId, amount]) => ({ itemId: RESOURCE_TO_ITEM_ID[resourceId], quantity: Math.floor(amount as number) }));

  const strategicResources: DomainResourcePool = {
    bloodEssence: typeof rawResources['Blood Essence'] === 'number' ? Math.max(0, Math.floor(rawResources['Blood Essence'] as number)) : 0,
    security: typeof rawResources.Security === 'number' ? Math.max(0, Math.floor(rawResources.Security as number)) : 0,
    gold: 0,
    knowledge: 0,
    influence: 0,
  };

  const legacy = value as unknown as SaveGame;
  const playerWithEquipment: SaveGame['player'] = {
    ...legacy.player,
    equipment: isRecord(legacy.player?.equipment) ? (legacy.player.equipment as SaveGame['player']['equipment']) : {},
  };

  const migrated: SaveGame = {
    ...legacy,
    version: SAVE_FORMAT_VERSION,
    title: 'Bloodwake',
    characterRoll: typeof value.characterRoll === 'number' && Number.isFinite(value.characterRoll) ? Math.max(0, Math.floor(value.characterRoll)) : 0,
    player: playerWithEquipment,
    strategicResources,
    inventory: mergeInventory([...inventoryFromSave, ...migratedFromResources]),
    inheritanceHistory: Array.isArray(value.inheritanceHistory) ? (value.inheritanceHistory as SaveGame['inheritanceHistory']) : [],
    lastEventLog: Array.isArray(value.lastEventLog) ? (value.lastEventLog as string[]) : [],
  };

  return migrated;
};

const normalizeV2 = (value: SaveGame): SaveGame => {
  const inventory = value.inventory.map((entry) => normalizeInventoryEntry(entry));
  if (inventory.some((entry) => entry === null)) {
    throw new Error('Inventory contains malformed entries.');
  }
  const normalized = {
    ...value,
    version: SAVE_FORMAT_VERSION,
    title: 'Bloodwake',
    characterRoll: Number.isFinite(value.characterRoll) ? Math.max(0, Math.floor(value.characterRoll)) : 0,
    player: {
      ...value.player,
      equipment: value.player.equipment ?? {},
    },
    strategicResources: {
      bloodEssence: Math.max(0, Math.floor(value.strategicResources?.bloodEssence ?? 0)),
      security: Math.max(0, Math.floor(value.strategicResources?.security ?? 0)),
      gold: Math.max(0, Math.floor(value.strategicResources?.gold ?? 0)),
      knowledge: Math.max(0, Math.floor(value.strategicResources?.knowledge ?? 0)),
      influence: Math.max(0, Math.floor(value.strategicResources?.influence ?? 0)),
    },
    inventory: mergeInventory(inventory as InventoryEntry[]),
    inheritanceHistory: value.inheritanceHistory ?? [],
    lastEventLog: value.lastEventLog ?? [],
  };
  return normalized;
};

export const migrateSaveGame = (value: unknown): SaveGame => {
  if (!validateSaveGame(value)) {
    throw new Error('Imported save does not match the expected structure.');
  }
  if (value.version > SAVE_FORMAT_VERSION) {
    throw new Error('Save file version is newer than this build supports.');
  }
  if (value.version < 2) {
    return migrateV1ToV2(value as unknown as Record<string, unknown>);
  }
  return normalizeV2(value as SaveGame);
};

export const listSaveSlots = async (): Promise<SaveSlot[]> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list save slots.'));
    request.onsuccess = () => resolve(request.result as SaveSlot[]);
  });
};

export const saveToSlot = async (slotId: string, data: SaveGame): Promise<void> => {
  await runTransaction('readwrite', (store) => store.put({ id: slotId, updatedAt: Date.now(), data } satisfies SaveSlot));
};

export const loadFromSlot = async (slotId: string): Promise<SaveGame | null> => {
  const result = await runTransaction('readonly', (store) => store.get(slotId));
  const slot = result as SaveSlot | undefined;
  return slot ? migrateSaveGame(slot.data) : null;
};

export const deleteSlot = async (slotId: string): Promise<void> => {
  await runTransaction('readwrite', (store) => store.delete(slotId));
};

export const exportSaveGame = (saveGame: SaveGame): string => JSON.stringify(saveGame, null, 2);

export const importSaveGame = (raw: string): SaveGame => migrateSaveGame(JSON.parse(raw) as unknown);

import { SAVE_FORMAT_VERSION } from '../config/game';
import { ITEMS_BY_ID } from '../data/items';
import type { HumanServant, InventoryEntry, ItemId, QualityLevel, SaveGame, SaveSlot, VampireVassal, WorldCycleState } from '../types/models';

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

const isIntegerInRange = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;

const isValidSettings = (value: unknown): boolean =>
  isRecord(value) && typeof value.volume === 'number' && Number.isFinite(value.volume) && typeof value.uiScale === 'number' && Number.isFinite(value.uiScale);

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
  const requiredArrays = ['rooms', 'inventory', 'humanServants', 'vampireVassals', 'npcs', 'craftingQueue', 'constructionTasks', 'quests', 'collectibles'];
  if (typeof value.version !== 'number' || typeof value.seed !== 'string' || typeof value.title !== 'string') {
    return false;
  }
  if (!isRecord(value.player) || !isRecord(value.time) || !Array.isArray(value.lastEventLog)) {
    return false;
  }
  if (!isValidSettings(value.settings)) {
    return false;
  }
  // Reject saves that still carry the legacy servants field
  if ('servants' in value) {
    return false;
  }
  if (!requiredArrays.every((field) => Array.isArray(value[field]))) {
    return false;
  }
  // Validate v5 free-human metadata. Old decorative fields are no longer accepted.
  const npcs = value.npcs as unknown[];
  for (const record of npcs) {
    if (!isRecord(record) || typeof record.id !== 'string') {
      return false;
    }
    if ('bloodQuality' in record || 'recruitability' in record) {
      return false;
    }
    if (!isIntegerInRange(record.bloodResonance, 1, 5)) {
      return false;
    }
    if (!isIntegerInRange(record.resolve, 1, 5)) {
      return false;
    }
    if (!isIntegerInRange(record.disposition, -100, 100)) {
      return false;
    }
    if (!isIntegerInRange(record.fear, 0, 100)) {
      return false;
    }
  }

  // Validate population records are objects with string ids
  const humanServants = value.humanServants as unknown[];
  const vampireVassals = value.vampireVassals as unknown[];
  for (const record of humanServants) {
    if (!isRecord(record) || typeof record.id !== 'string' || record.kind !== 'human_servant') {
      return false;
    }
  }
  for (const record of vampireVassals) {
    if (!isRecord(record) || typeof record.id !== 'string' || record.kind !== 'vampire_vassal') {
      return false;
    }
  }
  // Reject duplicate IDs within and across collections
  const humanIds = new Set((humanServants as HumanServant[]).map((r) => r.id));
  if (humanIds.size !== humanServants.length) {
    return false;
  }
  const vassalIds = new Set((vampireVassals as VampireVassal[]).map((r) => r.id));
  if (vassalIds.size !== vampireVassals.length) {
    return false;
  }
  for (const id of vassalIds) {
    if (humanIds.has(id)) {
      return false;
    }
  }
  return true;
};

const VALID_ID_PATTERN = /^[a-z0-9-]+$/;

const normalizeWorldCycle = (raw: unknown): WorldCycleState => {
  const cycle = isRecord(raw) && typeof raw.cycle === 'number' && Number.isFinite(raw.cycle) ? Math.max(0, Math.floor(raw.cycle)) : 0;
  const MAX_ID_ARRAY_SIZE = 500;
  const sanitizeIds = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return [...new Set(
      arr
        .filter((item): item is string => typeof item === 'string' && item.length <= 64)
        .map((item) => item.toLowerCase())
        .filter((item) => VALID_ID_PATTERN.test(item))
        .slice(0, MAX_ID_ARRAY_SIZE)
    )];
  };
  return {
    cycle,
    collectedResourceNodeIds: sanitizeIds(isRecord(raw) ? raw.collectedResourceNodeIds : undefined),
    defeatedEnemyIds: sanitizeIds(isRecord(raw) ? raw.defeatedEnemyIds : undefined),
  };
};

const normalizeV5 = (value: SaveGame): SaveGame => {
  const inventory = value.inventory.map((entry) => normalizeInventoryEntry(entry));
  if (inventory.some((entry) => entry === null)) {
    throw new Error('Inventory contains malformed entries.');
  }
  const normalized: SaveGame = {
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
    worldCycle: normalizeWorldCycle((value as unknown as Record<string, unknown>).worldCycle),
    inheritanceHistory: value.inheritanceHistory ?? [],
    lastEventLog: value.lastEventLog ?? [],
  };
  return normalized;
};

export const migrateSaveGame = (value: unknown): SaveGame => {
  // Detect old save versions and reject them cleanly
  if (isRecord(value) && typeof value.version === 'number') {
    if (value.version < SAVE_FORMAT_VERSION) {
      throw new Error(
        `This save belongs to an incompatible older game version (save v${value.version}, current v${SAVE_FORMAT_VERSION}). ` +
        'Old saves are not supported. Please start a new game.',
      );
    }
    if (value.version > SAVE_FORMAT_VERSION) {
      throw new Error('Save file version is newer than this build supports.');
    }
  }
  if (!validateSaveGame(value)) {
    throw new Error('Imported save does not match the expected structure.');
  }
  return normalizeV5(value);
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

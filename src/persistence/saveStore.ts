import { SAVE_FORMAT_VERSION } from '../config/game';
import type { SaveGame, SaveSlot } from '../types/models';

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

export const validateSaveGame = (value: unknown): value is SaveGame => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const save = value as Partial<SaveGame>;
  return (
    typeof save.version === 'number' &&
    typeof save.seed === 'string' &&
    typeof save.title === 'string' &&
    Array.isArray(save.rooms) &&
    Array.isArray(save.inventory) &&
    Array.isArray(save.servants) &&
    Array.isArray(save.npcs) &&
    Array.isArray(save.craftingQueue) &&
    Array.isArray(save.constructionTasks) &&
    typeof save.player === 'object' &&
    typeof save.resources === 'object' &&
    typeof save.time === 'object' &&
    Array.isArray(save.quests) &&
    Array.isArray(save.collectibles)
  );
};

export const migrateSaveGame = (value: unknown): SaveGame => {
  if (!validateSaveGame(value)) {
    throw new Error('Imported save does not match the expected structure.');
  }
  if (value.version > SAVE_FORMAT_VERSION) {
    throw new Error('Save file version is newer than this build supports.');
  }
  return {
    ...value,
    version: SAVE_FORMAT_VERSION,
    inheritanceHistory: value.inheritanceHistory ?? [],
    lastEventLog: value.lastEventLog ?? [],
  };
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

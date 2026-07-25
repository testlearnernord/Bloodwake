import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { exportSaveGame, importSaveGame, loadFromSlot, migrateSaveGame, saveToSlot, validateSaveGame } from '../persistence/saveStore';

describe('save serialization and validation', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('bloodwake-db');
  });

  it('serializes and reloads a save slot', async () => {
    const state = createNewGameState({ seed: 'save-seed' });
    await saveToSlot('slot-test', state);
    const loaded = await loadFromSlot('slot-test');
    expect(loaded?.seed).toBe('save-seed');
  });

  it('exports and imports a valid save payload', () => {
    const state = createNewGameState({ seed: 'save-export' });
    const exported = exportSaveGame(state);
    const imported = importSaveGame(exported);
    expect(imported.seed).toBe('save-export');
  });

  it('rejects invalid imported saves', () => {
    expect(validateSaveGame({ nope: true })).toBe(false);
  });

  it('migrates an older save to the current version', () => {
    const state = createNewGameState({ seed: 'old-save' });
    const migrated = migrateSaveGame({ ...state, version: 0, inheritanceHistory: undefined, lastEventLog: undefined });
    expect(migrated.version).toBe(state.version);
    expect(migrated.inheritanceHistory).toEqual([]);
  });
});

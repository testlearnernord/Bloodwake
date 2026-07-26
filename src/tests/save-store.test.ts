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
    expect(loaded?.version).toBe(2);
  });

  it('exports and imports a valid save payload', () => {
    const state = createNewGameState({ seed: 'save-export', characterRoll: 2 });
    const exported = exportSaveGame(state);
    const imported = importSaveGame(exported);
    expect(imported.seed).toBe('save-export');
    expect(imported.characterRoll).toBe(2);
  });

  it('rejects invalid imported saves', () => {
    expect(validateSaveGame({ nope: true })).toBe(false);
  });

  it('migrates a v1 save to v2 without deleting servants', () => {
    const v2 = createNewGameState({ seed: 'old-save' });
    const v1Like = {
      ...v2,
      version: 1,
      title: 'Vampire Breed',
      characterRoll: undefined,
      strategicResources: undefined,
      resources: {
        Wood: 6,
        Stone: 3,
        'Iron Ore': 2,
        Leather: 1,
        Herbs: 1,
        Food: 2,
        'Blood Essence': 4,
        Security: 2,
      },
      inventory: [{ itemId: 'memory_talisman', quantity: 1, quality: 'Common' }],
      servants: [
        {
          ...v2.player,
          id: 'servant-legacy',
          type: 'human',
          priorities: {
            Building: 'Normal',
            Crafting: 'Normal',
            Gathering: 'Normal',
            Guarding: 'Normal',
            Research: 'Disabled',
            Hunting: 'Low',
          },
          currentJob: null,
          currentTask: null,
          taskReason: 'Legacy servant',
          equipped: {},
        },
      ],
    };
    const migrated = migrateSaveGame(v1Like);
    expect(migrated.version).toBe(2);
    expect(migrated.title).toBe('Bloodwake');
    expect(migrated.characterRoll).toBe(0);
    expect(migrated.strategicResources.bloodEssence).toBe(4);
    expect(migrated.strategicResources.security).toBe(2);
    expect(migrated.inventory.find((entry) => entry.itemId === 'wood')?.quantity).toBe(6);
    expect(migrated.servants.length).toBe(1);
  });

  it('rejects malformed inventory entries in v2 saves', () => {
    const state = createNewGameState({ seed: 'malformed' });
    const malformed = { ...state, inventory: [{ itemId: 'wood', quantity: -2 }] };
    expect(() => migrateSaveGame(malformed)).toThrow(/Inventory contains malformed entries/);
  });
});

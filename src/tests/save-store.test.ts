import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { exportSaveGame, importSaveGame, loadFromSlot, migrateSaveGame, saveToSlot, validateSaveGame } from '../persistence/saveStore';
import { applyHumanAction } from '../simulation/combat/bite';
import { SAVE_FORMAT_VERSION } from '../config/game';

describe('save serialization and validation', () => {
  beforeEach(() => {
    indexedDB.deleteDatabase('bloodwake-db');
  });

  it('serializes and reloads a save slot (v8)', async () => {
    const state = createNewGameState({ seed: 'save-seed' });
    await saveToSlot('slot-test', state);
    const loaded = await loadFromSlot('slot-test');
    expect(loaded?.seed).toBe('save-seed');
    expect(loaded?.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('exports and imports a valid v8 save payload', () => {
    const state = createNewGameState({ seed: 'save-export', characterRoll: 2 });
    const exported = exportSaveGame(state);
    const imported = importSaveGame(exported);
    expect(imported.seed).toBe('save-export');
    expect(imported.characterRoll).toBe(2);
    expect(imported.humanServants).toEqual([]);
    expect(imported.vampireVassals).toEqual([]);
  });

  it('rejects invalid imported saves', () => {
    expect(validateSaveGame({ nope: true })).toBe(false);
  });

  it('rejects v8 saves with non-finite player vitae values', () => {
    const state = createNewGameState({ seed: 'bad-vitae' });
    const badVitae = { ...state, player: { ...state.player, vitae: Number.NaN } };
    const badMaxVitae = { ...state, player: { ...state.player, maxVitae: Number.POSITIVE_INFINITY } };
    const badVitaeType = { ...state, player: { ...state.player, vitae: '5' } };
    const badMaxVitaeType = { ...state, player: { ...state.player, maxVitae: undefined } };
    expect(validateSaveGame(badVitae)).toBe(false);
    expect(validateSaveGame(badMaxVitae)).toBe(false);
    expect(validateSaveGame(badVitaeType)).toBe(false);
    expect(validateSaveGame(badMaxVitaeType)).toBe(false);
  });

  it('rejects v1 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-save' });
    const v1Like = { ...base, version: 1, servants: [], humanServants: undefined, vampireVassals: undefined };
    expect(() => migrateSaveGame(v1Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v2 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v2' });
    const v2Like = { ...base, version: 2, servants: [], humanServants: undefined, vampireVassals: undefined };
    expect(() => migrateSaveGame(v2Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v3 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v3' });
    const v3Like = { ...base, version: 3, servants: [], humanServants: undefined, vampireVassals: undefined };
    expect(() => migrateSaveGame(v3Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v4 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v4' });
    const v4Like = { ...base, version: 4 };
    expect(() => migrateSaveGame(v4Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v5 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v5' });
    const v5Like = { ...base, version: 5 };
    expect(() => migrateSaveGame(v5Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v6 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v6' });
    const v6Like = { ...base, version: 6 };
    expect(() => migrateSaveGame(v6Like)).toThrow(/incompatible older game version/);
  });

  it('rejects v7 saves with a clear incompatibility error', () => {
    const base = createNewGameState({ seed: 'old-v7' });
    const v7Like = { ...base, version: 7 };
    expect(() => migrateSaveGame(v7Like)).toThrow(/incompatible older game version/);
  });

  it('rejects saves newer than the current version', () => {
    const base = createNewGameState({ seed: 'future' });
    const future = { ...base, version: SAVE_FORMAT_VERSION + 1 };
    expect(() => migrateSaveGame(future)).toThrow(/newer than this build/);
  });

  it('rejects malformed inventory entries in v8 saves', () => {
    const state = createNewGameState({ seed: 'malformed' });
    const malformed = { ...state, inventory: [{ itemId: 'wood', quantity: -2 }] };
    expect(() => migrateSaveGame(malformed)).toThrow(/Inventory contains malformed entries/);
  });

  it('rejects non-positive imported quantities after flooring', () => {
    const state = createNewGameState({ seed: 'fractional' });
    const malformed = { ...state, inventory: [{ itemId: 'wood', quantity: 0.5 }] };
    expect(() => migrateSaveGame(malformed)).toThrow(/Inventory contains malformed entries/);
  });

  it('preserves turned vampire vassals across v8 save export and reload', () => {
    const state = createNewGameState({ seed: 'turned-save' });
    state.player.vitae = 5;
    const turned = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn').state;
    const loaded = importSaveGame(exportSaveGame(turned));
    expect(loaded.vampireVassals).toHaveLength(1);
    expect(loaded.vampireVassals[0]?.kind).toBe('vampire_vassal');
    expect(loaded.inheritanceHistory).toHaveLength(1);
  });

  it('new game has no servants field', () => {
    const state = createNewGameState({ seed: 'no-servants-field' });
    expect('servants' in state).toBe(false);
  });

  it('new game initializes both population arrays as empty', () => {
    const state = createNewGameState({ seed: 'init-pop' });
    expect(state.humanServants).toEqual([]);
    expect(state.vampireVassals).toEqual([]);
  });

  it('rejects v8 saves that still contain a legacy servants field', () => {
    const state = createNewGameState({ seed: 'legacy-servants' });
    const withLegacy = { ...state, servants: [] };
    expect(validateSaveGame(withLegacy)).toBe(false);
    expect(() => migrateSaveGame(withLegacy)).toThrow();
  });

  it('rejects v8 saves that still contain a legacy hunger field with a targeted error', () => {
    const state = createNewGameState({ seed: 'legacy-hunger' });
    const withLegacyHunger = { ...state, player: { ...state.player, hunger: 0 } };
    expect(validateSaveGame(withLegacyHunger)).toBe(false);
    expect(() => migrateSaveGame(withLegacyHunger)).toThrow(/legacy hunger data/);
  });

  it('rejects v8 saves with malformed humanServants records', () => {
    const state = createNewGameState({ seed: 'malformed-hs' });
    const bad = { ...state, humanServants: [{ id: 'x', kind: 'wrong_kind' }] };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects v8 saves with malformed vampireVassals records', () => {
    const state = createNewGameState({ seed: 'malformed-vv' });
    const bad = { ...state, vampireVassals: [{ id: 'x', kind: 'wrong_kind' }] };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects v8 saves with duplicate IDs within humanServants', () => {
    const state = createNewGameState({ seed: 'dup-hs' });
    const dup = { ...state, humanServants: [{ id: 'dup-1', kind: 'human_servant' }, { id: 'dup-1', kind: 'human_servant' }] };
    expect(validateSaveGame(dup)).toBe(false);
  });

  it('rejects v8 saves with duplicate IDs within vampireVassals', () => {
    const state = createNewGameState({ seed: 'dup-vv' });
    const dup = { ...state, vampireVassals: [{ id: 'dup-1', kind: 'vampire_vassal' }, { id: 'dup-1', kind: 'vampire_vassal' }] };
    expect(validateSaveGame(dup)).toBe(false);
  });

  it('rejects v8 saves with a shared ID across both population collections', () => {
    const state = createNewGameState({ seed: 'cross-dup' });
    const cross = {
      ...state,
      humanServants: [{ id: 'shared-1', kind: 'human_servant' }],
      vampireVassals: [{ id: 'shared-1', kind: 'vampire_vassal' }],
    };
    expect(validateSaveGame(cross)).toBe(false);
  });

  it('rejects malformed v8 Blood Resonance metadata', () => {
    const state = createNewGameState({ seed: 'bad-resonance' });
    const bad = { ...state, npcs: state.npcs.map((npc, index) => index === 0 ? { ...npc, bloodResonance: 6 } : npc) };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects malformed v8 Resolve metadata', () => {
    const state = createNewGameState({ seed: 'bad-resolve' });
    const bad = { ...state, npcs: state.npcs.map((npc, index) => index === 0 ? { ...npc, resolve: 0 } : npc) };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects out-of-range v6 Disposition metadata', () => {
    const state = createNewGameState({ seed: 'bad-disposition' });
    const bad = { ...state, npcs: state.npcs.map((npc, index) => index === 0 ? { ...npc, disposition: 101 } : npc) };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects out-of-range v6 Fear metadata', () => {
    const state = createNewGameState({ seed: 'bad-fear' });
    const bad = { ...state, npcs: state.npcs.map((npc, index) => index === 0 ? { ...npc, fear: -1 } : npc) };
    expect(validateSaveGame(bad)).toBe(false);
  });

  it('rejects stale v8 free-human metadata fields', () => {
    const state = createNewGameState({ seed: 'stale-human-fields' });
    const first = state.npcs[0];
    const stale = {
      ...state,
      npcs: state.npcs.map((npc, index) => index === 0 ? { ...npc, bloodQuality: first.bloodResonance, recruitability: 50 } : npc),
    };
    expect(validateSaveGame(stale)).toBe(false);
  });

});

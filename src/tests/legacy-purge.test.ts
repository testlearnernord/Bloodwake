import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { SAVE_FORMAT_VERSION } from '../config/game';
import { migrateSaveGame, validateSaveGame } from '../persistence/saveStore';

describe('0.6.3e save authority purge', () => {
  it('uses save v11 with one authority for construction, Blood Essence, and memories', () => {
    const state = createNewGameState({ seed: 'legacy-purge' });
    expect(SAVE_FORMAT_VERSION).toBe(11);
    expect('constructionTasks' in state).toBe(false);
    expect('bloodEssence' in state.player).toBe(false);
    expect('memoryFragments' in state.player).toBe(false);
    expect(state.rooms).toHaveLength(1);
    expect(state.strategicResources.bloodEssence).toBe(1);
    expect(state.collectibles.every((entry) => entry.discovered === false)).toBe(true);
    expect(validateSaveGame(state)).toBe(true);
  });

  it('rejects stale v11 payloads that reintroduce removed duplicate authorities', () => {
    const state = createNewGameState({ seed: 'legacy-reject' });
    expect(validateSaveGame({ ...state, constructionTasks: [] })).toBe(false);
    expect(validateSaveGame({ ...state, player: { ...state.player, bloodEssence: 4 } })).toBe(false);
    expect(validateSaveGame({ ...state, player: { ...state.player, memoryFragments: ['memory_fragment_1'] } })).toBe(false);
  });

  it('rejects save v9 after the breaking purge', () => {
    const state = createNewGameState({ seed: 'legacy-v9' });
    expect(() => migrateSaveGame({ ...state, version: 9 })).toThrow(/incompatible older game version/);
  });
});

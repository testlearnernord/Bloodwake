import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { createVampireVassal } from '../simulation/servants/vampireVassals';
import { getDominionSummary, getVassalCryptCapacity, resolveDominionStrain } from '../simulation/servants/dominion';
import type { BuiltRoom } from '../types/models';

const makeVassals = (count: number) => {
  const state = createNewGameState({ seed: 'strain-fixture' });
  return Array.from({ length: count }, (_, index) => createVampireVassal({ ...state.player, id: `vassal-${index}`, name: `Vassal ${index}` }));
};

describe('0.6.4b Vassal Crypt and Dominion Strain', () => {
  it('adds two Dominion only for each built Vassal Crypt', () => {
    const rooms: BuiltRoom[] = [
      { id: 'crypt-built', roomId: 'vassal_crypt', x: 1, y: 0, width: 1, height: 1, status: 'built', progress: 3, assignedWorkerIds: [] },
      { id: 'crypt-building', roomId: 'vassal_crypt', x: 2, y: 0, width: 1, height: 1, status: 'under_construction', progress: 1, assignedWorkerIds: [] },
    ];
    expect(getVassalCryptCapacity(rooms)).toBe(2);
  });

  it('derives a soft cap and exposes Strain instead of blocking active Vassals', () => {
    const state = createNewGameState({ seed: 'strain-summary' });
    state.vampireVassals = makeVassals(6);
    const summary = getDominionSummary(state);
    expect(summary.activeCost).toBe(6);
    expect(summary.strain).toBe(Math.max(0, 6 - summary.capacity));
    expect(summary.strainState).not.toBe('Stable');
  });

  it('applies nightly loyalty/stress pressure only to active Vassals', () => {
    const state = createNewGameState({ seed: 'strain-resolve' });
    state.player.attributes.bloodControl = 0;
    state.player.attributes.presence = 0;
    state.vampireVassals = makeVassals(3);
    state.vampireVassals[2] = { ...state.vampireVassals[2], state: 'torpor', torporSinceDay: state.time.day };
    const beforeActive = state.vampireVassals[0];
    const beforeTorpid = state.vampireVassals[2];
    const result = resolveDominionStrain(state);
    expect(result.summary.capacity).toBe(1);
    expect(result.summary.strain).toBe(1);
    expect(result.vampireVassals[0].loyalty).toBe(beforeActive.loyalty - 2);
    expect(result.vampireVassals[0].stress).toBe(beforeActive.stress + 4);
    expect(result.vampireVassals[2].loyalty).toBe(beforeTorpid.loyalty);
    expect(result.vampireVassals[2].stress).toBe(beforeTorpid.stress);
  });

  it('does nothing while Dominion is stable', () => {
    const state = createNewGameState({ seed: 'stable' });
    state.vampireVassals = makeVassals(1);
    const result = resolveDominionStrain(state);
    expect(result.summary.strain).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.vampireVassals).toBe(state.vampireVassals);
  });
});

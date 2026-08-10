import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { getDominionSummary, setVassalTorpor } from '../simulation/servants/dominion';
import { runWorkShift } from '../simulation/servants/production';
import { createVampireVassal } from '../simulation/servants/vampireVassals';
import { selectTaskForVassal } from '../simulation/servants/tasks';
import { validateSaveGame } from '../persistence/saveStore';

describe('0.6.4a Dominion and Torpor', () => {
  const withVassal = () => {
    const state = createNewGameState({ seed: 'dominion' });
    state.vampireVassals = [createVampireVassal({ ...state.player, id: 'vassal-1', name: 'Alda' })];
    return state;
  };

  it('charges Dominion only for active vassals', () => {
    const state = withVassal();
    const active = getDominionSummary(state);
    expect(active.activeCost).toBe(1);
    expect(active.capacity).toBeGreaterThanOrEqual(1);
    const sleeping = setVassalTorpor(state, 'vassal-1', true).state;
    expect(getDominionSummary(sleeping).activeCost).toBe(0);
    expect(sleeping.vampireVassals[0].torporSinceDay).toBe(state.time.day);
  });

  it('prevents torpid vassals from receiving work', () => {
    const state = setVassalTorpor(withVassal(), 'vassal-1', true).state;
    const vassal = state.vampireVassals[0];
    const task = selectTaskForVassal(vassal, state.rooms, state.craftingQueue, state.inventory, 'night');
    expect(task?.reason).toMatch(/Torpor/);
    expect(task?.score).toBeLessThan(0);
    const shift = runWorkShift(state.vampireVassals, state.rooms, state.craftingQueue, state.strategicResources, state.inventory, 'night', state.seed);
    expect(shift.vampireVassals[0]?.currentJob).toBeNull();
    expect(shift.vampireVassals[0]?.currentTask).toBeNull();
    expect(shift.vampireVassals[0]?.taskReason).toContain('Torpor');
  });

  it('wakes a vassal back into active Dominion', () => {
    const sleeping = setVassalTorpor(withVassal(), 'vassal-1', true).state;
    const awake = setVassalTorpor(sleeping, 'vassal-1', false).state;
    expect(awake.vampireVassals[0].state).toBe('active');
    expect(awake.vampireVassals[0].torporSinceDay).toBeNull();
    expect(getDominionSummary(awake).activeCost).toBe(1);
  });

  it('requires explicit v12 lifecycle fields in saves', () => {
    const state = withVassal();
    expect(state.version).toBe(12);
    expect(validateSaveGame(state)).toBe(true);
    const malformed = { ...state, vampireVassals: [{ ...state.vampireVassals[0], state: 'torpor', torporSinceDay: null }] };
    expect(validateSaveGame(malformed)).toBe(false);
  });
});

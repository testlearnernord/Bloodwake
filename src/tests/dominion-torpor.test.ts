import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { getDominionSummary, incapacitateVassal, setVassalTorpor } from '../simulation/servants/dominion';
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

  it('establishes all Torpor invariants through the manual transition', () => {
    const state = withVassal();
    state.vampireVassals[0] = {
      ...state.vampireVassals[0],
      operationalOrder: { type: 'guard', issuedDay: state.time.day },
      currentJob: 'Guarding',
      currentTask: 'vassal-order:guard',
      taskReason: 'Holding a guard post.',
    };
    const sleeping = setVassalTorpor(state, 'vassal-1', true).state;
    const vassal = sleeping.vampireVassals[0];
    expect(vassal.state).toBe('torpor');
    expect(vassal.torporSinceDay).toBe(state.time.day);
    expect(vassal.operationalOrder).toEqual({ type: 'none', issuedDay: null });
    expect(vassal.currentJob).toBeNull();
    expect(vassal.currentTask).toBeNull();
    expect(vassal.taskReason).toContain('Torpor');
    expect(validateSaveGame(sleeping)).toBe(true);
  });

  it('uses the same Torpor invariants for combat incapacitation and leaves the vassal at 1 Health', () => {
    const state = withVassal();
    state.vampireVassals[0] = {
      ...state.vampireVassals[0],
      health: 0,
      operationalOrder: { type: 'raid', issuedDay: state.time.day },
      currentJob: 'Guarding',
      currentTask: 'vassal-order:raid',
      taskReason: 'Raiding.',
    };
    const result = incapacitateVassal(state, 'vassal-1');
    const vassal = result.state.vampireVassals[0];
    expect(vassal.health).toBe(1);
    expect(vassal.state).toBe('torpor');
    expect(vassal.torporSinceDay).toBe(state.time.day);
    expect(vassal.operationalOrder).toEqual({ type: 'none', issuedDay: null });
    expect(vassal.currentJob).toBeNull();
    expect(vassal.currentTask).toBeNull();
    expect(vassal.taskReason).toContain('combat injuries');
    expect(result.state.lastEventLog[0]).toContain('[Combat] Alda was driven into Torpor.');
    expect(validateSaveGame(result.state)).toBe(true);
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

  it('wakes a vassal back into active Dominion without restoring a field order', () => {
    const state = withVassal();
    state.vampireVassals[0].operationalOrder = { type: 'hunt', issuedDay: state.time.day };
    const sleeping = setVassalTorpor(state, 'vassal-1', true).state;
    const awake = setVassalTorpor(sleeping, 'vassal-1', false).state;
    expect(awake.vampireVassals[0].state).toBe('active');
    expect(awake.vampireVassals[0].torporSinceDay).toBeNull();
    expect(awake.vampireVassals[0].operationalOrder).toEqual({ type: 'none', issuedDay: null });
    expect(awake.vampireVassals[0].currentJob).toBeNull();
    expect(awake.vampireVassals[0].currentTask).toBeNull();
    expect(getDominionSummary(awake).activeCost).toBe(1);
  });

  it('rejects incoherent Torpor saves with field orders or executable work', () => {
    const sleeping = setVassalTorpor(withVassal(), 'vassal-1', true).state;
    const withOrder = {
      ...sleeping,
      vampireVassals: [{ ...sleeping.vampireVassals[0], operationalOrder: { type: 'raid', issuedDay: sleeping.time.day } }],
    };
    const withTask = {
      ...sleeping,
      vampireVassals: [{ ...sleeping.vampireVassals[0], currentJob: 'Guarding', currentTask: 'legacy-task' }],
    };
    expect(validateSaveGame(withOrder)).toBe(false);
    expect(validateSaveGame(withTask)).toBe(false);
  });

  it('rejects malformed vassal vitals and political ranges while allowing finite fractional values', () => {
    const state = withVassal();
    const fractional = {
      ...state,
      vampireVassals: [{ ...state.vampireVassals[0], health: state.vampireVassals[0].health - 0.5, loyalty: 42.5, stress: 17.25 }],
    };
    expect(validateSaveGame(fractional)).toBe(true);

    const badHealth = {
      ...state,
      vampireVassals: [{ ...state.vampireVassals[0], health: state.vampireVassals[0].maxHealth + 1 }],
    };
    const badVitae = {
      ...state,
      vampireVassals: [{ ...state.vampireVassals[0], vitae: Number.NaN }],
    };
    const badPolitics = {
      ...state,
      vampireVassals: [{ ...state.vampireVassals[0], ambition: 101 }],
    };
    expect(validateSaveGame(badHealth)).toBe(false);
    expect(validateSaveGame(badVitae)).toBe(false);
    expect(validateSaveGame(badPolitics)).toBe(false);
  });

  it('requires explicit v12 lifecycle fields in saves', () => {
    const state = withVassal();
    expect(state.version).toBe(12);
    expect(validateSaveGame(state)).toBe(true);
    const malformed = { ...state, vampireVassals: [{ ...state.vampireVassals[0], state: 'torpor', torporSinceDay: null }] };
    expect(validateSaveGame(malformed)).toBe(false);
  });
});

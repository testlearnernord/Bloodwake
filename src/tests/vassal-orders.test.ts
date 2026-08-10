import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { setVassalTorpor } from '../simulation/servants/dominion';
import { runWorkShift } from '../simulation/servants/production';
import { selectTaskForVassal } from '../simulation/servants/tasks';
import {
  getVassalOrderComplianceChance,
  getVassalOperationalOrderDefinition,
  issueVassalOperationalOrder,
} from '../simulation/servants/vassalOrders';
import { createVampireVassal } from '../simulation/servants/vampireVassals';
import { validateSaveGame } from '../persistence/saveStore';
import type { VassalOperationalOrderType } from '../types/models';

const withVassal = () => {
  const state = createNewGameState({ seed: 'operational-orders' });
  const vassal = createVampireVassal({ ...state.player, id: 'vassal-orders-1', name: 'Clara' });
  state.vampireVassals = [{ ...vassal, loyalty: 100, morale: 100, ambition: 0, stress: 0 }];
  return state;
};

describe('0.6.4d Vampire Vassal operational orders', () => {
  it('initializes new vassals with no field operation and a valid v12 save shape', () => {
    const state = withVassal();
    expect(state.version).toBe(12);
    expect(state.vampireVassals[0].operationalOrder).toEqual({ type: 'none', issuedDay: null });
    expect(validateSaveGame(state)).toBe(true);
  });

  it('derives order compliance from the existing political profile and mission risk', () => {
    const vassal = withVassal().vampireVassals[0];
    expect(getVassalOrderComplianceChance(vassal, 'guard')).toBeGreaterThan(getVassalOrderComplianceChance(vassal, 'raid'));
    expect(getVassalOrderComplianceChance(vassal, 'none')).toBe(1);
  });

  it('describes Guard and Companion as current shared-combat behaviors', () => {
    expect(getVassalOperationalOrderDefinition('guard').description).not.toMatch(/once|later/i);
    expect(getVassalOperationalOrderDefinition('companion').description).not.toMatch(/once|later/i);
  });

  it('accepts a guaranteed low-risk order for a fully obedient vassal and makes it authoritative over routine work', () => {
    const state = withVassal();
    const issued = issueVassalOperationalOrder(state, state.vampireVassals[0].id, 'guard');
    expect(issued.accepted).toBe(true);
    expect(issued.state.vampireVassals[0].operationalOrder.type).toBe('guard');
    const task = selectTaskForVassal(issued.state.vampireVassals[0], issued.state.rooms, issued.state.craftingQueue, issued.state.inventory, 'night');
    expect(task?.operationalOrderType).toBe('guard');
    expect(task?.type).toBe('guard_stronghold');
  });

  it('keeps Scout, Hunt and Raid from creating fake batch rewards', () => {
    const operationTypes: VassalOperationalOrderType[] = ['scout', 'hunt', 'raid'];
    for (const operationType of operationTypes) {
      const state = withVassal();
      state.vampireVassals[0].operationalOrder = { type: operationType, issuedDay: state.time.day };
      const beforeResources = { ...state.strategicResources };
      const beforeInventory = [...state.inventory].sort((left, right) => left.itemId.localeCompare(right.itemId));
      const shift = runWorkShift(state.vampireVassals, state.rooms, state.craftingQueue, state.strategicResources, state.inventory, 'night', state.seed);
      expect(shift.strategicResources).toEqual(beforeResources);
      expect(shift.inventory).toEqual(beforeInventory);
      expect(shift.log.join(' ')).toMatch(/No batch reward/);
    }
  });

  it('rejects new operational orders while a vassal is in Torpor and clears an existing order on entering Torpor', () => {
    const state = withVassal();
    state.vampireVassals[0].operationalOrder = { type: 'companion', issuedDay: state.time.day };
    const sleeping = setVassalTorpor(state, state.vampireVassals[0].id, true).state;
    expect(sleeping.vampireVassals[0].operationalOrder).toEqual({ type: 'none', issuedDay: null });
    const refused = issueVassalOperationalOrder(sleeping, sleeping.vampireVassals[0].id, 'raid');
    expect(refused.accepted).toBe(false);
    expect(refused.state).toBe(sleeping);
  });

  it('rejects malformed v12 operational order records', () => {
    const state = withVassal();
    const badType = { ...state, vampireVassals: [{ ...state.vampireVassals[0], operationalOrder: { type: 'conquer-europe', issuedDay: 1 } }] };
    const badNone = { ...state, vampireVassals: [{ ...state.vampireVassals[0], operationalOrder: { type: 'none', issuedDay: 1 } }] };
    expect(validateSaveGame(badType)).toBe(false);
    expect(validateSaveGame(badNone)).toBe(false);
  });
});

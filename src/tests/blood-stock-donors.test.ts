import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { getBloodDonorCapacity, getBloodStockCapacity, storeBloodStock } from '../simulation/blood/bloodStock';
import { bindThrallAsBloodDonor, validateBindThrallAsBloodDonor } from '../simulation/servants/bloodDonors';
import type { BuiltRoom, SaveGame } from '../types/models';

const addBuiltBloodCellar = (state: SaveGame, id = 'room-blood-cellar-test'): SaveGame => {
  const room: BuiltRoom = {
    id,
    roomId: 'blood_cellar',
    x: 1,
    y: 0,
    width: 1,
    height: 1,
    status: 'built',
    progress: 3,
    assignedWorkerIds: [],
  };
  return { ...state, rooms: [...state.rooms, room] };
};

describe('0.6.3d Blood Stock and permanent donors', () => {
  it('derives Blood Stock and donor capacity only from built Blood Cellars', () => {
    const state = createNewGameState({ seed: 'blood-capacity' });
    expect(getBloodStockCapacity(state.rooms)).toBe(0);
    expect(getBloodDonorCapacity(state.rooms)).toBe(0);
    const withCellar = addBuiltBloodCellar(state);
    expect(getBloodStockCapacity(withCellar.rooms)).toBe(20);
    expect(getBloodDonorCapacity(withCellar.rooms)).toBe(2);
  });

  it('refuses donor commitment until a Blood Cellar exists', () => {
    let state = createNewGameState({ seed: 'donor-needs-cellar' });
    state.player.vitae = 10;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    const check = validateBindThrallAsBloodDonor(state, state.humanServants[0]);
    expect(check.ok).toBe(false);
    const result = bindThrallAsBloodDonor(state, state.humanServants[0]!.id);
    expect(result.state).toBe(state);
  });

  it('permanently removes a committed donor from normal Thrall work while preserving identity', () => {
    let state = createNewGameState({ seed: 'donor-commitment' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    state = addBuiltBloodCellar(state);
    const originalSkills = { ...state.humanServants[0]!.professionSkills };
    const result = bindThrallAsBloodDonor(state, humanId);
    expect(result.state.humanServants).toHaveLength(0);
    expect(result.state.bloodDonors).toHaveLength(1);
    const donor = result.state.bloodDonors[0]!;
    expect(donor.id).toBe(humanId);
    expect(donor.kind).toBe('blood_donor');
    expect(donor.professionSkills).toEqual(originalSkills);
    expect('priorities' in donor).toBe(false);
    expect('currentJob' in donor).toBe(false);
    expect(donor.boundRoomInstanceId).toBe('room-blood-cellar-test');
    expect(result.state.npcs.find((human) => human.id === humanId)?.status).toBe('donor');
  });

  it('stores only already-produced blood and respects physical cellar capacity', () => {
    const state = addBuiltBloodCellar(createNewGameState({ seed: 'stock-cap' }));
    const first = storeBloodStock(state, 25);
    expect(first.stored).toBe(20);
    expect(first.overflow).toBe(5);
    expect(first.state.bloodStock.amount).toBe(20);
    const second = storeBloodStock(first.state, 3);
    expect(second.stored).toBe(0);
    expect(second.overflow).toBe(3);
    expect(second.state).toBe(first.state);
  });
});

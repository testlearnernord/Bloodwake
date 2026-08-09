import { ROOMS_BY_ID } from '../../data/rooms';
import type { BloodDonor, BuiltRoom, SaveGame } from '../../types/models';

const builtBloodCellars = (rooms: BuiltRoom[]): BuiltRoom[] =>
  rooms.filter((room) => room.roomId === 'blood_cellar' && room.status === 'built');

export const getBloodStockCapacity = (rooms: BuiltRoom[]): number =>
  builtBloodCellars(rooms).reduce((sum, room) => sum + (ROOMS_BY_ID[room.roomId].bloodStorageCapacity ?? 0), 0);

export const getBloodDonorCapacity = (rooms: BuiltRoom[]): number =>
  builtBloodCellars(rooms).reduce((sum, room) => sum + (ROOMS_BY_ID[room.roomId].donorSlots ?? 0), 0);

export const getBloodDonorOccupancy = (donors: BloodDonor[], roomInstanceId: string): number =>
  donors.filter((donor) => donor.boundRoomInstanceId === roomInstanceId && donor.donorStatus === 'bound').length;

export const getAvailableBloodCellar = (rooms: BuiltRoom[], donors: BloodDonor[]): BuiltRoom | null =>
  builtBloodCellars(rooms)
    .sort((left, right) => left.id.localeCompare(right.id))
    .find((room) => getBloodDonorOccupancy(donors, room.id) < (ROOMS_BY_ID[room.roomId].donorSlots ?? 0))
  ?? null;

/**
 * Stores already-produced Blood Stock without inventing a production source.
 * 0.6.3d deliberately has no gameplay caller that creates Blood Stock. Continuous donor tasks will call this later.
 */
export const storeBloodStock = (
  state: SaveGame,
  requestedAmount: number,
): { state: SaveGame; stored: number; overflow: number } => {
  const amount = Math.max(0, Math.floor(requestedAmount));
  if (amount === 0) return { state, stored: 0, overflow: 0 };
  const capacity = getBloodStockCapacity(state.rooms);
  const freeCapacity = Math.max(0, capacity - state.bloodStock.amount);
  const stored = Math.min(amount, freeCapacity);
  const overflow = amount - stored;
  if (stored === 0) return { state, stored, overflow };
  return {
    state: { ...state, bloodStock: { amount: state.bloodStock.amount + stored } },
    stored,
    overflow,
  };
};

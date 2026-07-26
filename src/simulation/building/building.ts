import { GRID_HEIGHT, GRID_WIDTH } from '../../config/game';
import { ROOMS_BY_ID } from '../../data/rooms';
import type { BuiltRoom, ResourcePool, RoomId } from '../../types/models';

const hasResources = (resources: ResourcePool, cost: ResourcePool): boolean =>
  Object.entries(cost).every(([resourceId, amount]) => (resources[resourceId] ?? 0) >= amount);

export const canPlaceRoom = (rooms: BuiltRoom[], roomId: RoomId, x: number, y: number): boolean => {
  const room = ROOMS_BY_ID[roomId];
  if (!room) {
    return false;
  }
  if (x < 0 || y < 0 || x + room.footprint.width > GRID_WIDTH || y + room.footprint.height > GRID_HEIGHT) {
    return false;
  }
  return !rooms.some((placedRoom) =>
    x < placedRoom.x + placedRoom.width &&
    x + room.footprint.width > placedRoom.x &&
    y < placedRoom.y + placedRoom.height &&
    y + room.footprint.height > placedRoom.y,
  );
};

export const queueRoomConstruction = (
  rooms: BuiltRoom[],
  resources: ResourcePool,
  roomId: RoomId,
  x: number,
  y: number,
): { updatedRooms: BuiltRoom[]; updatedResources: ResourcePool } => {
  const room = ROOMS_BY_ID[roomId];
  if (!canPlaceRoom(rooms, roomId, x, y)) {
    throw new Error('Invalid room placement.');
  }
  if (!hasResources(resources, room.constructionCost)) {
    throw new Error('Insufficient resources for room construction.');
  }
  const updatedResources = { ...resources };
  for (const [resourceId, amount] of Object.entries(room.constructionCost)) {
    updatedResources[resourceId] -= amount;
  }
  const builtRoom: BuiltRoom = {
    id: `room-${roomId}-${x}-${y}`,
    roomId,
    x,
    y,
    width: room.footprint.width,
    height: room.footprint.height,
    status: room.constructionTime === 0 ? 'built' : 'under_construction',
    progress: 0,
    assignedWorkerIds: [],
  };
  return { updatedRooms: [...rooms, builtRoom], updatedResources };
};

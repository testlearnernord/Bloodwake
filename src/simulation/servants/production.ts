import { RECIPES_BY_ID } from '../../data/recipes';
import type { BuiltRoom, CraftingOrder, DayPhase, DomainResourcePool, InventoryEntry, VampireVassal } from '../../types/models';
import { completeCraftingOrder } from '../crafting/crafting';
import { addItem, mergeCompatibleStacks } from '../inventory/inventory';
import { selectTaskForVassal } from './tasks';

export interface WorkShiftResult {
  vampireVassals: VampireVassal[];
  rooms: BuiltRoom[];
  strategicResources: DomainResourcePool;
  inventory: InventoryEntry[];
  craftingQueue: CraftingOrder[];
  log: string[];
}

export const runWorkShift = (
  vassals: VampireVassal[],
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  strategicResources: DomainResourcePool,
  inventory: InventoryEntry[],
  phase: DayPhase,
  seed: string,
): WorkShiftResult => {
  let updatedRooms = [...rooms];
  let updatedInventory = [...inventory];
  let updatedQueue = [...craftingQueue];
  const updatedStrategicResources = { ...strategicResources };
  const updatedVassals: VampireVassal[] = [];
  const log: string[] = [];
  for (const vassal of vassals) {
    const task = selectTaskForVassal(vassal, updatedRooms, updatedQueue, updatedInventory, phase);
    const updatedVassal = {
      ...vassal,
      currentJob: task && task.score >= 0 ? task.jobType : null,
      currentTask: task && task.score >= 0 ? task.id : null,
      taskReason: task?.reason ?? 'Idle.',
    };
    if (!task || task.score < 0) {
      updatedVassals.push(updatedVassal);
      continue;
    }
    const workTask = task;
    if (workTask.type === 'construct_room') {
      updatedRooms = updatedRooms.map((room) =>
        room.id === workTask.id
          ? {
              ...room,
              progress: room.progress + 1,
              status: room.progress + 1 >= 3 ? 'built' : room.status,
              assignedWorkerIds: room.assignedWorkerIds.includes(vassal.id) ? room.assignedWorkerIds : [...room.assignedWorkerIds, vassal.id],
            }
          : room,
      );
      log.push(`${vassal.name} advances construction in the stronghold.`);
    } else if (workTask.type === 'craft_recipe') {
      const order = updatedQueue.find((entry) => entry.id === workTask.id);
      if (order) {
        const recipe = RECIPES_BY_ID[order.recipeId];
        const completed = completeCraftingOrder(updatedInventory, order, updatedVassal, `${seed}-${order.id}`);
        updatedInventory = completed.inventory;
        updatedQueue = updatedQueue.map((entry) => (entry.id === order.id ? completed.order : entry));
        log.push(`${vassal.name} crafts ${recipe.name}.`);
      }
    } else if (workTask.type === 'gather_resource') {
      const itemId = workTask.itemId ?? 'wood';
      updatedInventory = addItem(updatedInventory, itemId, 3);
      log.push(`${vassal.name} gathers ${itemId === 'wood' ? 'Wood' : 'Herbs'}.`);
    } else {
      updatedStrategicResources.security += 1;
      log.push(`${vassal.name} stands guard.`);
    }
    updatedVassals.push(updatedVassal);
  }
  return {
    vampireVassals: updatedVassals,
    rooms: updatedRooms,
    strategicResources: updatedStrategicResources,
    inventory: mergeCompatibleStacks(updatedInventory),
    craftingQueue: updatedQueue,
    log,
  };
};

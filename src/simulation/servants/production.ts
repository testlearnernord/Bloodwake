import { RECIPES_BY_ID } from '../../data/recipes';
import { SERVANT_EVENTS } from '../../data/servantEvents';
import type { BuiltRoom, CraftingOrder, DayPhase, DomainResourcePool, InventoryEntry, Servant } from '../../types/models';
import { completeCraftingOrder } from '../crafting/crafting';
import { addItem, mergeCompatibleStacks } from '../inventory/inventory';
import { selectTaskForServant } from './tasks';

export interface WorkShiftResult {
  servants: Servant[];
  rooms: BuiltRoom[];
  strategicResources: DomainResourcePool;
  inventory: InventoryEntry[];
  craftingQueue: CraftingOrder[];
  log: string[];
}

export const runWorkShift = (
  servants: Servant[],
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
  const updatedServants: Servant[] = [];
  const log: string[] = [];
  for (const servant of servants) {
    const task = selectTaskForServant(servant, updatedRooms, updatedQueue, updatedInventory, phase);
    const updatedServant = { ...servant, currentJob: task?.jobType ?? null, currentTask: task?.id ?? null, taskReason: task?.reason ?? 'Idle.' };
    if (!task || task.score < 0) {
      updatedServants.push(updatedServant);
      continue;
    }
    if (task.type === 'construct_room') {
      updatedRooms = updatedRooms.map((room) =>
        room.id === task.id
          ? {
              ...room,
              progress: room.progress + 1,
              status: room.progress + 1 >= 3 ? 'built' : room.status,
              assignedWorkerIds: room.assignedWorkerIds.includes(servant.id) ? room.assignedWorkerIds : [...room.assignedWorkerIds, servant.id],
            }
          : room,
      );
      log.push(`${servant.name} advances construction in the stronghold.`);
    } else if (task.type === 'craft_recipe') {
      const order = updatedQueue.find((entry) => entry.id === task.id);
      if (order) {
        const recipe = RECIPES_BY_ID[order.recipeId];
        const completed = completeCraftingOrder(updatedInventory, order, updatedServant, `${seed}-${order.id}`);
        updatedInventory = completed.inventory;
        updatedQueue = updatedQueue.map((entry) => (entry.id === order.id ? completed.order : entry));
        log.push(`${servant.name} crafts ${recipe.name}.`);
      }
    } else if (task.type === 'gather_resource') {
      const itemId = task.id === 'gather-herbs' ? 'herbs' : 'wood';
      updatedInventory = addItem(updatedInventory, itemId, 3);
      if (itemId === 'wood') {
        updatedInventory = addItem(updatedInventory, 'food', 1);
      }
      log.push(`${servant.name} gathers ${itemId === 'wood' ? 'Wood' : 'Herbs'}.`);
    } else {
      updatedStrategicResources.security += 1;
      log.push(`${servant.name} stands guard.`);
    }
    const triggeredEvent = SERVANT_EVENTS.find((event) => {
      if (event.condition === 'low_morale') {
        return updatedServant.morale < 40;
      }
      if (event.condition === 'ambitious_vampire') {
        return updatedServant.type === 'vampire' && updatedServant.ambition > 70 && task.type === 'guard_stronghold';
      }
      return updatedServant.loyalty > 70;
    });
    if (triggeredEvent) {
      updatedServant.morale += triggeredEvent.effect.morale ?? 0;
      updatedServant.loyalty += triggeredEvent.effect.loyalty ?? 0;
      log.push(`${triggeredEvent.title}: ${triggeredEvent.description}`);
    }
    updatedServants.push(updatedServant);
  }
  return {
    servants: updatedServants,
    rooms: updatedRooms,
    strategicResources: updatedStrategicResources,
    inventory: mergeCompatibleStacks(updatedInventory),
    craftingQueue: updatedQueue,
    log,
  };
};

import { HUMAN_WORK_BALANCING, JOB_PRIORITY_WEIGHT } from '../../config/balancing';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS_BY_ID } from '../../data/rooms';
import type { BuiltRoom, CraftingOrder, HumanServant, InventoryEntry, SaveGame } from '../../types/models';
import { canCraftRecipe, completeCraftingOrder } from '../crafting/crafting';
import { addItem, mergeCompatibleStacks } from '../inventory/inventory';
import { getTraitById } from '../traits/traitUtils';

export type HumanWorkJobType = 'Building' | 'Crafting' | 'Gathering' | 'Hunting';

export const HUMAN_WORK_JOB_TYPES: readonly HumanWorkJobType[] = ['Building', 'Crafting', 'Gathering', 'Hunting'];
export const HUMAN_THRALL_WOUNDED_HEALTH_THRESHOLD = 3;

export interface HumanWorkTask {
  id: string;
  type: 'construct_room' | 'craft_recipe' | 'gather_resource' | 'hunt_food';
  jobType: HumanWorkJobType;
  score: number;
  reason: string;
  itemId?: 'wood' | 'herbs';
}

export interface HumanWorkDayResult {
  humanServants: HumanServant[];
  rooms: BuiltRoom[];
  craftingQueue: CraftingOrder[];
  inventory: InventoryEntry[];
  events: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const round2 = (value: number): number => Math.round(value * 100) / 100;

const traitBonusFor = (servant: HumanServant, jobType: HumanWorkJobType): number => {
  const tags = jobType === 'Building'
    ? ['builder']
    : jobType === 'Crafting'
      ? ['crafting', 'smithing']
      : jobType === 'Gathering'
        ? ['gathering', 'foraging']
        : ['hunting', 'hunter'];
  return servant.traitIds.reduce((score, traitId) => {
    const trait = getTraitById(traitId);
    return score + (tags.some((tag) => trait.tags.includes(tag)) ? 1 : 0);
  }, 0);
};

export const getHumanWorkEfficiency = (servant: HumanServant, jobType: HumanWorkJobType): number => {
  const professionBonus = PROFESSIONS_BY_ID[servant.professionId].jobBonuses[jobType] ?? 0;
  const skill = servant.professionSkills[jobType] ?? 0;
  const traitBonus = traitBonusFor(servant, jobType);
  const aptitude =
    HUMAN_WORK_BALANCING.baseWork
    + professionBonus * HUMAN_WORK_BALANCING.professionBonusScale
    + skill * HUMAN_WORK_BALANCING.skillBonusScale
    + traitBonus * HUMAN_WORK_BALANCING.traitBonusScale;
  const controlMultiplier =
    HUMAN_WORK_BALANCING.controlFloor
    + (1 - HUMAN_WORK_BALANCING.controlFloor) * clamp(servant.control / 100, 0, 1);
  const stressMultiplier =
    1 - HUMAN_WORK_BALANCING.maxStressPenalty * clamp(servant.stress / 100, 0, 1);
  return round2(clamp(aptitude * controlMultiplier * stressMultiplier, HUMAN_WORK_BALANCING.minimumEfficiency, HUMAN_WORK_BALANCING.maximumEfficiency));
};

const canCraftOrder = (servant: HumanServant, order: CraftingOrder, rooms: BuiltRoom[], inventory: InventoryEntry[]): boolean => {
  const recipe = RECIPES_BY_ID[order.recipeId];
  if (!recipe || order.status !== 'queued') return false;
  if (recipe.requiredProfessionId && recipe.requiredProfessionId !== servant.professionId) return false;
  if (!rooms.some((room) => room.roomId === recipe.requiredRoomId && room.status === 'built')) return false;
  return canCraftRecipe(inventory, order.recipeId);
};

export const selectTaskForHumanThrall = (
  servant: HumanServant,
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  inventory: InventoryEntry[],
): HumanWorkTask | null => {
  if (servant.health <= HUMAN_THRALL_WOUNDED_HEALTH_THRESHOLD) {
    return null;
  }

  const profession = PROFESSIONS_BY_ID[servant.professionId];
  const candidates: HumanWorkTask[] = [];
  const scoreFor = (jobType: HumanWorkJobType): number =>
    JOB_PRIORITY_WEIGHT[servant.priorities[jobType]]
    + (profession.jobBonuses[jobType] ?? 0)
    + traitBonusFor(servant, jobType);

  const unfinishedRoom = rooms.find((room) => room.status === 'under_construction');
  if (unfinishedRoom && servant.priorities.Building !== 'Disabled') {
    candidates.push({
      id: unfinishedRoom.id,
      type: 'construct_room',
      jobType: 'Building',
      score: scoreFor('Building'),
      reason: 'Construction is waiting for mortal labor.',
    });
  }

  const queuedOrder = craftingQueue.find((order) => canCraftOrder(servant, order, rooms, inventory));
  if (queuedOrder && servant.priorities.Crafting !== 'Disabled') {
    candidates.push({
      id: queuedOrder.id,
      type: 'craft_recipe',
      jobType: 'Crafting',
      score: scoreFor('Crafting'),
      reason: 'A compatible workshop order is ready.',
    });
  }

  if (servant.priorities.Gathering !== 'Disabled') {
    const itemId: 'wood' | 'herbs' =
      servant.professionId === 'herbalist' || inventory.filter((entry) => entry.itemId === 'herbs').reduce((sum, entry) => sum + entry.quantity, 0) < 3
        ? 'herbs'
        : 'wood';
    candidates.push({
      id: `gather-${itemId}`,
      type: 'gather_resource',
      jobType: 'Gathering',
      score: scoreFor('Gathering'),
      reason: itemId === 'herbs' ? 'Herbs can be gathered for remedies.' : 'Timber can be gathered for construction.',
      itemId,
    });
  }

  if (servant.priorities.Hunting !== 'Disabled') {
    candidates.push({
      id: 'hunt-food',
      type: 'hunt_food',
      jobType: 'Hunting',
      score: scoreFor('Hunting'),
      reason: 'Hunting can replenish Food and sometimes Leather.',
    });
  }

  const best = candidates.sort((left, right) => right.score - left.score)[0] ?? null;
  return best && best.score > 0 ? best : null;
};

export const runHumanWorkDay = (
  state: Pick<SaveGame, 'humanServants' | 'rooms' | 'craftingQueue' | 'inventory'>,
  seed: string,
  day: number,
): HumanWorkDayResult => {
  let rooms = state.rooms.map((room) => ({ ...room, assignedWorkerIds: [...room.assignedWorkerIds] }));
  let craftingQueue = state.craftingQueue.map((order) => ({ ...order }));
  let inventory = state.inventory.map((entry) => ({ ...entry }));
  const humanServants: HumanServant[] = [];
  const events: string[] = [];

  for (const servant of state.humanServants) {
    const task = selectTaskForHumanThrall(servant, rooms, craftingQueue, inventory);
    if (!task) {
      humanServants.push({
        ...servant,
        currentJob: null,
        currentTask: null,
        taskReason: servant.health <= HUMAN_THRALL_WOUNDED_HEALTH_THRESHOLD ? 'Too wounded for daytime labor.' : 'No enabled daytime work is available.',
      });
      continue;
    }

    const efficiency = getHumanWorkEfficiency(servant, task.jobType);
    const updatedServant: HumanServant = {
      ...servant,
      currentJob: task.jobType,
      currentTask: task.id,
      taskReason: `${task.reason} Efficiency ${efficiency.toFixed(2)}.`,
    };

    if (task.type === 'construct_room') {
      rooms = rooms.map((room) => {
        if (room.id !== task.id) return room;
        const requiredWork = Math.max(1, ROOMS_BY_ID[room.roomId].constructionTime);
        const progress = round2(Math.min(requiredWork, room.progress + efficiency));
        return {
          ...room,
          progress,
          status: progress >= requiredWork ? 'built' : room.status,
          assignedWorkerIds: room.assignedWorkerIds.includes(servant.id) ? room.assignedWorkerIds : [...room.assignedWorkerIds, servant.id],
        };
      });
      const room = rooms.find((entry) => entry.id === task.id);
      events.push(`${servant.name} works construction (${efficiency.toFixed(2)} work${room?.status === 'built' ? '; room completed' : ''}).`);
    } else if (task.type === 'craft_recipe') {
      const order = craftingQueue.find((entry) => entry.id === task.id);
      if (order) {
        const recipe = RECIPES_BY_ID[order.recipeId];
        const progress = round2(Math.min(recipe.workAmount, order.progress + efficiency));
        if (progress >= recipe.workAmount) {
          const completed = completeCraftingOrder(
            inventory,
            { ...order, progress, assignedServantId: servant.id },
            updatedServant,
            `${seed}-human-${day}-${order.id}`,
          );
          inventory = completed.inventory;
          craftingQueue = craftingQueue.map((entry) => entry.id === order.id ? completed.order : entry);
          events.push(`${servant.name} completes ${recipe.name}.`);
        } else {
          craftingQueue = craftingQueue.map((entry) =>
            entry.id === order.id ? { ...entry, progress, assignedServantId: servant.id } : entry,
          );
          events.push(`${servant.name} advances ${recipe.name} to ${progress}/${recipe.workAmount} work.`);
        }
      }
    } else if (task.type === 'gather_resource') {
      const itemId = task.itemId ?? 'wood';
      const amount = Math.max(1, Math.floor(efficiency * HUMAN_WORK_BALANCING.gatherYieldScale));
      inventory = addItem(inventory, itemId, amount);
      events.push(`${servant.name} gathers ${amount} ${itemId === 'wood' ? 'Wood' : 'Herbs'}.`);
    } else if (task.type === 'hunt_food') {
      const food = Math.max(1, Math.floor(efficiency * HUMAN_WORK_BALANCING.huntingFoodYieldScale));
      const leather = efficiency >= HUMAN_WORK_BALANCING.leatherEfficiencyThreshold ? 1 : 0;
      inventory = addItem(inventory, 'food', food);
      if (leather > 0) inventory = addItem(inventory, 'leather', leather);
      events.push(`${servant.name} returns from the hunt with ${food} Food${leather > 0 ? ' and 1 Leather' : ''}.`);
    }

    humanServants.push(updatedServant);
  }

  return {
    humanServants,
    rooms,
    craftingQueue,
    inventory: mergeCompatibleStacks(inventory),
    events,
  };
};

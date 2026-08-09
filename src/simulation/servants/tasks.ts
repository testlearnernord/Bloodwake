import { JOB_PRIORITY_WEIGHT, WORK_PHASES } from '../../config/balancing';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { RECIPES_BY_ID } from '../../data/recipes';
import type { BuiltRoom, CraftingOrder, DayPhase, InventoryEntry, JobType, TaskCandidate, VampireVassal } from '../../types/models';
import { getItemQuantity } from '../inventory/inventory';
import { getTraitById } from '../traits/traitUtils';

export const canVassalWorkInPhase = (_vassal: VampireVassal, phase: DayPhase): boolean =>
  WORK_PHASES['vampire'].includes(phase);

export const createTaskCandidates = (
  vassal: VampireVassal,
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  inventory: InventoryEntry[],
): TaskCandidate[] => {
  const profession = PROFESSIONS_BY_ID[vassal.professionId];
  const professionBonuses = profession.jobBonuses;
  const traitBonusFor = (jobType: JobType): number => {
    const tag = jobType === 'Building' ? 'builder' : jobType.toLowerCase();
    return vassal.traitIds.reduce((score, traitId) => {
      const trait = getTraitById(traitId);
      return score + (trait.tags.includes(tag) ? 1 : 0);
    }, 0);
  };
  const tasks: TaskCandidate[] = [];
  const unfinishedRoom = rooms.find((room) => room.status === 'under_construction');
  if (unfinishedRoom) {
    const jobType: JobType = 'Building';
    const priority = JOB_PRIORITY_WEIGHT[vassal.priorities[jobType]];
    tasks.push({
      id: unfinishedRoom.id,
      type: 'construct_room',
      jobType,
      score: priority + (professionBonuses[jobType] ?? 0) + traitBonusFor(jobType),
      reason: priority === 0 ? 'Building is disabled.' : 'Construction is waiting for workers.',
    });
  }
  const queuedOrder = craftingQueue.find((order) => {
    if (order.status !== 'queued') return false;
    const recipe = RECIPES_BY_ID[order.recipeId];
    return (!recipe.requiredProfessionId || recipe.requiredProfessionId === vassal.professionId)
      && rooms.some((room) => room.roomId === recipe.requiredRoomId && room.status === 'built');
  });
  if (queuedOrder) {
    const jobType: JobType = 'Crafting';
    const priority = JOB_PRIORITY_WEIGHT[vassal.priorities[jobType]];
    tasks.push({
      id: queuedOrder.id,
      type: 'craft_recipe',
      jobType,
      score: priority + (professionBonuses[jobType] ?? 0) + traitBonusFor(jobType),
      reason: priority === 0 ? 'Crafting is disabled.' : 'A queued recipe is ready.',
    });
  }
  const jobType: JobType = 'Gathering';
  const priority = JOB_PRIORITY_WEIGHT[vassal.priorities[jobType]];
  const lowWood = getItemQuantity(inventory, 'wood') < 8;
  if (lowWood || getItemQuantity(inventory, 'herbs') < 3) {
    tasks.push({
      id: lowWood ? 'gather-wood' : 'gather-herbs',
      type: 'gather_resource',
      jobType,
      score: priority + (professionBonuses[jobType] ?? 0) + traitBonusFor(jobType),
      reason: lowWood ? 'Wood stores are low.' : 'Herbs are needed for remedies.',
    });
  }
  tasks.push({
    id: 'guard-post',
    type: 'guard_stronghold',
    jobType: 'Guarding',
    score: JOB_PRIORITY_WEIGHT[vassal.priorities.Guarding] + (professionBonuses.Guarding ?? 0) + traitBonusFor('Guarding'),
    reason: 'No urgent work; standing watch keeps the keep safe.',
  });
  return tasks;
};

export const selectTaskForVassal = (
  vassal: VampireVassal,
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  inventory: InventoryEntry[],
  phase: DayPhase,
): TaskCandidate | null => {
  if (!canVassalWorkInPhase(vassal, phase)) {
    return {
      id: 'rest',
      type: 'guard_stronghold',
      jobType: 'Guarding',
      score: -1,
      reason: `Vampire vassals cannot work during ${phase}.`,
    };
  }
  if (vassal.health <= 3) {
    return { id: 'recover', type: 'guard_stronghold', jobType: 'Guarding', score: -1, reason: 'Too wounded to work.' };
  }
  const candidates = createTaskCandidates(vassal, rooms, craftingQueue, inventory).sort((left, right) => right.score - left.score);
  const best = candidates[0] ?? null;
  if (!best || best.score <= 0) {
    return { id: 'idle', type: 'guard_stronghold', jobType: 'Guarding', score: 0, reason: 'No enabled tasks are available.' };
  }
  return best;
};

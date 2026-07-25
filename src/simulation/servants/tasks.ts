import { JOB_PRIORITY_WEIGHT, WORK_PHASES } from '../../config/balancing';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { RECIPES_BY_ID } from '../../data/recipes';
import type { BuiltRoom, CraftingOrder, DayPhase, JobType, ResourcePool, Servant, TaskCandidate } from '../../types/models';
import { getTraitById } from '../traits/traitUtils';

export const canServantWorkInPhase = (servant: Servant, phase: DayPhase): boolean => {
  const role = servant.type === 'human' ? 'human' : 'vampire';
  return WORK_PHASES[role].includes(phase);
};

export const createTaskCandidates = (
  servant: Servant,
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  resources: ResourcePool,
): TaskCandidate[] => {
  const profession = PROFESSIONS_BY_ID[servant.professionId];
  const professionBonuses = profession.jobBonuses;
  const traitBonusFor = (jobType: JobType): number =>
    servant.traitIds.reduce((score, traitId) => {
      const trait = getTraitById(traitId);
      return score + (trait.tags.includes(jobType.toLowerCase()) ? 1 : 0);
    }, 0);
  const tasks: TaskCandidate[] = [];
  const unfinishedRoom = rooms.find((room) => room.status === 'under_construction');
  if (unfinishedRoom) {
    const jobType: JobType = 'Building';
    const priority = JOB_PRIORITY_WEIGHT[servant.priorities[jobType]];
    tasks.push({
      id: unfinishedRoom.id,
      type: 'construct_room',
      jobType,
      score: priority + (professionBonuses[jobType] ?? 0) + traitBonusFor(jobType),
      reason: priority === 0 ? 'Building is disabled.' : 'Construction is waiting for workers.',
    });
  }
  const queuedOrder = craftingQueue.find((order) => order.status === 'queued');
  if (queuedOrder && rooms.some((room) => room.roomId === RECIPES_BY_ID[queuedOrder.recipeId].requiredRoomId && room.status === 'built')) {
    const jobType: JobType = 'Crafting';
    const priority = JOB_PRIORITY_WEIGHT[servant.priorities[jobType]];
    tasks.push({
      id: queuedOrder.id,
      type: 'craft_recipe',
      jobType,
      score: priority + (professionBonuses[jobType] ?? 0) + traitBonusFor(jobType),
      reason: priority === 0 ? 'Crafting is disabled.' : 'A queued recipe is ready.',
    });
  }
  const jobType: JobType = 'Gathering';
  const priority = JOB_PRIORITY_WEIGHT[servant.priorities[jobType]];
  const lowWood = (resources.Wood ?? 0) < 8;
  if (lowWood || (resources.Herbs ?? 0) < 3) {
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
    score: JOB_PRIORITY_WEIGHT[servant.priorities.Guarding] + (professionBonuses.Guarding ?? 0) + traitBonusFor('Guarding'),
    reason: 'No urgent work; standing watch keeps the keep safe.',
  });
  return tasks;
};

export const selectTaskForServant = (
  servant: Servant,
  rooms: BuiltRoom[],
  craftingQueue: CraftingOrder[],
  resources: ResourcePool,
  phase: DayPhase,
): TaskCandidate | null => {
  if (!canServantWorkInPhase(servant, phase)) {
    return {
      id: 'rest',
      type: 'guard_stronghold',
      jobType: 'Guarding',
      score: -1,
      reason: `${servant.type === 'human' ? 'Human servants' : 'Vampire servants'} cannot work during ${phase}.`,
    };
  }
  if (servant.health <= 3) {
    return { id: 'recover', type: 'guard_stronghold', jobType: 'Guarding', score: -1, reason: 'Too wounded to work.' };
  }
  const candidates = createTaskCandidates(servant, rooms, craftingQueue, resources).sort((left, right) => right.score - left.score);
  const best = candidates[0] ?? null;
  if (!best || best.score <= 0) {
    return { id: 'idle', type: 'guard_stronghold', jobType: 'Guarding', score: 0, reason: 'No enabled tasks are available.' };
  }
  return best;
};

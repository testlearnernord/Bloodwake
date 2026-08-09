import type { BuiltRoom, DayPhase, HumanServant, JobType, SaveGame, VampireVassal } from '../../types/models';
import { RECIPES_BY_ID } from '../../data/recipes';
import { selectTaskForHumanThrall, type HumanWorkTask } from '../servants/humanWork';
import { selectTaskForVassal } from '../servants/tasks';
import { getDomainPopulationAnchor, type DomainPopulationAnchor, type DomainPopulationKind } from './domainPresence';

export type DomainActorMotionPhase = 'idle' | 'moving_to_task' | 'working' | 'returning';

export interface DomainActorTaskPlan {
  actorId: string;
  kind: DomainPopulationKind;
  active: boolean;
  jobType: JobType | null;
  taskId: string | null;
  taskKey: string | null;
  activityLabel: string;
  home: DomainPopulationAnchor;
  destination: DomainPopulationAnchor;
}

export interface DomainActorMotionRuntime {
  phase: DomainActorMotionPhase;
  taskKey: string | null;
}

export interface DomainActorMotionStep {
  runtime: DomainActorMotionRuntime;
  position: DomainPopulationAnchor;
}

const ACTOR_SPEED = 64;
const ARRIVAL_DISTANCE = 4;
export const STRONGHOLD_GRID_ORIGIN = { x: 22, y: 90 } as const;
export const STRONGHOLD_CELL_W = 66;
export const STRONGHOLD_CELL_H = 76;
const WOOD_GATHER_DESTINATION = { x: 430, y: 340 } as const;
const HERB_GATHER_DESTINATION = { x: 740, y: 250 } as const;
const HUNT_DESTINATION = { x: 700, y: 540 } as const;
const GUARD_POST_X = 292;
const GUARD_POST_Y = 296;
const GUARD_POST_ROWS = 4;
const GUARD_POST_ROW_SPACING = 36;
const GUARD_POST_COLUMN_SPACING = 28;

export const getGuardPostDestination = (actorIndex: number): DomainPopulationAnchor => {
  const index = Math.max(0, actorIndex);
  return {
    x: GUARD_POST_X - Math.floor(index / GUARD_POST_ROWS) * GUARD_POST_COLUMN_SPACING,
    y: GUARD_POST_Y + (index % GUARD_POST_ROWS) * GUARD_POST_ROW_SPACING,
  };
};

export const getStrongholdRoomCenter = (room: Pick<BuiltRoom, 'x' | 'y' | 'width' | 'height'>): DomainPopulationAnchor => ({
  x: STRONGHOLD_GRID_ORIGIN.x + room.x * STRONGHOLD_CELL_W + (room.width * STRONGHOLD_CELL_W) / 2,
  y: STRONGHOLD_GRID_ORIGIN.y + room.y * STRONGHOLD_CELL_H + (room.height * STRONGHOLD_CELL_H) / 2,
});

interface ActorTaskLike {
  id: string;
  type: 'construct_room' | 'craft_recipe' | 'gather_resource' | 'hunt_food' | 'guard_stronghold';
  jobType: JobType;
  itemId?: 'wood' | 'herbs';
}

export const getDomainActorTaskEnvironmentKey = (state: Pick<SaveGame, 'time' | 'rooms' | 'craftingQueue' | 'inventory'>): string => [
  state.time.phase,
  state.rooms.map((room) => `${room.id}:${room.roomId}:${room.x}:${room.y}:${room.width}:${room.height}:${room.status}`).join(','),
  state.craftingQueue.map((order) => `${order.id}:${order.recipeId}:${order.status}`).join(','),
  state.inventory.map((entry) => `${entry.itemId}:${entry.quantity}`).join(','),
].join('|');

const getPriorityKey = (priorities: HumanServant['priorities'] | VampireVassal['priorities']): string =>
  [priorities.Building, priorities.Crafting, priorities.Gathering, priorities.Guarding, priorities.Research, priorities.Hunting].join(',');

export const getHumanThrallActorTaskPlanCacheKey = (
  environmentKey: string,
  thrall: HumanServant,
  index: number,
): string => [
  environmentKey,
  thrall.id,
  index,
  thrall.health,
  thrall.professionId,
  getPriorityKey(thrall.priorities),
  thrall.traitIds.join(','),
].join('|');

export const getVassalActorTaskPlanCacheKey = (
  environmentKey: string,
  vassal: VampireVassal,
  index: number,
): string => [
  environmentKey,
  vassal.id,
  index,
  vassal.health,
  vassal.professionId,
  getPriorityKey(vassal.priorities),
  vassal.traitIds.join(','),
].join('|');

const resolveTaskDestination = (state: SaveGame, task: ActorTaskLike, home: DomainPopulationAnchor, actorIndex: number): DomainPopulationAnchor => {
  if (task.type === 'construct_room') {
    const room = state.rooms.find((candidate) => candidate.id === task.id);
    return room ? getStrongholdRoomCenter(room) : home;
  }
  if (task.type === 'craft_recipe') {
    const order = state.craftingQueue.find((candidate) => candidate.id === task.id);
    const recipe = order ? RECIPES_BY_ID[order.recipeId] : undefined;
    const room = recipe
      ? state.rooms.find((candidate) => candidate.roomId === recipe.requiredRoomId && candidate.status === 'built')
      : undefined;
    return room ? getStrongholdRoomCenter(room) : home;
  }
  if (task.type === 'gather_resource') {
    const itemId = task.itemId ?? 'wood';
    return itemId === 'herbs' ? HERB_GATHER_DESTINATION : WOOD_GATHER_DESTINATION;
  }
  if (task.type === 'hunt_food') {
    return HUNT_DESTINATION;
  }
  if (task.type === 'guard_stronghold') {
    return getGuardPostDestination(actorIndex);
  }
  return home;
};

const inactivePlan = (
  actorId: string,
  kind: DomainPopulationKind,
  home: DomainPopulationAnchor,
  activityLabel: string,
): DomainActorTaskPlan => ({
  actorId,
  kind,
  active: false,
  jobType: null,
  taskId: null,
  taskKey: null,
  activityLabel,
  home,
  destination: home,
});

export const getHumanThrallActorTaskPlan = (
  state: SaveGame,
  thrall: HumanServant,
  index: number,
): DomainActorTaskPlan => {
  const home = getDomainPopulationAnchor('human_thrall', index);
  if (state.time.phase !== 'day') return inactivePlan(thrall.id, 'human_thrall', home, 'Resting');
  const task: HumanWorkTask | null = selectTaskForHumanThrall(thrall, state.rooms, state.craftingQueue, state.inventory);
  if (!task) return inactivePlan(thrall.id, 'human_thrall', home, 'Idle');
  return {
    actorId: thrall.id,
    kind: 'human_thrall',
    active: true,
    jobType: task.jobType,
    taskId: task.id,
    taskKey: `${task.type}:${task.id}`,
    activityLabel: task.jobType,
    home,
    destination: resolveTaskDestination(state, task, home, index),
  };
};

export const getVassalActorTaskPlan = (
  state: SaveGame,
  vassal: VampireVassal,
  index: number,
): DomainActorTaskPlan => {
  const home = getDomainPopulationAnchor('vampire_vassal', index);
  if (state.time.phase !== 'night') return inactivePlan(vassal.id, 'vampire_vassal', home, 'Sheltered');
  const task = selectTaskForVassal(vassal, state.rooms, state.craftingQueue, state.inventory, state.time.phase);
  if (!task || task.score <= 0) return inactivePlan(vassal.id, 'vampire_vassal', home, 'Idle');
  return {
    actorId: vassal.id,
    kind: 'vampire_vassal',
    active: true,
    jobType: task.jobType,
    taskId: task.id,
    taskKey: `${task.type}:${task.id}`,
    activityLabel: task.jobType,
    home,
    destination: resolveTaskDestination(state, task, home, index),
  };
};

export const createDomainActorMotionRuntime = (): DomainActorMotionRuntime => ({ phase: 'idle', taskKey: null });

const distanceBetween = (left: DomainPopulationAnchor, right: DomainPopulationAnchor): number =>
  Math.hypot(right.x - left.x, right.y - left.y);

const moveTowards = (
  position: DomainPopulationAnchor,
  target: DomainPopulationAnchor,
  maxDistance: number,
): DomainPopulationAnchor => {
  const distance = distanceBetween(position, target);
  if (distance <= maxDistance || distance === 0) return { ...target };
  const ratio = maxDistance / distance;
  return {
    x: position.x + (target.x - position.x) * ratio,
    y: position.y + (target.y - position.y) * ratio,
  };
};

export const stepDomainActorMotion = (
  _runtime: DomainActorMotionRuntime,
  position: DomainPopulationAnchor,
  plan: DomainActorTaskPlan,
  deltaMs: number,
): DomainActorMotionStep => {
  const target = plan.active ? plan.destination : plan.home;
  const distance = distanceBetween(position, target);
  if (distance <= ARRIVAL_DISTANCE) {
    return {
      runtime: {
        phase: plan.active ? 'working' : 'idle',
        taskKey: plan.active ? plan.taskKey : null,
      },
      position: { ...target },
    };
  }

  const phase: DomainActorMotionPhase = plan.active ? 'moving_to_task' : 'returning';
  const nextPosition = moveTowards(position, target, ACTOR_SPEED * Math.max(0, deltaMs) / 1000);
  return {
    runtime: {
      phase,
      taskKey: plan.active ? plan.taskKey : null,
    },
    position: nextPosition,
  };
};

export const getDomainActorMotionLabel = (
  plan: DomainActorTaskPlan,
  runtime: DomainActorMotionRuntime,
): string => {
  const prefix = plan.kind === 'human_thrall' ? 'Thrall' : 'Vassal';
  if (runtime.phase === 'moving_to_task') return `${prefix} · Moving · ${plan.activityLabel}`;
  if (runtime.phase === 'working') return `${prefix} · Working · ${plan.activityLabel}`;
  if (runtime.phase === 'returning') return `${prefix} · Returning`;
  return `${prefix} · ${plan.activityLabel}`;
};

export const isActorWorkPhase = (kind: DomainPopulationKind, phase: DayPhase): boolean =>
  kind === 'human_thrall' ? phase === 'day' : phase === 'night';

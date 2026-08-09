import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { queueCraftingOrder } from '../simulation/crafting/crafting';
import { applyHumanAction } from '../simulation/combat/bite';
import { getHumanWorkEfficiency, runHumanWorkDay, selectTaskForHumanThrall } from '../simulation/servants/humanWork';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';

const enthrallFirst = (seed: string) => {
  let state = createNewGameState({ seed });
  state.player.vitae = 10;
  state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
  return state;
};

describe('0.6.3b human work foundation', () => {
  it('resolves human labor only after the daytime phase has elapsed', () => {
    let state = enthrallFirst('human-day-shift');
    state.humanServants[0]!.priorities = {
      Building: 'Disabled',
      Crafting: 'Disabled',
      Gathering: 'Critical',
      Guarding: 'Disabled',
      Research: 'Disabled',
      Hunting: 'Disabled',
    };
    const gatherBefore =
      (state.inventory.find((entry) => entry.itemId === 'wood')?.quantity ?? 0)
      + (state.inventory.find((entry) => entry.itemId === 'herbs')?.quantity ?? 0);
    const day = advanceWorldPhase(state).state;
    expect(day.time.phase).toBe('day');
    const dayGather =
      (day.inventory.find((entry) => entry.itemId === 'wood')?.quantity ?? 0)
      + (day.inventory.find((entry) => entry.itemId === 'herbs')?.quantity ?? 0);
    expect(dayGather).toBe(gatherBefore);

    const night = advanceWorldPhase(day).state;
    expect(night.time.phase).toBe('night');
    const nightGather =
      (night.inventory.find((entry) => entry.itemId === 'wood')?.quantity ?? 0)
      + (night.inventory.find((entry) => entry.itemId === 'herbs')?.quantity ?? 0);
    expect(nightGather).toBeGreaterThan(gatherBefore);
    expect(night.humanServants[0]?.currentJob).toBe('Gathering');
  });

  it('makes profession, Control, and Stress materially affect work efficiency', () => {
    const state = enthrallFirst('human-efficiency');
    const base = state.humanServants[0]!;
    const strongWorker = {
      ...base,
      professionId: 'woodcutter' as const,
      control: 95,
      stress: 0,
      professionSkills: { Gathering: 2 },
    };
    const weakWorker = {
      ...base,
      professionId: 'monk' as const,
      control: 20,
      stress: 90,
      professionSkills: {},
    };
    expect(getHumanWorkEfficiency(strongWorker, 'Gathering')).toBeGreaterThan(getHumanWorkEfficiency(weakWorker, 'Gathering'));
  });

  it('advances actual room construction with human work', () => {
    const state = enthrallFirst('human-building');
    state.humanServants[0]!.priorities = {
      Building: 'Critical',
      Crafting: 'Disabled',
      Gathering: 'Disabled',
      Guarding: 'Disabled',
      Research: 'Disabled',
      Hunting: 'Disabled',
    };
    state.rooms.push({
      id: 'room-storage-test',
      roomId: 'storage_room',
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      status: 'under_construction',
      progress: 0,
      assignedWorkerIds: [],
    });
    const result = runHumanWorkDay(state, state.seed, 2);
    expect(result.rooms.find((room) => room.id === 'room-storage-test')?.progress).toBeGreaterThan(0);
    expect(result.rooms.find((room) => room.id === 'room-storage-test')?.assignedWorkerIds).toContain(state.humanServants[0]!.id);
  });

  it('uses real crafting work progress and can complete a queued recipe', () => {
    const state = enthrallFirst('human-crafting');
    state.humanServants[0]!.professionId = 'blacksmith';
    state.humanServants[0]!.control = 100;
    state.humanServants[0]!.stress = 0;
    state.humanServants[0]!.priorities = {
      Building: 'Disabled',
      Crafting: 'Critical',
      Gathering: 'Disabled',
      Guarding: 'Disabled',
      Research: 'Disabled',
      Hunting: 'Disabled',
    };
    state.rooms.push({
      id: 'room-workshop-test',
      roomId: 'workshop',
      x: 1,
      y: 0,
      width: 1,
      height: 1,
      status: 'built',
      progress: 3,
      assignedWorkerIds: [],
    });
    state.craftingQueue = queueCraftingOrder(state.craftingQueue, 'wood_planks');

    const first = runHumanWorkDay(state, state.seed, 2);
    const firstOrder = first.craftingQueue[0]!;
    expect(firstOrder.progress).toBeGreaterThan(0);

    const second = runHumanWorkDay({ ...state, humanServants: first.humanServants, rooms: first.rooms, craftingQueue: first.craftingQueue, inventory: first.inventory }, state.seed, 3);
    expect(second.craftingQueue[0]!.status).toBe('complete');
    expect(second.inventory.some((entry) => entry.itemId === 'wood_planks' && entry.quantity > 0)).toBe(true);
  });

  it('lets hunting support the food economy instead of manufacturing a fake strategic stat', () => {
    const state = enthrallFirst('human-hunting');
    const servant = state.humanServants[0]!;
    servant.professionId = 'hunter';
    servant.control = 100;
    servant.stress = 0;
    servant.priorities = {
      Building: 'Disabled',
      Crafting: 'Disabled',
      Gathering: 'Disabled',
      Guarding: 'Disabled',
      Research: 'Disabled',
      Hunting: 'Critical',
    };
    const task = selectTaskForHumanThrall(servant, state.rooms, state.craftingQueue, state.inventory);
    expect(task?.jobType).toBe('Hunting');
    const foodBefore = state.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0;
    const result = runHumanWorkDay(state, state.seed, 2);
    expect(result.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0).toBeGreaterThan(foodBefore);
  });

  it('does not invent Research or Guarding output before those systems exist', () => {
    const state = enthrallFirst('human-no-fake-jobs');
    const servant = state.humanServants[0]!;
    servant.priorities = {
      Building: 'Disabled',
      Crafting: 'Disabled',
      Gathering: 'Disabled',
      Guarding: 'Critical',
      Research: 'Critical',
      Hunting: 'Disabled',
    };
    expect(selectTaskForHumanThrall(servant, state.rooms, state.craftingQueue, state.inventory)).toBeNull();
  });
});

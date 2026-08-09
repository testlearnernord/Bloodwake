import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import {
  createDomainActorMotionRuntime,
  getDomainActorTaskEnvironmentKey,
  getHumanThrallActorTaskPlan,
  getHumanThrallActorTaskPlanCacheKey,
  getStrongholdRoomCenter,
  getVassalActorTaskPlan,
  stepDomainActorMotion,
} from '../simulation/world/domainActorTasks';

describe('0.6.3b3 visible work actor tasks', () => {
  it('projects a Human Thrall daytime task from the same selector used by work resolution', () => {
    let state = createNewGameState({ seed: 'visible-work-thrall' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    const thrall = state.humanServants[0]!;
    thrall.priorities.Building = 'Disabled';
    thrall.priorities.Crafting = 'Disabled';
    thrall.priorities.Gathering = 'Critical';
    thrall.priorities.Hunting = 'Disabled';
    state = advanceWorldPhase(state).state;
    const plan = getHumanThrallActorTaskPlan(state, state.humanServants[0]!, 0);
    expect(state.time.phase).toBe('day');
    expect(plan.active).toBe(true);
    expect(plan.jobType).toBe('Gathering');
    expect(plan.taskKey).toMatch(/^gather_resource:/);
    expect(plan.destination).not.toEqual(plan.home);
  });

  it('keeps Human Thralls off work at night and Vampire Vassals off work during day', () => {
    let state = createNewGameState({ seed: 'visible-work-phases' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    const nightPlan = getHumanThrallActorTaskPlan(state, state.humanServants[0]!, 0);
    expect(nightPlan.active).toBe(false);
    expect(nightPlan.activityLabel).toBe('Resting');

    state = applyHumanAction(state, state.npcs[1]!.id, 'turn').state;
    state = advanceWorldPhase(state).state;
    const dayPlan = getVassalActorTaskPlan(state, state.vampireVassals[0]!, 0);
    expect(dayPlan.active).toBe(false);
    expect(dayPlan.activityLabel).toBe('Sheltered');
  });

  it('moves actors through travel into working instead of teleporting them to the task', () => {
    let state = createNewGameState({ seed: 'visible-work-motion' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    const thrall = state.humanServants[0]!;
    thrall.priorities.Building = 'Disabled';
    thrall.priorities.Crafting = 'Disabled';
    thrall.priorities.Gathering = 'Critical';
    thrall.priorities.Hunting = 'Disabled';
    state = advanceWorldPhase(state).state;
    const plan = getHumanThrallActorTaskPlan(state, state.humanServants[0]!, 0);
    const first = stepDomainActorMotion(createDomainActorMotionRuntime(), plan.home, plan, 100);
    expect(first.runtime.phase).toBe('moving_to_task');
    expect(first.position).not.toEqual(plan.home);
    expect(first.position).not.toEqual(plan.destination);
    const arrived = stepDomainActorMotion(first.runtime, first.position, plan, 20000);
    expect(arrived.position).toEqual(plan.destination);
    const working = stepDomainActorMotion(arrived.runtime, arrived.position, plan, 16);
    expect(working.runtime.phase).toBe('working');
  });

  it('invalidates cached thrall plans when shared task inputs change', () => {
    let state = createNewGameState({ seed: 'visible-work-cache-key' });
    state.player.vitae = 10;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    const thrall = state.humanServants[0]!;
    const before = getHumanThrallActorTaskPlanCacheKey(getDomainActorTaskEnvironmentKey(state), thrall, 0);
    state.inventory = state.inventory.map((entry) => entry.itemId === 'wood' ? { ...entry, quantity: entry.quantity + 1 } : entry);
    const after = getHumanThrallActorTaskPlanCacheKey(getDomainActorTaskEnvironmentKey(state), thrall, 0);
    expect(after).not.toBe(before);
  });


  it('assigns simultaneous guarding vassals to distinct stronghold posts', () => {
    let state = createNewGameState({ seed: 'visible-work-guard-slots' });
    state.player.vitae = 10;
    state = applyHumanAction(state, state.npcs[0]!.id, 'turn').state;
    state = applyHumanAction(state, state.npcs[1]!.id, 'turn').state;
    for (const vassal of state.vampireVassals) {
      vassal.priorities = {
        Building: 'Disabled',
        Crafting: 'Disabled',
        Gathering: 'Disabled',
        Guarding: 'Critical',
        Research: 'Disabled',
        Hunting: 'Disabled',
      };
    }
    const first = getVassalActorTaskPlan(state, state.vampireVassals[0]!, 0);
    const second = getVassalActorTaskPlan(state, state.vampireVassals[1]!, 1);
    expect(first.jobType).toBe('Guarding');
    expect(second.jobType).toBe('Guarding');
    expect(first.destination).not.toEqual(second.destination);
  });

  it('computes stronghold room centers from the shared grid layout', () => {
    expect(getStrongholdRoomCenter({ x: 1, y: 2, width: 2, height: 1 })).toEqual({ x: 154, y: 280 });
  });
});

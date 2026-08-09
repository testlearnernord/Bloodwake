import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import {
  createDomainActorMotionRuntime,
  getHumanThrallActorTaskPlan,
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
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { ENTHRALL_VITAE_COST, THRALL_REASSERT_VITAE_COST, TURN_COST_VITAE } from '../config/balancing';
import { SAVE_FORMAT_VERSION } from '../config/game';
import { ROOMS_BY_ID } from '../data/rooms';
import { validateSaveGame } from '../persistence/saveStore';
import { applyHumanAction, validateHumanAction } from '../simulation/combat/bite';
import {
  getHumanHousingCapacity,
  getThrallControlState,
  reassertThrallControl,
} from '../simulation/servants/humanThralls';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import { isHumanPresentInWorld } from '../simulation/world/humans';

describe('0.6.3a human thralls', () => {
  it('provides two base housing spaces and four per built Servant Quarters', () => {
    const state = createNewGameState({ seed: 'housing' });
    expect(getHumanHousingCapacity(state.rooms)).toBe(2);
    state.rooms.push({
      id: 'quarters-test',
      roomId: 'servant_quarters',
      x: 1, y: 0, width: 1, height: 1, status: 'built', progress: 0, assignedWorkerIds: [],
    });
    expect(ROOMS_BY_ID.servant_quarters.housingCapacity).toBe(4);
    expect(getHumanHousingCapacity(state.rooms)).toBe(6);
  });

  it('treats enthralled humans as persistent identities but not visible world actors', () => {
    let state = createNewGameState({ seed: 'thrall-world-visibility' });
    state.player.vitae = 5;
    const human = state.npcs[0]!;
    expect(isHumanPresentInWorld(human)).toBe(true);
    state = applyHumanAction(state, human.id, 'enthrall').state;
    const storedHuman = state.npcs.find((npc) => npc.id === human.id)!;
    expect(storedHuman.status).toBe('enthralled');
    expect(isHumanPresentInWorld(storedHuman)).toBe(false);
  });

  it('reports the exact Vitae requirement when Turn is disabled', () => {
    const state = createNewGameState({ seed: 'turn-cost-feedback' });
    state.player.vitae = TURN_COST_VITAE - 1;
    expect(validateHumanAction(state, state.npcs[0], 'turn')).toEqual({
      ok: false,
      reason: `Turning requires ${TURN_COST_VITAE} Vitae.`,
    });
  });

  it('enthralls a free human into a controlled prisoner and spends Vitae', () => {
    const state = createNewGameState({ seed: 'enthrall' });
    state.player.vitae = 5;
    const human = state.npcs[0]!;
    const result = applyHumanAction(state, human.id, 'enthrall').state;
    expect(result.player.vitae).toBe(5 - ENTHRALL_VITAE_COST);
    expect(result.humanServants).toHaveLength(1);
    const thrall = result.humanServants[0]!;
    expect(thrall.id).toBe(human.id);
    expect(thrall.control).toBeGreaterThanOrEqual(35);
    expect(thrall.control).toBeLessThanOrEqual(95);
    expect(thrall.resistance).toBe(human.resolve);
    expect(thrall.bloodResonance).toBe(human.bloodResonance);
    expect(Object.prototype.hasOwnProperty.call(thrall, 'loyalty')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(thrall, 'ambition')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(thrall, 'morale')).toBe(false);
    expect(result.npcs.find((npc) => npc.id === human.id)?.status).toBe('enthralled');
  });

  it('blocks enthrallment when human housing is full', () => {
    let state = createNewGameState({ seed: 'housing-full' });
    state.player.vitae = 10;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    state = applyHumanAction(state, state.npcs[1]!.id, 'enthrall').state;
    const third = state.npcs.find((npc) => npc.status === 'wandering')!;
    const check = validateHumanAction(state, third, 'enthrall');
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(/housing is full/i);
  });

  it('maps control to readable captivity states', () => {
    expect(getThrallControlState(90)).toBe('Dominated');
    expect(getThrallControlState(70)).toBe('Subdued');
    expect(getThrallControlState(50)).toBe('Unstable');
    expect(getThrallControlState(30)).toBe('Defiant');
    expect(getThrallControlState(10)).toBe('Breaking');
  });

  it('lets the player spend Vitae at night to reassert control', () => {
    let state = createNewGameState({ seed: 'reassert' });
    state.player.vitae = 5;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    state.humanServants[0]!.control = 30;
    const beforeVitae = state.player.vitae;
    const result = reassertThrallControl(state, state.humanServants[0]!.id);
    expect(result.state.player.vitae).toBe(beforeVitae - THRALL_REASSERT_VITAE_COST);
    expect(result.state.humanServants[0]!.control).toBeGreaterThan(30);
  });

  it('consumes Food and decays Control after a full day', () => {
    let state = createNewGameState({ seed: 'daily-thrall' });
    state.player.vitae = 5;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    const controlBefore = state.humanServants[0]!.control;
    const foodBefore = state.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0;
    const day = advanceWorldPhase(state).state;
    const night = advanceWorldPhase(day).state;
    expect(night.humanServants[0]!.control).toBeLessThan(controlBefore);
    expect(night.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0).toBe(foodBefore - 1);
  });

  it('keeps enthralled NPC identities in state while captivity continues', () => {
    let state = createNewGameState({ seed: 'enthralled-identity' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    const night = advanceWorldPhase(advanceWorldPhase(state).state).state;
    expect(night.humanServants).toHaveLength(1);
    expect(night.npcs.find((npc) => npc.id === humanId)?.status).toBe('enthralled');
  });

  it('makes food shortages accelerate Control loss and Stress', () => {
    let fed = createNewGameState({ seed: 'fed-thrall' });
    fed.player.vitae = 5;
    fed = applyHumanAction(fed, fed.npcs[0]!.id, 'enthrall').state;
    let starved = createNewGameState({ seed: 'fed-thrall' });
    starved.player.vitae = 5;
    starved = applyHumanAction(starved, starved.npcs[0]!.id, 'enthrall').state;
    starved.inventory = starved.inventory.filter((entry) => entry.itemId !== 'food');
    const fedNight = advanceWorldPhase(advanceWorldPhase(fed).state).state;
    const starvedNight = advanceWorldPhase(advanceWorldPhase(starved).state).state;
    expect(starvedNight.humanServants[0]!.control).toBeLessThan(fedNight.humanServants[0]!.control);
    expect(starvedNight.humanServants[0]!.stress).toBeGreaterThan(fedNight.humanServants[0]!.stress);
  });

  it('returns a thrall to the free-human world when Control breaks', () => {
    let state = createNewGameState({ seed: 'escape' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    state.humanServants[0]!.control = 1;
    state.humanServants[0]!.fear = 42;
    state.humanServants[0]!.disposition = -10;
    const night = advanceWorldPhase(advanceWorldPhase(state).state).state;
    expect(night.humanServants).toHaveLength(0);
    const escapedHuman = night.npcs.find((npc) => npc.id === humanId);
    expect(escapedHuman?.status).toBe('wandering');
    expect(escapedHuman?.fear).toBe(57);
    expect(escapedHuman?.disposition).toBe(-30);
    night.player.vitae = 10;
    expect(validateHumanAction(night, escapedHuman, 'feed').ok).toBe(true);
    expect(validateHumanAction(night, escapedHuman, 'drain').ok).toBe(true);
    expect(validateHumanAction(night, escapedHuman, 'enthrall').ok).toBe(true);
    expect(validateHumanAction(night, escapedHuman, 'turn').ok).toBe(true);
  });

  it('uses save v7 and rejects legacy loyalty fields on human thralls', () => {
    let state = createNewGameState({ seed: 'thrall-save' });
    state.player.vitae = 5;
    state = applyHumanAction(state, state.npcs[0]!.id, 'enthrall').state;
    expect(SAVE_FORMAT_VERSION).toBe(7);
    expect(validateSaveGame(state)).toBe(true);
    const stale = { ...state.humanServants[0], loyalty: 100 };
    expect(validateSaveGame({ ...state, humanServants: [stale] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { elevateThrallToVassal } from '../simulation/servants/thrallElevation';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import { getDomainPopulationAnchor, getDomainPopulationIds } from '../simulation/world/domainPresence';

describe('0.6.3b2 domain world presence', () => {
  it('puts enthralled humans into the visible domain roster instead of the free-human roster', () => {
    let state = createNewGameState({ seed: 'domain-presence-thrall' });
    state.player.vitae = 8;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    expect(getDomainPopulationIds(state, 'human_thrall')).toEqual([humanId]);
    expect(getDomainPopulationIds(state, 'vampire_vassal')).toEqual([]);
  });

  it('switches world presence from mortal Thrall to Vampire Vassal on elevation', () => {
    let state = createNewGameState({ seed: 'domain-presence-elevation' });
    state.player.vitae = 10;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    state = elevateThrallToVassal(state, humanId).state;
    expect(getDomainPopulationIds(state, 'human_thrall')).toEqual([]);
    expect(getDomainPopulationIds(state, 'vampire_vassal')).toEqual([`vampire-${humanId}`]);
  });

  it('removes an escaped Thrall from domain presence', () => {
    let state = createNewGameState({ seed: 'domain-presence-escape' });
    state.player.vitae = 8;
    const humanId = state.npcs[0]!.id;
    state = applyHumanAction(state, humanId, 'enthrall').state;
    state.humanServants[0]!.control = 1;
    state = advanceWorldPhase(advanceWorldPhase(state).state).state;
    expect(getDomainPopulationIds(state, 'human_thrall')).toEqual([]);
    expect(state.npcs.find((human) => human.id === humanId)?.status).toBe('wandering');
  });

  it('uses deterministic non-overlapping starter bands inside the Stronghold', () => {
    expect(getDomainPopulationAnchor('human_thrall', 0)).toEqual({ x: 55, y: 455 });
    expect(getDomainPopulationAnchor('human_thrall', 1)).toEqual({ x: 123, y: 455 });
    expect(getDomainPopulationAnchor('vampire_vassal', 0)).toEqual({ x: 65, y: 602 });
    expect(getDomainPopulationAnchor('vampire_vassal', 0)).not.toEqual(getDomainPopulationAnchor('human_thrall', 0));
  });
});

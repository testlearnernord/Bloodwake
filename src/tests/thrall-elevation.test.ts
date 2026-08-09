import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { TURN_COST_VITAE } from '../config/balancing';
import { validateSaveGame } from '../persistence/saveStore';
import { applyHumanAction } from '../simulation/combat/bite';
import { elevateThrallToVassal, validateElevateThrall } from '../simulation/servants/thrallElevation';

describe('0.6.3b1 thrall elevation', () => {
  it('turns an existing Human Thrall into a Vampire Vassal and spends Vitae', () => {
    let state = createNewGameState({ seed: 'elevate-basic' });
    state.player.vitae = 10;
    const human = state.npcs[0]!;
    state = applyHumanAction(state, human.id, 'enthrall').state;
    const beforeVitae = state.player.vitae;

    const result = elevateThrallToVassal(state, human.id);
    expect(result.state.player.vitae).toBe(beforeVitae - TURN_COST_VITAE);
    expect(result.state.humanServants).toHaveLength(0);
    expect(result.state.vampireVassals).toHaveLength(1);
    expect(result.state.npcs.find((npc) => npc.id === human.id)?.status).toBe('turned');
    expect(result.state.vampireVassals[0]?.professionId).toBe(human.professionId);
    expect(validateSaveGame(result.state)).toBe(true);
  });

  it('preserves trained profession skills and equipped items across elevation', () => {
    let state = createNewGameState({ seed: 'elevate-skills' });
    state.player.vitae = 10;
    const human = state.npcs[0]!;
    state = applyHumanAction(state, human.id, 'enthrall').state;
    state.humanServants[0]!.professionSkills = { Building: 3, Crafting: 7, Hunting: 2 };
    state.humanServants[0]!.equipped = { Weapon: 'simple_sword' };

    const elevated = elevateThrallToVassal(state, human.id).state.vampireVassals[0]!;
    expect(elevated.professionSkills).toEqual({ Building: 3, Crafting: 7, Hunting: 2 });
    expect(elevated.equipped).toEqual({ Weapon: 'simple_sword' });
  });

  it('uses the Thrall current stress and identity rather than a stale free-human snapshot', () => {
    let state = createNewGameState({ seed: 'elevate-state' });
    state.player.vitae = 10;
    const human = state.npcs[0]!;
    state = applyHumanAction(state, human.id, 'enthrall').state;
    state.humanServants[0]!.stress = 73;
    state.humanServants[0]!.fear = 81;
    state.humanServants[0]!.disposition = -44;

    const result = elevateThrallToVassal(state, human.id).state;
    expect(result.vampireVassals[0]?.stress).toBe(73);
    const storedHuman = result.npcs.find((npc) => npc.id === human.id)!;
    expect(storedHuman.fear).toBe(81);
    expect(storedHuman.disposition).toBe(-44);
  });

  it('blocks elevation without enough Vitae or when the captive identity is invalid', () => {
    let state = createNewGameState({ seed: 'elevate-validation' });
    state.player.vitae = 10;
    const human = state.npcs[0]!;
    state = applyHumanAction(state, human.id, 'enthrall').state;
    state.player.vitae = TURN_COST_VITAE - 1;
    expect(validateElevateThrall(state, state.humanServants[0])).toEqual({
      ok: false,
      reason: `Elevation requires ${TURN_COST_VITAE} Vitae.`,
    });
    state.player.vitae = 10;
    state.npcs = state.npcs.map((npc) => npc.id === human.id ? { ...npc, status: 'wandering' } : npc);
    expect(validateElevateThrall(state, state.humanServants[0])?.ok).toBe(false);
  });
});

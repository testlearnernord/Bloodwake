import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { runWorkShift } from '../simulation/servants/production';
import { createVampireVassal } from '../simulation/servants/vampireVassals';
import { getVassalPoliticalProfile, resolveVassalPoliticalEvent, resolveVassalPolitics } from '../simulation/servants/vassalPolitics';

const makeVassal = () => {
  const state = createNewGameState({ seed: 'politics-fixture' });
  return createVampireVassal({ ...state.player, id: 'vassal-politics', name: 'Alda' });
};

describe('0.6.4c Vampire Vassal politics', () => {
  it('derives stronger obedience from loyalty/morale and weaker obedience from ambition/stress', () => {
    const base = makeVassal();
    const devoted = getVassalPoliticalProfile({ ...base, loyalty: 90, morale: 80, ambition: 20, stress: 5 });
    const defiant = getVassalPoliticalProfile({ ...base, loyalty: 15, morale: 25, ambition: 95, stress: 90 });
    expect(devoted.stance).toBe('Devoted');
    expect(defiant.stance).toBe('Defiant');
    expect(devoted.obedience).toBeGreaterThan(defiant.obedience);
    expect(devoted.defianceRisk).toBeLessThan(defiant.defianceRisk);
  });

  it('keeps Torpid Vassals outside political-event settlement', () => {
    const torpid = { ...makeVassal(), state: 'torpor' as const, torporSinceDay: 2, loyalty: 10, ambition: 100, stress: 100 };
    const result = resolveVassalPoliticalEvent(torpid, 'politics', 5, 4);
    expect(result.record).toBeNull();
    expect(result.vassal).toBe(torpid);
  });

  it('resolves political events deterministically for the same world seed/day', () => {
    const vassal = { ...makeVassal(), loyalty: 30, morale: 30, ambition: 90, stress: 80 };
    const first = resolveVassalPolitics([vassal], 'same-seed', 8, 3);
    const second = resolveVassalPolitics([vassal], 'same-seed', 8, 3);
    expect(second).toEqual(first);
  });

  it('eventually produces political friction for a highly defiant active vassal', () => {
    const vassal = { ...makeVassal(), loyalty: 20, morale: 25, ambition: 95, stress: 85 };
    const triggered = Array.from({ length: 40 }, (_, index) => resolveVassalPoliticalEvent(vassal, 'friction', index + 1, 3))
      .find((result) => result.record !== null);
    expect(triggered?.record).not.toBeNull();
    expect(triggered?.vassal.loyalty).toBeGreaterThanOrEqual(0);
    expect(triggered?.vassal.stress).toBeLessThanOrEqual(100);
  });

  it('no longer mutates loyalty through the legacy work-shift event table', () => {
    const state = createNewGameState({ seed: 'work-politics' });
    const vassal = makeVassal();
    vassal.ambition = 100;
    vassal.loyalty = 55;
    vassal.priorities = {
      Building: 'Disabled',
      Crafting: 'Disabled',
      Gathering: 'Disabled',
      Guarding: 'Critical',
      Research: 'Disabled',
      Hunting: 'Disabled',
    };
    const result = runWorkShift([vassal], state.rooms, state.craftingQueue, state.strategicResources, state.inventory, 'night', state.seed);
    expect(result.vampireVassals[0].loyalty).toBe(55);
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { PLAYER_VITAE_UPKEEP_PER_DAWN } from '../config/balancing';
import { SAVE_FORMAT_VERSION } from '../config/game';
import { migrateSaveGame, validateSaveGame } from '../persistence/saveStore';
import { getVitaeCondition, getVitaeConditionEffects, getVitaeRatio } from '../simulation/blood/vitaeCondition';
import { applyHumanAction } from '../simulation/combat/bite';
import { calculatePlayerCombatStats } from '../simulation/combat/stats';
import { runWorkShift } from '../simulation/servants/production';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';

describe('unified vampire Vitae model', () => {
  it('does not persist ordinary hunger on the player or a turned vassal', () => {
    const state = createNewGameState({ seed: 'no-hunger' });
    expect(Object.prototype.hasOwnProperty.call(state.player, 'hunger')).toBe(false);
    state.player.vitae = 5;
    const turned = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn').state;
    expect(turned.vampireVassals).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(turned.vampireVassals[0], 'hunger')).toBe(false);
  });

  it.each([
    [10, 10, 'Sated'],
    [5, 10, 'Sated'],
    [4, 10, 'Thirsty'],
    [1, 4, 'Thirsty'],
    [1, 5, 'Starved'],
    [0, 10, 'Bloodless'],
    [-2, 10, 'Bloodless'],
    [5, 0, 'Bloodless'],
  ] as const)('maps Vitae %s/%s to %s', (vitae, maxVitae, condition) => {
    expect(getVitaeCondition(vitae, maxVitae)).toBe(condition);
  });

  it('handles invalid max Vitae defensively', () => {
    expect(getVitaeRatio(5, 0)).toBe(0);
    expect(getVitaeRatio(5, Number.NaN)).toBe(0);
  });

  it('uses the exact authoritative condition multipliers', () => {
    expect(getVitaeConditionEffects(10, 10)).toEqual({ attackMultiplier: 1, movementMultiplier: 1 });
    expect(getVitaeConditionEffects(4, 10)).toEqual({ attackMultiplier: 0.9, movementMultiplier: 0.95 });
    expect(getVitaeConditionEffects(2, 10)).toEqual({ attackMultiplier: 0.75, movementMultiplier: 0.85 });
    expect(getVitaeConditionEffects(0, 10)).toEqual({ attackMultiplier: 0.6, movementMultiplier: 0.75 });
  });

  it('reduces combat damage deterministically and never below one', () => {
    const sated = createNewGameState({ seed: 'combat-sated' });
    sated.player.vitae = sated.player.maxVitae;
    const baseDamage = calculatePlayerCombatStats(sated.player).attackDamage;
    const bloodless = { ...sated.player, vitae: 0 };
    const bloodlessDamage = calculatePlayerCombatStats(bloodless).attackDamage;
    expect(bloodlessDamage).toBe(Math.max(1, Math.round(baseDamage * 0.6)));
    expect(bloodlessDamage).toBeGreaterThanOrEqual(1);
  });

  it('consumes exactly one player Vitae at dawn and none at dusk', () => {
    const state = createNewGameState({ seed: 'dawn-upkeep' });
    const before = state.player.vitae;
    const { state: day } = advanceWorldPhase(state);
    expect(day.player.vitae).toBe(Math.max(0, before - PLAYER_VITAE_UPKEEP_PER_DAWN));
    const { state: night } = advanceWorldPhase(day);
    expect(night.player.vitae).toBe(day.player.vitae);
  });

  it('clamps dawn upkeep at zero without direct health damage', () => {
    const state = createNewGameState({ seed: 'bloodless-dawn' });
    state.player.vitae = 0;
    const health = state.player.health;
    const { state: day } = advanceWorldPhase(state);
    expect(day.player.vitae).toBe(0);
    expect(day.player.health).toBe(health);
  });

  it('keeps current Feed/Drain Vitae behavior while removing ordinary hunger', () => {
    const feedState = createNewGameState({ seed: 'feed-regression' });
    feedState.player.vitae = 1;
    const fed = applyHumanAction(feedState, feedState.npcs[0]?.id ?? '', 'feed').state;
    expect(fed.player.vitae).toBeGreaterThan(feedState.player.vitae);
    expect(Object.prototype.hasOwnProperty.call(fed.player, 'hunger')).toBe(false);

    const drainState = createNewGameState({ seed: 'drain-regression' });
    drainState.player.vitae = 1;
    const drained = applyHumanAction(drainState, drainState.npcs[0]?.id ?? '', 'drain').state;
    expect(drained.player.vitae).toBeGreaterThan(drainState.player.vitae);
    expect(Object.prototype.hasOwnProperty.call(drained.player, 'hunger')).toBe(false);
  });

  it('gathering wood no longer manufactures Food', () => {
    const state = createNewGameState({ seed: 'wood-is-not-food' });
    state.player.vitae = 5;
    const turned = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn').state;
    const vassal = turned.vampireVassals[0]!;
    vassal.priorities = { ...vassal.priorities, Building: 'Disabled', Crafting: 'Disabled', Gathering: 'Critical' };
    const foodBefore = turned.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0;
    const shift = runWorkShift([vassal], [], [], turned.strategicResources, turned.inventory, 'night', turned.seed);
    const foodAfter = shift.inventory.find((entry) => entry.itemId === 'food')?.quantity ?? 0;
    expect(foodAfter).toBe(foodBefore);
  });

  it('uses save v8 and still rejects older or stale hunger fields', () => {
    const state = createNewGameState({ seed: 'save-v8' });
    expect(SAVE_FORMAT_VERSION).toBe(8);
    expect(migrateSaveGame(state).version).toBe(8);
    expect(() => migrateSaveGame({ ...state, version: 6 })).toThrow(/older game version/i);
    expect(validateSaveGame({ ...state, player: { ...state.player, hunger: 1 } })).toBe(false);

    state.player.vitae = 5;
    const withVassal = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn').state;
    const staleVassal = { ...withVassal.vampireVassals[0], hunger: 1 };
    expect(validateSaveGame({ ...withVassal, vampireVassals: [staleVassal] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import {
  calculateBloodChoiceOutcome,
  getBloodChoicePreview,
  getDrainBloodEssenceGain,
  getDrainVitaeGain,
  getFeedBaseVitaeGain,
} from '../simulation/blood/bloodChoices';
import { applyHumanAction, validateHumanAction } from '../simulation/combat/bite';
import { isHumanPresentInWorld } from '../simulation/world/humans';
import { resolveNightlyHumanPopulation } from '../simulation/world/nightlyWorld';
import type { BloodResonance } from '../types/models';

const resonances: BloodResonance[] = [1, 2, 3, 4, 5];

describe('Milestone 0.6.2b Blood Choices', () => {
  it.each([
    [1, 2], [2, 2], [3, 3], [4, 3], [5, 4],
  ] as const)('Feed base Vitae for resonance %i is %i', (resonance, expected) => {
    expect(getFeedBaseVitaeGain(resonance)).toBe(expected);
  });

  it.each([
    [1, 3], [2, 4], [3, 5], [4, 6], [5, 7],
  ] as const)('Drain Vitae for resonance %i is %i', (resonance, expected) => {
    expect(getDrainVitaeGain(resonance)).toBe(expected);
  });

  it.each([
    [1, 1], [2, 1], [3, 1], [4, 2], [5, 2],
  ] as const)('Drain Blood Essence for resonance %i is %i', (resonance, expected) => {
    expect(getDrainBloodEssenceGain(resonance)).toBe(expected);
  });

  it('Blood Hunter adds +1 to Feed only, never Drain', () => {
    const state = createNewGameState({ seed: 'blood-hunter-choice' });
    state.player.vitae = 0;
    state.player.maxVitae = 20;
    state.player.traitIds = ['blood_hunter'];
    const human = { ...state.npcs[0]!, bloodResonance: 3 as const };
    expect(calculateBloodChoiceOutcome(state, human, 'feed').nominalVitaeGain).toBe(4);
    expect(calculateBloodChoiceOutcome(state, human, 'drain').nominalVitaeGain).toBe(5);
  });

  it('execution and preview use the same capped Feed outcome', () => {
    const state = createNewGameState({ seed: 'feed-preview' });
    state.player.maxVitae = 10;
    state.player.vitae = 9;
    state.npcs[0]!.bloodResonance = 5;
    const human = state.npcs[0]!;
    const outcome = calculateBloodChoiceOutcome(state, human, 'feed');
    expect(outcome.actualVitaeGain).toBe(1);
    expect(getBloodChoicePreview(state, human, 'feed')).toContain('+1 Vitae');
    const result = applyHumanAction(state, human.id, 'feed');
    expect(result.state.player.vitae).toBe(10);
    expect(result.message).toContain('1 Vitae');
  });

  it('execution and preview use the same Drain Vitae and Essence outcome', () => {
    const state = createNewGameState({ seed: 'drain-preview' });
    state.player.maxVitae = 20;
    state.player.vitae = 0;
    state.npcs[0]!.bloodResonance = 4;
    const human = state.npcs[0]!;
    const outcome = calculateBloodChoiceOutcome(state, human, 'drain');
    expect(outcome).toMatchObject({ actualVitaeGain: 6, bloodEssenceGain: 2, targetSurvives: false });
    expect(getBloodChoicePreview(state, human, 'drain')).toContain('+6 Vitae');
    expect(getBloodChoicePreview(state, human, 'drain')).toContain('+2 Blood Essence');
    const beforeEssence = state.strategicResources.bloodEssence;
    const result = applyHumanAction(state, human.id, 'drain');
    expect(result.state.player.vitae).toBe(6);
    expect(result.state.strategicResources.bloodEssence).toBe(beforeEssence + 2);
    expect(result.state.npcs.find((npc) => npc.id === human.id)?.status).toBe('drained');
  });

  it('a fed human cannot be fed, drained, or turned again during the same night', () => {
    const state = createNewGameState({ seed: 'spent-human' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]!.id;
    const fed = applyHumanAction(state, humanId, 'feed').state;
    for (const mode of ['feed', 'drain', 'turn'] as const) {
      const check = validateHumanAction(fed, fed.npcs.find((npc) => npc.id === humanId), mode);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.reason).toMatch(/recovering from feeding/i);
      expect(applyHumanAction(fed, humanId, mode).state).toBe(fed);
    }
  });

  it('fed humans recover on the next-night lifecycle and can be used again when active', () => {
    const state = createNewGameState({ seed: 'feed-recovery' });
    const humanId = state.npcs[0]!.id;
    const fed = applyHumanAction(state, humanId, 'feed').state;
    const population = resolveNightlyHumanPopulation(fed.npcs, fed.seed, fed.time.day + 1, 8);
    const recovered = population.npcs.find((human) => human.id === humanId);
    expect(recovered?.status).toBe('wandering');
    expect(recovered && isHumanPresentInWorld(recovered)).toBe(true);
    expect(validateHumanAction({ ...fed, npcs: population.npcs }, recovered, 'feed').ok).toBe(true);
  });

  it('drained humans remain unavailable and are not returned to the active roster', () => {
    const state = createNewGameState({ seed: 'drain-removal' });
    const humanId = state.npcs[0]!.id;
    const drained = applyHumanAction(state, humanId, 'drain').state;
    const population = resolveNightlyHumanPopulation(drained.npcs, drained.seed, drained.time.day + 1, 8);
    const record = population.npcs.find((human) => human.id === humanId);
    expect(record?.status).toBe('drained');
    expect(record && isHumanPresentInWorld(record)).toBe(false);
  });

  it('Turn remains a 3-Vitae action and is otherwise unchanged for wandering humans', () => {
    const state = createNewGameState({ seed: 'turn-regression' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]!.id;
    const turned = applyHumanAction(state, humanId, 'turn');
    expect(turned.state.player.vitae).toBe(2);
    expect(turned.state.vampireVassals).toHaveLength(1);
    expect(turned.state.npcs.find((npc) => npc.id === humanId)?.status).toBe('turned');
  });

  it('all resonance tiers keep Feed nonlethal and Drain lethal', () => {
    for (const resonance of resonances) {
      const state = createNewGameState({ seed: `tier-${resonance}` });
      state.player.vitae = 0;
      state.player.maxVitae = 20;
      state.npcs[0]!.bloodResonance = resonance;
      const human = state.npcs[0]!;
      expect(calculateBloodChoiceOutcome(state, human, 'feed').targetSurvives).toBe(true);
      expect(calculateBloodChoiceOutcome(state, human, 'drain').targetSurvives).toBe(false);
    }
  });
});

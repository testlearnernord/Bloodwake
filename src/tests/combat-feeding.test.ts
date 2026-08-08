import { describe, expect, it } from 'vitest';
import {
  createCombatFeedRuntime,
  getCombatFeedEligibility,
  getCombatFeedFailureDamage,
  getCombatFeedVitaeGain,
  getCombatFeedWindowProgress,
  isCombatFeedInputWindowOpen,
  pressCombatFeedInput,
  stepCombatFeedRuntime,
} from '../simulation/combat/combatFeed';

describe('combat feeding eligibility', () => {
  it('allows normal enemies at or below 35% health', () => {
    expect(getCombatFeedEligibility({ id: 'bandit', health: 7, maxHealth: 20, elite: false, distance: 50, state: 'approach' }).ok).toBe(true);
    expect(getCombatFeedEligibility({ id: 'bandit', health: 8, maxHealth: 20, elite: false, distance: 50, state: 'approach' }).ok).toBe(false);
  });

  it('uses a lower 20% threshold for elites', () => {
    expect(getCombatFeedEligibility({ id: 'elite', health: 4, maxHealth: 20, elite: true, distance: 50, state: 'approach' }).ok).toBe(true);
    expect(getCombatFeedEligibility({ id: 'elite', health: 5, maxHealth: 20, elite: true, distance: 50, state: 'approach' }).ok).toBe(false);
  });

  it('allows staggered enemies even above the health threshold but still requires range', () => {
    expect(getCombatFeedEligibility({ id: 'bandit', health: 18, maxHealth: 20, elite: false, distance: 50, state: 'stagger' }).ok).toBe(true);
    expect(getCombatFeedEligibility({ id: 'bandit', health: 2, maxHealth: 20, elite: false, distance: 200, state: 'stagger' }).ok).toBe(false);
  });
});

describe('combat feeding QTE', () => {
  it('requires two timed inputs and succeeds deterministically', () => {
    let runtime = createCombatFeedRuntime('bandit', false, 0);
    runtime = stepCombatFeedRuntime(runtime, 180);
    expect(runtime.phase).toBe('first_window');
    const first = pressCombatFeedInput(runtime, 200);
    expect(first.accepted).toBe(true);
    expect(first.succeeded).toBe(false);
    const secondAt = first.runtime.windowOpensAt + 10;
    const second = pressCombatFeedInput(first.runtime, secondAt);
    expect(second.succeeded).toBe(true);
    expect(second.runtime.successfulInputs).toBe(2);
  });

  it('fails on an early mash or a missed window', () => {
    const early = pressCombatFeedInput(createCombatFeedRuntime('bandit', false, 0), 40);
    expect(early.failed).toBe(true);
    const timedOut = stepCombatFeedRuntime(createCombatFeedRuntime('bandit', false, 0), 1000);
    expect(timedOut.phase).toBe('failure');
  });

  it('gives elites a shorter timing window', () => {
    const normal = createCombatFeedRuntime('bandit', false, 0);
    const elite = createCombatFeedRuntime('elite', true, 0);
    expect(normal.windowClosesAt - normal.windowOpensAt).toBeGreaterThan(elite.windowClosesAt - elite.windowOpensAt);
    expect(getCombatFeedFailureDamage(true)).toBeGreaterThan(getCombatFeedFailureDamage(false));
  });

  it('exposes deterministic timing-window progress for the visible QTE', () => {
    let runtime = createCombatFeedRuntime('bandit', false, 0);
    expect(isCombatFeedInputWindowOpen(runtime, 100)).toBe(false);
    expect(getCombatFeedWindowProgress(runtime, 100)).toBe(0);
    runtime = stepCombatFeedRuntime(runtime, runtime.windowOpensAt);
    expect(isCombatFeedInputWindowOpen(runtime, runtime.windowOpensAt)).toBe(true);
    expect(getCombatFeedWindowProgress(runtime, runtime.windowOpensAt)).toBe(0);
    const midpoint = runtime.windowOpensAt + (runtime.windowClosesAt - runtime.windowOpensAt) / 2;
    expect(getCombatFeedWindowProgress(runtime, midpoint)).toBeCloseTo(0.5);
    expect(getCombatFeedWindowProgress(runtime, runtime.windowClosesAt)).toBe(1);
  });
});

describe('combat feeding Vitae recovery', () => {
  it('restores up to 2 Vitae and clips at max', () => {
    expect(getCombatFeedVitaeGain(0, 10)).toBe(2);
    expect(getCombatFeedVitaeGain(9, 10)).toBe(1);
    expect(getCombatFeedVitaeGain(10, 10)).toBe(0);
  });
});

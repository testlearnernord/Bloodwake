import { describe, expect, it } from 'vitest';
import {
  createCombatFeedRuntime,
  getCombatFeedEligibility,
  getCombatFeedFailureDamage,
  getCombatFeedMarkerProgress,
  getCombatFeedVitaeGain,
  isCombatFeedTimingHit,
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

const centerOfActiveZone = (runtime: ReturnType<typeof createCombatFeedRuntime>, roundIndex: 0 | 1): number =>
  runtime.windowOpensAt + runtime.roundDurationMs * (runtime.successZoneStarts[roundIndex] + runtime.successZoneSize / 2);

describe('combat feeding circular QTE', () => {
  it('generates deterministic but seed-dependent green sectors in safe parts of the circle', () => {
    const first = createCombatFeedRuntime('bandit', false, 100, 'stable-seed');
    const same = createCombatFeedRuntime('bandit', false, 100, 'stable-seed');
    const other = createCombatFeedRuntime('bandit', false, 100, 'other-seed');
    expect(first.successZoneStarts).toEqual(same.successZoneStarts);
    expect(first.successZoneStarts).not.toEqual(other.successZoneStarts);
    for (const zoneStart of first.successZoneStarts) {
      expect(zoneStart).toBeGreaterThanOrEqual(0.18);
      expect(zoneStart + first.successZoneSize).toBeLessThanOrEqual(0.9);
    }
  });

  it('requires two clean hits inside the random green sectors', () => {
    let runtime = createCombatFeedRuntime('bandit', false, 0, 'two-clean-hits');
    runtime = stepCombatFeedRuntime(runtime, runtime.windowOpensAt);
    expect(runtime.phase).toBe('first_window');
    const firstAt = centerOfActiveZone(runtime, 0);
    expect(isCombatFeedTimingHit(runtime, firstAt)).toBe(true);
    const first = pressCombatFeedInput(runtime, firstAt);
    expect(first.accepted).toBe(true);
    expect(first.succeeded).toBe(false);
    const secondAt = centerOfActiveZone(first.runtime, 1);
    expect(isCombatFeedTimingHit(first.runtime, secondAt)).toBe(true);
    const second = pressCombatFeedInput(first.runtime, secondAt);
    expect(second.succeeded).toBe(true);
    expect(second.runtime.successfulInputs).toBe(2);
  });

  it('makes button mashing fail instead of brute-forcing the skill check', () => {
    const duringPounce = pressCombatFeedInput(createCombatFeedRuntime('bandit', false, 0, 'mash'), 40);
    expect(duringPounce.failed).toBe(true);

    let runtime = createCombatFeedRuntime('bandit', false, 0, 'outside-green');
    runtime = stepCombatFeedRuntime(runtime, runtime.windowOpensAt);
    expect(isCombatFeedTimingHit(runtime, runtime.windowOpensAt)).toBe(false);
    expect(pressCombatFeedInput(runtime, runtime.windowOpensAt).failed).toBe(true);
  });

  it('fails if the marker completes a circle without a hit', () => {
    const runtime = createCombatFeedRuntime('bandit', false, 0, 'timeout');
    const timedOut = stepCombatFeedRuntime(runtime, runtime.windowClosesAt + 1);
    expect(timedOut.phase).toBe('failure');
  });

  it('gives elites a faster marker and a smaller green sector', () => {
    const normal = createCombatFeedRuntime('bandit', false, 0, 'normal');
    const elite = createCombatFeedRuntime('elite', true, 0, 'elite');
    expect(normal.roundDurationMs).toBeGreaterThan(elite.roundDurationMs);
    expect(normal.successZoneSize).toBeGreaterThan(elite.successZoneSize);
    expect(getCombatFeedFailureDamage(true)).toBeGreaterThan(getCombatFeedFailureDamage(false));
  });

  it('exposes marker progress from zero to one for the visible ring', () => {
    let runtime = createCombatFeedRuntime('bandit', false, 0, 'progress');
    expect(getCombatFeedMarkerProgress(runtime, 100)).toBe(0);
    runtime = stepCombatFeedRuntime(runtime, runtime.windowOpensAt);
    expect(getCombatFeedMarkerProgress(runtime, runtime.windowOpensAt)).toBe(0);
    expect(getCombatFeedMarkerProgress(runtime, runtime.windowOpensAt + runtime.roundDurationMs / 2)).toBeCloseTo(0.5);
    expect(getCombatFeedMarkerProgress(runtime, runtime.windowClosesAt)).toBe(1);
  });
});

describe('combat feeding Vitae recovery', () => {
  it('restores up to 2 Vitae and clips at max', () => {
    expect(getCombatFeedVitaeGain(0, 10)).toBe(2);
    expect(getCombatFeedVitaeGain(9, 10)).toBe(1);
    expect(getCombatFeedVitaeGain(10, 10)).toBe(0);
  });
});

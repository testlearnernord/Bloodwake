import { describe, expect, it } from 'vitest';
import { computeFreeMovement, computeLockedMovement } from '../simulation/combat/movement';
import { cycleLockTarget, selectLockTarget, shouldBreakLock } from '../simulation/combat/targeting';
import type { CombatTargetSnapshot } from '../game/combat/combatTypes';

const targets: CombatTargetSnapshot[] = [
  { id: 'bandit-1', type: 'bandit', name: 'Bandit', health: 10, maxHealth: 10, x: 120, y: 0, alive: true, active: true, hostile: true, elite: false, stateLabel: 'Approach' },
  { id: 'bandit-2', type: 'bandit', name: 'Bandit', health: 10, maxHealth: 10, x: 100, y: 50, alive: true, active: true, hostile: true, elite: false, stateLabel: 'Approach' },
  { id: 'knight-1', type: 'elite_knight', name: 'Knight-Errant', health: 20, maxHealth: 20, x: 150, y: 0, alive: true, active: true, hostile: true, elite: true, stateLabel: 'Windup' },
];

describe('combat targeting', () => {
  it('prefers the closest target to the facing direction', () => {
    const selection = selectLockTarget(targets, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(selection?.id).toBe('bandit-1');
  });

  it('breaks ties by distance then stable id order', () => {
    const tieTargets: CombatTargetSnapshot[] = [
      { ...targets[0], id: 'b-target', x: 100, y: 0 },
      { ...targets[0], id: 'a-target', x: 100, y: 0 },
    ];
    const selection = selectLockTarget(tieTargets, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(selection?.id).toBe('a-target');
  });

  it('ignores dead or invalid targets and cycles with wrap-around', () => {
    const invalidTargets = [{ ...targets[0], alive: false }, ...targets.slice(1)];
    expect(selectLockTarget(invalidTargets, { x: 0, y: 0 }, { x: 1, y: 0 })?.id).toBe('knight-1');
    expect(cycleLockTarget(invalidTargets, 'bandit-2', { x: 0, y: 0 }, 1)?.id).toBe('knight-1');
    expect(cycleLockTarget(invalidTargets, 'bandit-2', { x: 0, y: 0 }, -1)?.id).toBe('knight-1');
  });

  it('automatically unlocks invalid or distant targets', () => {
    expect(shouldBreakLock(targets[0], { x: 500, y: 0 })).toBe(true);
    expect(shouldBreakLock(targets[0], { x: 0, y: 0 })).toBe(false);
  });
});

describe('combat movement', () => {
  it('normalizes free movement', () => {
    const result = computeFreeMovement({ up: true, down: false, left: false, right: true }, 10, { x: 1, y: 0 });
    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBeCloseTo(10, 5);
  });

  it('supports radial and tangential locked movement', () => {
    const radial = computeLockedMovement({ up: true, down: false, left: false, right: false }, { x: 0, y: 0 }, { x: 100, y: 0 }, 12);
    expect(radial.velocity.x).toBeGreaterThan(0);
    expect(radial.velocity.y).toBeCloseTo(0, 5);
    const tangential = computeLockedMovement({ up: false, down: false, left: false, right: true }, { x: 0, y: 0 }, { x: 100, y: 0 }, 12);
    expect(tangential.velocity.y).toBeGreaterThan(0);
  });

  it('normalizes diagonal locked movement and avoids NaN when overlapping', () => {
    const diagonal = computeLockedMovement({ up: true, down: false, left: false, right: true }, { x: 0, y: 0 }, { x: 100, y: 0 }, 12);
    expect(Math.hypot(diagonal.velocity.x, diagonal.velocity.y)).toBeCloseTo(12, 5);
    const overlap = computeLockedMovement({ up: true, down: false, left: false, right: false }, { x: 0, y: 0 }, { x: 0, y: 0 }, 12);
    expect(Number.isNaN(overlap.velocity.x)).toBe(false);
    expect(Number.isNaN(overlap.velocity.y)).toBe(false);
    expect(overlap.velocity.x).toBeCloseTo(0, 5);
    expect(overlap.velocity.y).toBeCloseTo(12, 5);
  });

  it('maintains minimum separation when locked movement presses inward', () => {
    const result = computeLockedMovement({ up: true, down: false, left: false, right: false }, { x: 0, y: 0 }, { x: 20, y: 0 }, 12);
    expect(result.minimumSeparation).toBeGreaterThan(0);
    expect(result.velocity.y).not.toBeNaN();
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { BANDIT_WINDUP_MS, BANDIT_ACTIVE_MS, BANDIT_RECOVERY_MS, BANDIT_COOLDOWN_MS, CLERGY_WINDUP_MS } from '../config/balancing';
import { PLAYER_ACTIONS_BY_ID } from '../data/combatActions';
import { createBiteSequence, applyHumanAction, stepBiteSequence, validateHumanAction } from '../simulation/combat/bite';
import { applyEnemyStagger, createEnemyRuntime, stepEnemyCombat } from '../simulation/combat/enemyCombat';
import { createProjectile, stepProjectile } from '../simulation/combat/projectiles';

describe('enemy combat state machine', () => {
  it('does not deal contact damage before windup and enforces recovery', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const first = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    expect(first.enemy.state).toBe('windup');
    expect(first.damageEvents).toHaveLength(0);
    const active = stepEnemyCombat(first.enemy, { x: 30, y: 0 }, 300, 0);
    expect(active.enemy.state).toBe('active_attack');
    expect(active.damageEvents).toHaveLength(1);
    const recovery = stepEnemyCombat(active.enemy, { x: 30, y: 0 }, 500, 0);
    expect(recovery.enemy.state).toBe('recovery');
    const spamCheck = stepEnemyCombat(recovery.enemy, { x: 30, y: 0 }, 700, 0);
    expect(spamCheck.enemy.state).toBe('recovery');
  });

  it('direction-locks elite attacks and allows clergy projectiles to be avoided', () => {
    const elite = createEnemyRuntime('elite-1', 'elite_knight', { x: 0, y: 0 });
    const windup = stepEnemyCombat(elite, { x: 70, y: 0 }, 0, 0);
    expect(windup.enemy.directionLock).toEqual({ x: 1, y: 0 });
    const active = stepEnemyCombat(windup.enemy, { x: 0, y: 70 }, 600, 0);
    expect(active.enemy.facing).toEqual({ x: 1, y: 0 });

    const clergy = createEnemyRuntime('clergy-1', 'clergy_hunter', { x: 0, y: 0 });
    const clergyWindup = stepEnemyCombat(clergy, { x: 200, y: 0 }, 0, 0);
    const clergyRelease = stepEnemyCombat(clergyWindup.enemy, { x: 200, y: 0 }, 500, 0);
    expect(clergyRelease.shouldFireProjectile).toBe(true);
    const projectile = createProjectile('holy_bolt', 'clergy-1', { x: 0, y: 0 }, clergyRelease.enemy.facing, 500, 'player');
    const stepped = stepProjectile(projectile, 700, 200);
    expect(stepped.position.y).toBeCloseTo(0, 5);
  });

  it('cleans telegraphs when interrupted', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const windup = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    const staggered = applyEnemyStagger(windup.enemy, PLAYER_ACTIONS_BY_ID.heavy.stagger, 40);
    expect(staggered.telegraphVisible).toBe(false);
  });
});

describe('enemy combat state machine — windup deadline stability (0.4.3 regression)', () => {
  it('preserves phaseEndsAt across intermediate frames during windup', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    // Enter windup at t=0
    const entry = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    expect(entry.enemy.state).toBe('windup');
    const originalDeadline = entry.enemy.phaseEndsAt;
    expect(originalDeadline).toBe(BANDIT_WINDUP_MS);

    // Multiple intermediate frames must not change phaseEndsAt
    const frame1 = stepEnemyCombat(entry.enemy, { x: 30, y: 0 }, 16, 0);
    expect(frame1.enemy.state).toBe('windup');
    expect(frame1.enemy.phaseEndsAt).toBe(originalDeadline);

    const frame2 = stepEnemyCombat(frame1.enemy, { x: 30, y: 0 }, 100, 0);
    expect(frame2.enemy.state).toBe('windup');
    expect(frame2.enemy.phaseEndsAt).toBe(originalDeadline);

    const frameBeforeEnd = stepEnemyCombat(frame2.enemy, { x: 30, y: 0 }, originalDeadline - 1, 0);
    expect(frameBeforeEnd.enemy.state).toBe('windup');
    expect(frameBeforeEnd.enemy.phaseEndsAt).toBe(originalDeadline);
  });

  it('transitions windup → active_attack exactly at the deadline', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const entry = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    // One step before deadline: still windup
    const before = stepEnemyCombat(entry.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS - 1, 0);
    expect(before.enemy.state).toBe('windup');
    // At deadline: transitions to active_attack
    const atDeadline = stepEnemyCombat(entry.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS, 0);
    expect(atDeadline.enemy.state).toBe('active_attack');
  });

  it('emits melee damage exactly once per attack cycle', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const windup = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    // Transition to active_attack
    const active = stepEnemyCombat(windup.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS, 0);
    expect(active.enemy.state).toBe('active_attack');
    expect(active.damageEvents).toHaveLength(1);
    // Repeated steps during active window emit no additional damage
    const stillActive = stepEnemyCombat(active.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS + 1, 0);
    expect(stillActive.damageEvents).toHaveLength(0);
    expect(stillActive.enemy.state).toBe('active_attack');
  });

  it('projectile fires exactly once per clergy attack', () => {
    const clergy = createEnemyRuntime('clergy-1', 'clergy_hunter', { x: 0, y: 0 });
    const windup = stepEnemyCombat(clergy, { x: 200, y: 0 }, 0, 0);
    expect(windup.enemy.state).toBe('windup');
    // Fire exactly at deadline
    const release = stepEnemyCombat(windup.enemy, { x: 200, y: 0 }, CLERGY_WINDUP_MS, 0);
    expect(release.shouldFireProjectile).toBe(true);
    expect(release.enemy.state).toBe('active_attack');
    // Repeated steps during active window do not re-fire
    const stillActive = stepEnemyCombat(release.enemy, { x: 200, y: 0 }, CLERGY_WINDUP_MS + 1, 0);
    expect(stillActive.shouldFireProjectile).toBe(false);
    expect(stillActive.enemy.state).toBe('active_attack');
  });

  it('active_attack advances to recovery and recovery advances to approach', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const windup = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    const active = stepEnemyCombat(windup.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS, 0);
    expect(active.enemy.state).toBe('active_attack');
    const recovery = stepEnemyCombat(active.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS + BANDIT_ACTIVE_MS, 0);
    expect(recovery.enemy.state).toBe('recovery');
    const approach = stepEnemyCombat(recovery.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS + BANDIT_ACTIVE_MS + BANDIT_RECOVERY_MS, 0);
    expect(approach.enemy.state).toBe('approach');
  });

  it('tracking windup updates facing but never changes phaseEndsAt', () => {
    // bandit has trackingDuringWindup: true
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const entry = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    const deadline = entry.enemy.phaseEndsAt;
    // Player moves; facing should update
    const tracked = stepEnemyCombat(entry.enemy, { x: 0, y: 30 }, 50, 0);
    expect(tracked.enemy.state).toBe('windup');
    expect(tracked.enemy.phaseEndsAt).toBe(deadline);
    expect(tracked.enemy.facing.y).toBeGreaterThan(0);
  });

  it('locked windup preserves directionLock and phaseEndsAt', () => {
    // elite_knight has trackingDuringWindup: false and directionLockMs > 0
    const elite = createEnemyRuntime('elite-1', 'elite_knight', { x: 0, y: 0 });
    const entry = stepEnemyCombat(elite, { x: 70, y: 0 }, 0, 0);
    expect(entry.enemy.directionLock).toEqual({ x: 1, y: 0 });
    const deadline = entry.enemy.phaseEndsAt;
    // Player moves; directionLock and phaseEndsAt must be unchanged
    const locked = stepEnemyCombat(entry.enemy, { x: 0, y: 70 }, 50, 0);
    expect(locked.enemy.state).toBe('windup');
    expect(locked.enemy.phaseEndsAt).toBe(deadline);
    expect(locked.enemy.directionLock).toEqual({ x: 1, y: 0 });
    expect(locked.enemy.facing).toEqual({ x: 1, y: 0 });
  });

  it('frozen simulation time causes no state progress (pause-compatible)', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const entry = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    expect(entry.enemy.state).toBe('windup');
    // Stepping repeatedly with the same timestamp produces no phase change
    const r1 = stepEnemyCombat(entry.enemy, { x: 30, y: 0 }, 0, 0);
    const r2 = stepEnemyCombat(r1.enemy, { x: 30, y: 0 }, 0, 0);
    expect(r1.enemy.state).toBe('windup');
    expect(r2.enemy.state).toBe('windup');
    expect(r1.enemy.phaseEndsAt).toBe(entry.enemy.phaseEndsAt);
    expect(r2.enemy.phaseEndsAt).toBe(entry.enemy.phaseEndsAt);
  });

  it('frame-rate independence: 16 ms increments reach same final state as a single large step', () => {
    const player = { x: 30, y: 0 };
    // Single large step from 0 to BANDIT_WINDUP_MS
    const enemyA = createEnemyRuntime('bandit-a', 'bandit', { x: 0, y: 0 });
    const entryA = stepEnemyCombat(enemyA, player, 0, 0);
    const finalA = stepEnemyCombat(entryA.enemy, player, BANDIT_WINDUP_MS, 0);

    // Many 16 ms increments
    const enemyB = createEnemyRuntime('bandit-b', 'bandit', { x: 0, y: 0 });
    let state = stepEnemyCombat(enemyB, player, 0, 0);
    for (let t = 16; t < BANDIT_WINDUP_MS; t += 16) {
      state = stepEnemyCombat(state.enemy, player, t, 0);
    }
    const finalB = stepEnemyCombat(state.enemy, player, BANDIT_WINDUP_MS, 0);

    expect(finalA.enemy.state).toBe('active_attack');
    expect(finalB.enemy.state).toBe('active_attack');
    expect(finalA.damageEvents).toHaveLength(1);
    expect(finalB.damageEvents).toHaveLength(1);
  });

  it('dead enemies do not attack', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const dead = { ...enemy, health: 0 };
    const result = stepEnemyCombat(dead, { x: 30, y: 0 }, BANDIT_WINDUP_MS, 0);
    expect(result.enemy.state).toBe('dead');
    expect(result.damageEvents).toHaveLength(0);
    expect(result.shouldFireProjectile).toBe(false);
  });

  it('second attack cycle can begin after cooldown completes', () => {
    const enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    const windup1 = stepEnemyCombat(enemy, { x: 30, y: 0 }, 0, 0);
    const active1 = stepEnemyCombat(windup1.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS, 0);
    const recovery1 = stepEnemyCombat(active1.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS + BANDIT_ACTIVE_MS, 0);
    const approach = stepEnemyCombat(recovery1.enemy, { x: 30, y: 0 }, BANDIT_WINDUP_MS + BANDIT_ACTIVE_MS + BANDIT_RECOVERY_MS, 0);
    expect(approach.enemy.state).toBe('approach');
    // After cooldown expires, enemy can begin a new windup
    const afterCooldown = BANDIT_WINDUP_MS + BANDIT_ACTIVE_MS + BANDIT_RECOVERY_MS + BANDIT_COOLDOWN_MS;
    const windup2 = stepEnemyCombat(approach.enemy, { x: 30, y: 0 }, afterCooldown, 0);
    expect(windup2.enemy.state).toBe('windup');
    expect(windup2.enemy.phaseEndsAt).toBe(afterCooldown + BANDIT_WINDUP_MS);
  });
});

describe('bite pipeline', () => {
  it('does not commit early and commits exactly once', () => {
    const sequence = createBiteSequence('human-1', 'feed', 0);
    const early = stepBiteSequence(sequence, 100);
    expect(early.shouldCommit).toBe(false);
    const commit = stepBiteSequence(early.runtime, 500);
    expect(commit.shouldCommit).toBe(true);
    const again = stepBiteSequence(commit.runtime, 520);
    expect(again.shouldCommit).toBe(false);
  });

  it('rejects invalid requests, creates exactly one servant on turn, and updates vitae correctly', () => {
    const state = createNewGameState({ seed: 'bite' });
    const invalid = validateHumanAction(state, undefined, 'feed');
    expect(invalid.ok).toBe(false);

    const feedResult = applyHumanAction(state, state.npcs[0]?.id ?? '', 'feed');
    expect(feedResult.state.player.vitae).toBeGreaterThanOrEqual(state.player.vitae);

    const turnState = createNewGameState({ seed: 'turn' });
    turnState.player.vitae = 5;
    const turned = applyHumanAction(turnState, turnState.npcs[0]?.id ?? '', 'turn');
    expect(turned.state.servants).toHaveLength(1);
    expect(turned.state.player.vitae).toBe(2);
    expect(turned.state.inheritanceHistory).toHaveLength(1);
    expect(turned.state.npcs[0]?.status).toBe('turned');
    expect(turned.state.servants[0]?.taskReason).toContain('awaiting direction');
  });

  it('reports blocked turn attempts without mutating state', () => {
    const state = createNewGameState({ seed: 'blocked-turn' });
    state.player.vitae = 2;
    const blocked = validateHumanAction(state, state.npcs[0], 'turn');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toContain('Vitae');
    }
    const result = applyHumanAction(state, state.npcs[0]?.id ?? '', 'turn');
    expect(result.state).toBe(state);
    expect(result.message).toContain('Vitae');
    expect(state.servants).toHaveLength(0);
  });
});

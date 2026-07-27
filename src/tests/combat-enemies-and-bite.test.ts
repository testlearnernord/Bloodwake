import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
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
  });
});

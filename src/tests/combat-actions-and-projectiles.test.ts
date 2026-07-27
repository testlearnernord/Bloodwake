import { describe, expect, it } from 'vitest';
import { PLAYER_ACTIONS_BY_ID } from '../data/combatActions';
import { createInitialPlayerActionRuntime, isActionStateActive, isInvulnerable, registerActionHit, startAction, stepAction } from '../simulation/combat/actionState';
import { createProjectile, registerProjectileImpact, resolveProjectileDirection, stepProjectile } from '../simulation/combat/projectiles';

describe('player combat state progression', () => {
  it('progresses through windup, active, and recovery without dealing damage outside active frames', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.light, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 5,
    });
    if (!started.ok) throw new Error('Expected action to start.');
    expect(isActionStateActive(started.runtime)).toBe(false);
    const active = stepAction(started.runtime, PLAYER_ACTIONS_BY_ID.light.windupMs);
    expect(active.runtime.state).toBe('light_active');
    expect(isActionStateActive(active.runtime)).toBe(true);
    const recovery = stepAction(active.runtime, PLAYER_ACTIONS_BY_ID.light.windupMs + PLAYER_ACTIONS_BY_ID.light.activeMs);
    expect(recovery.runtime.state).toBe('light_recovery');
    expect(isActionStateActive(recovery.runtime)).toBe(false);
  });

  it('applies only one hit per target per swing', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.light, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 5,
    });
    if (!started.ok) throw new Error('Expected action to start.');
    const active = stepAction(started.runtime, PLAYER_ACTIONS_BY_ID.light.windupMs).runtime;
    const first = registerActionHit(active, 'enemy-1');
    const second = registerActionHit(first.runtime, 'enemy-1');
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
  });

  it('consumes Heavy Attack cost exactly once and rejected Heavy costs nothing', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.heavy, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 5,
    });
    if (!started.ok) throw new Error('Expected action to start.');
    expect(started.committedCost).toBe(false);
    const active = stepAction(started.runtime, PLAYER_ACTIONS_BY_ID.heavy.windupMs);
    expect(active.committedCost).toBe(true);
    const followUp = stepAction(active.runtime, PLAYER_ACTIONS_BY_ID.heavy.windupMs + PLAYER_ACTIONS_BY_ID.heavy.activeMs);
    expect(followUp.committedCost).toBe(false);

    const rejected = startAction(PLAYER_ACTIONS_BY_ID.heavy, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 0,
    });
    expect(rejected.ok).toBe(false);
  });

  it('rejects blocked or dead input and handles dodge invulnerability and repeated input blocking', () => {
    const blocked = startAction(PLAYER_ACTIONS_BY_ID.light, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: true,
      dead: false,
      activeMenuOpen: true,
      currentVitae: 5,
    });
    expect(blocked.ok).toBe(false);

    const dodge = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 5,
    });
    if (!dodge.ok) throw new Error('Expected dodge to start.');
    expect(isInvulnerable(dodge.runtime, 100)).toBe(true);
    const repeated = startAction(PLAYER_ACTIONS_BY_ID.dodge, dodge.runtime, {
      now: 100,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: 5,
    });
    expect(repeated.ok).toBe(false);
  });
});

describe('Blood Lance projectile logic', () => {
  it('aims at a locked target or at the mouse pointer', () => {
    expect(resolveProjectileDirection({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(resolveProjectileDirection({ x: 0, y: 0 }, null, { x: 10, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('expires by lifetime or range and impacts only once', () => {
    const projectile = createProjectile('blood_lance', 'player', { x: 0, y: 0 }, { x: 1, y: 0 }, 0, 'enemy-1');
    const stepped = stepProjectile(projectile, 1300, 1300);
    expect(stepped.destroyed).toBe(true);

    const fresh = createProjectile('blood_lance', 'player', { x: 0, y: 0 }, { x: 1, y: 0 }, 0, 'enemy-1');
    const firstImpact = registerProjectileImpact(fresh, 'enemy-1');
    const secondImpact = registerProjectileImpact(firstImpact.projectile, 'enemy-1');
    expect(firstImpact.applied).toBe(true);
    expect(secondImpact.applied).toBe(false);
  });
});

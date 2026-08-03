import { describe, expect, it } from 'vitest';
import { DODGE_COOLDOWN_MS, DODGE_DURATION_MS, DODGE_INVULNERABLE_MS } from '../config/balancing';
import { PLAYER_ACTIONS_BY_ID } from '../data/combatActions';
import { createInitialPlayerActionRuntime, isActionStateActive, isInvulnerable, registerActionHit, startAction, stepAction } from '../simulation/combat/actionState';
import { createProjectile, registerProjectileImpact, resolveProjectileDirection, stepProjectile } from '../simulation/combat/projectiles';
import { renderIcon } from '../ui/icons/registry';

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

describe('dodge action phases and regression', () => {
  const ctx = { now: 0, blocked: false, dead: false, activeMenuOpen: false, currentVitae: 0 };

  it('has distinct windupState and activeState to prevent phase re-entry softlock', () => {
    const def = PLAYER_ACTIONS_BY_ID.dodge;
    expect(def.windupState).not.toBe(def.activeState);
    expect(def.windupState).toBe('dodge_windup');
    expect(def.activeState).toBe('dodge_active');
  });

  it('progresses windup → active → idle without re-entering windup', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), ctx);
    if (!started.ok) throw new Error('Dodge should start');
    expect(started.runtime.state).toBe('dodge_windup');

    // windupMs=0, so phaseEndsAt === now; step immediately transitions to active
    const active = stepAction(started.runtime, 0);
    expect(active.becameActive).toBe(true);
    expect(active.runtime.state).toBe('dodge_active');
    expect(active.runtime.phaseEndsAt).toBe(DODGE_DURATION_MS);

    // Still in active window — no transition yet
    const stillActive = stepAction(active.runtime, DODGE_DURATION_MS - 1);
    expect(stillActive.runtime.state).toBe('dodge_active');
    expect(stillActive.finished).toBe(false);

    // Active window expires — transitions to recoveryState ('idle')
    const recovery = stepAction(active.runtime, DODGE_DURATION_MS);
    expect(recovery.runtime.state).toBe('idle');
    expect(recovery.finished).toBe(false);

    // Recovery window expires (recoveryMs=0) — action clears to idle/null
    const done = stepAction(recovery.runtime, DODGE_DURATION_MS);
    expect(done.finished).toBe(true);
    expect(done.runtime.actionId).toBeNull();
    expect(done.runtime.state).toBe('idle');
  });

  it('is invulnerable for DODGE_INVULNERABLE_MS from start, not the full active window', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), ctx);
    if (!started.ok) throw new Error('Dodge should start');
    expect(isInvulnerable(started.runtime, DODGE_INVULNERABLE_MS - 1)).toBe(true);
    expect(isInvulnerable(started.runtime, DODGE_INVULNERABLE_MS)).toBe(false);
    // Must not be invulnerable for the entire dodge window
    expect(DODGE_INVULNERABLE_MS).toBeLessThan(DODGE_DURATION_MS);
  });

  it('is not active (isActionStateActive) during windup', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), ctx);
    if (!started.ok) throw new Error('Dodge should start');
    expect(isActionStateActive(started.runtime)).toBe(false);
    const active = stepAction(started.runtime, 0);
    expect(isActionStateActive(active.runtime)).toBe(true);
  });

  it('cooldown is recorded in Phaser-domain time at action start', () => {
    const now = 5000;
    const started = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), { ...ctx, now });
    if (!started.ok) throw new Error('Dodge should start');
    expect(started.runtime.cooldowns.dodge).toBe(now + DODGE_COOLDOWN_MS);
  });

  it('blocks repeated dodge input until the cooldown expires', () => {
    const started = startAction(PLAYER_ACTIONS_BY_ID.dodge, createInitialPlayerActionRuntime(), ctx);
    if (!started.ok) throw new Error('Dodge should start');
    const repeated = startAction(PLAYER_ACTIONS_BY_ID.dodge, started.runtime, { ...ctx, now: DODGE_COOLDOWN_MS - 1 });
    expect(repeated.ok).toBe(false);
    const afterCooldown = startAction(PLAYER_ACTIONS_BY_ID.dodge, started.runtime, { ...ctx, now: DODGE_COOLDOWN_MS });
    expect(afterCooldown.ok).toBe(true);
  });
});

describe('close icon rendering', () => {
  it('renders a filled closed path (contains z) so it is visible with SVG fill', () => {
    const html = renderIcon('close');
    const match = /d="([^"]+)"/.exec(html);
    expect(match).not.toBeNull();
    const pathData = match![1];
    // A filled icon must close its sub-paths with 'z' or 'Z'
    expect(/[zZ]/.test(pathData)).toBe(true);
    // Must not be the old broken open-stroke form
    expect(pathData).not.toContain('M5 5l14 14');
  });
});

import { PLAYER_ACTIONS_BY_ID } from '../../data/combatActions';
import type { CombatActionDefinition, CombatActionId, PlayerActionState } from '../../game/combat/combatTypes';

export interface PlayerActionRuntime {
  state: PlayerActionState;
  actionId: CombatActionId | null;
  phaseStartedAt: number;
  phaseEndsAt: number;
  cooldowns: Partial<Record<CombatActionId, number>>;
  hitTargetIds: string[];
  committed: boolean;
  commitCount: number;
  invulnerableUntil: number;
  dead: boolean;
}

export interface ActionStepResult {
  runtime: PlayerActionRuntime;
  committedCost: boolean;
  becameActive: boolean;
  finished: boolean;
}

export interface ActionStartContext {
  now: number;
  blocked: boolean;
  dead: boolean;
  activeMenuOpen: boolean;
  currentVitae: number;
}

export const createInitialPlayerActionRuntime = (): PlayerActionRuntime => ({
  state: 'idle',
  actionId: null,
  phaseStartedAt: 0,
  phaseEndsAt: 0,
  cooldowns: {},
  hitTargetIds: [],
  committed: false,
  commitCount: 0,
  invulnerableUntil: 0,
  dead: false,
});

export const isActionStateActive = (runtime: PlayerActionRuntime): boolean => {
  if (!runtime.actionId) {
    return false;
  }
  return runtime.state === PLAYER_ACTIONS_BY_ID[runtime.actionId].activeState;
};

export const canStartAction = (
  definition: CombatActionDefinition,
  runtime: PlayerActionRuntime,
  context: ActionStartContext,
): { ok: true } | { ok: false; reason: string } => {
  if (context.dead || runtime.dead) return { ok: false, reason: 'Dead' };
  if (context.blocked || context.activeMenuOpen) return { ok: false, reason: 'Blocked' };
  if (runtime.actionId && runtime.phaseEndsAt > context.now) return { ok: false, reason: 'Busy' };
  if ((runtime.cooldowns[definition.id] ?? 0) > context.now) return { ok: false, reason: 'Cooldown' };
  if (definition.vitaeCost > context.currentVitae) return { ok: false, reason: 'Insufficient Vitae' };
  return { ok: true };
};

export const startAction = (
  definition: CombatActionDefinition,
  runtime: PlayerActionRuntime,
  context: ActionStartContext,
): { ok: true; runtime: PlayerActionRuntime; committedCost: boolean } | { ok: false; reason: string; runtime: PlayerActionRuntime } => {
  const check = canStartAction(definition, runtime, context);
  if (!check.ok) {
    return { ok: false, reason: check.reason, runtime };
  }
  const nextRuntime: PlayerActionRuntime = {
    ...runtime,
    state: definition.windupState,
    actionId: definition.id,
    phaseStartedAt: context.now,
    phaseEndsAt: context.now + definition.windupMs,
    hitTargetIds: [],
    committed: Boolean(definition.commitOnStart),
    commitCount: definition.commitOnStart ? runtime.commitCount + 1 : runtime.commitCount,
    cooldowns: { ...runtime.cooldowns, [definition.id]: context.now + definition.cooldownMs },
    invulnerableUntil: definition.invulnerableMs != null ? context.now + definition.invulnerableMs : runtime.invulnerableUntil,
  };
  return { ok: true, runtime: nextRuntime, committedCost: Boolean(definition.commitOnStart) };
};

export const stepAction = (runtime: PlayerActionRuntime, now: number): ActionStepResult => {
  if (!runtime.actionId || now < runtime.phaseEndsAt) {
    return { runtime, committedCost: false, becameActive: false, finished: false };
  }
  const definition = PLAYER_ACTIONS_BY_ID[runtime.actionId];
  if (runtime.state === definition.windupState) {
    const committedCost = Boolean(definition.commitOnActiveStart && !runtime.committed);
    return {
      runtime: {
        ...runtime,
        state: definition.activeState,
        phaseStartedAt: now,
        phaseEndsAt: now + definition.activeMs,
        committed: runtime.committed || committedCost,
        commitCount: committedCost ? runtime.commitCount + 1 : runtime.commitCount,
      },
      committedCost,
      becameActive: true,
      finished: false,
    };
  }
  if (runtime.state === definition.activeState) {
    return {
      runtime: {
        ...runtime,
        state: definition.recoveryState,
        phaseStartedAt: now,
        phaseEndsAt: now + definition.recoveryMs,
      },
      committedCost: false,
      becameActive: false,
      finished: false,
    };
  }
  return {
    runtime: {
      ...runtime,
      state: 'idle',
      actionId: null,
      phaseStartedAt: now,
      phaseEndsAt: now,
      hitTargetIds: [],
      committed: false,
    },
    committedCost: false,
    becameActive: false,
    finished: true,
  };
};

export const registerActionHit = (runtime: PlayerActionRuntime, targetId: string): { runtime: PlayerActionRuntime; applied: boolean } => {
  if (!runtime.actionId || !isActionStateActive(runtime) || runtime.hitTargetIds.includes(targetId)) {
    return { runtime, applied: false };
  }
  return {
    runtime: { ...runtime, hitTargetIds: [...runtime.hitTargetIds, targetId] },
    applied: true,
  };
};

export const isInvulnerable = (runtime: PlayerActionRuntime, now: number): boolean => runtime.invulnerableUntil > now;

export const setPlayerDead = (runtime: PlayerActionRuntime): PlayerActionRuntime => ({
  ...runtime,
  dead: true,
  actionId: null,
  state: 'dead',
  phaseEndsAt: Number.POSITIVE_INFINITY,
});

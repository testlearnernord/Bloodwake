import { ENEMY_ATTACKS_BY_ID } from '../../data/enemyAttacks';
import { ENEMIES_BY_ID } from '../../data/enemies';
import { PLAYER_ACTIONS_BY_ID } from '../../data/combatActions';
import { applyIncomingDamage } from './stats';
import type { CombatDamageEvent, EnemyCombatState, VectorLike } from '../../game/combat/combatTypes';
import type { EnemyType } from '../../types/models';

export interface EnemyRuntimeState {
  id: string;
  type: EnemyType;
  state: EnemyCombatState;
  health: number;
  maxHealth: number;
  position: VectorLike;
  homePosition: VectorLike;
  facing: VectorLike;
  lastStateChangeAt: number;
  phaseEndsAt: number;
  attackId: string;
  cooldownUntil: number;
  telegraphVisible: boolean;
  directionLock: VectorLike | null;
  staggerUntil: number;
  poise: number;
  pendingProjectile: boolean;
}

export interface EnemyStepResult {
  enemy: EnemyRuntimeState;
  damageEvents: CombatDamageEvent[];
  shouldFireProjectile: boolean;
  shouldCleanupTelegraph: boolean;
}

const normalize = (vector: VectorLike): VectorLike => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
};

const distance = (left: VectorLike, right: VectorLike): number => Math.hypot(left.x - right.x, left.y - right.y);

export const createEnemyRuntime = (id: string, type: EnemyType, position: VectorLike): EnemyRuntimeState => {
  const enemy = ENEMIES_BY_ID[type];
  return {
    id,
    type,
    state: 'idle',
    health: enemy.health,
    maxHealth: enemy.health,
    position: { ...position },
    homePosition: { ...position },
    facing: { x: 1, y: 0 },
    lastStateChangeAt: 0,
    phaseEndsAt: 0,
    attackId: enemy.attackIds[0] ?? '',
    cooldownUntil: 0,
    telegraphVisible: false,
    directionLock: null,
    staggerUntil: 0,
    poise: enemy.poise,
    pendingProjectile: false,
  };
};

export const stepEnemyCombat = (
  enemy: EnemyRuntimeState,
  playerPosition: VectorLike,
  now: number,
  playerArmor = 0,
): EnemyStepResult => {
  if (enemy.health <= 0) {
    return { enemy: { ...enemy, state: 'dead', telegraphVisible: false }, damageEvents: [], shouldFireProjectile: false, shouldCleanupTelegraph: true };
  }
  if (enemy.staggerUntil > now) {
    return { enemy: { ...enemy, state: 'stagger', telegraphVisible: false }, damageEvents: [], shouldFireProjectile: false, shouldCleanupTelegraph: true };
  }
  const definition = ENEMIES_BY_ID[enemy.type];
  const attack = ENEMY_ATTACKS_BY_ID[enemy.attackId];
  const toPlayer = { x: playerPosition.x - enemy.position.x, y: playerPosition.y - enemy.position.y };
  const nextFacing = normalize(toPlayer);
  const rangeToPlayer = distance(playerPosition, enemy.position);
  if (enemy.state === 'windup' && now >= enemy.phaseEndsAt) {
    const lockedFacing = enemy.directionLock ?? nextFacing;
    const damageEvents: CombatDamageEvent[] = attack.projectileId
      ? []
      : rangeToPlayer <= attack.range
        ? [
            {
              sourceId: enemy.id,
              targetId: 'player',
              actionId: attack.id,
              rawDamage: attack.damage,
              mitigatedDamage: applyIncomingDamage(attack.damage, playerArmor),
              stagger: 1,
              worldPosition: { ...playerPosition },
            },
          ]
        : [];
    return {
      enemy: {
        ...enemy,
        state: 'active_attack',
        facing: lockedFacing,
        phaseEndsAt: now + attack.activeMs,
        telegraphVisible: false,
        pendingProjectile: Boolean(attack.projectileId),
      },
      damageEvents,
      shouldFireProjectile: Boolean(attack.projectileId),
      shouldCleanupTelegraph: true,
    };
  }
  if (enemy.state === 'active_attack' && now >= enemy.phaseEndsAt) {
    return {
      enemy: {
        ...enemy,
        state: 'recovery',
        phaseEndsAt: now + attack.recoveryMs,
        cooldownUntil: now + attack.cooldownMs,
        pendingProjectile: false,
      },
      damageEvents: [],
      shouldFireProjectile: false,
      shouldCleanupTelegraph: false,
    };
  }
  if (enemy.state === 'recovery' && now >= enemy.phaseEndsAt) {
    return {
      enemy: { ...enemy, state: 'approach', phaseEndsAt: 0 },
      damageEvents: [],
      shouldFireProjectile: false,
      shouldCleanupTelegraph: false,
    };
  }
  if (now < enemy.cooldownUntil) {
    return { enemy: { ...enemy, facing: nextFacing }, damageEvents: [], shouldFireProjectile: false, shouldCleanupTelegraph: false };
  }
  if (rangeToPlayer <= attack.range) {
    const directionLock = attack.directionLockMs > 0 ? nextFacing : null;
    return {
      enemy: {
        ...enemy,
        state: 'windup',
        facing: nextFacing,
        phaseEndsAt: now + attack.windupMs,
        telegraphVisible: true,
        directionLock,
      },
      damageEvents: [],
      shouldFireProjectile: false,
      shouldCleanupTelegraph: false,
    };
  }
  const nextState: EnemyCombatState = rangeToPlayer <= definition.detectionRange ? (rangeToPlayer < definition.preferredDistance && enemy.type === 'clergy_hunter' ? 'reposition' : 'approach') : 'return_home';
  return {
    enemy: { ...enemy, state: nextState, facing: nextFacing, telegraphVisible: false, directionLock: null },
    damageEvents: [],
    shouldFireProjectile: false,
    shouldCleanupTelegraph: enemy.telegraphVisible,
  };
};

export const applyEnemyStagger = (enemy: EnemyRuntimeState, stagger: number, now: number, actionId: 'light' | 'heavy' | 'blood_lance'): EnemyRuntimeState => {
  const bonus = actionId === 'heavy' ? PLAYER_ACTIONS_BY_ID.heavy.stagger : 0;
  if (stagger + bonus < enemy.poise) {
    return enemy;
  }
  return {
    ...enemy,
    state: 'stagger',
    staggerUntil: now + 220,
    telegraphVisible: false,
    directionLock: null,
  };
};

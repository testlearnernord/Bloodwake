import { ENEMY_ATTACKS_BY_ID } from '../../data/enemyAttacks';
import { ENEMIES_BY_ID } from '../../data/enemies';
import { applyIncomingDamage } from './stats';
import type { CombatDamageEvent, EnemyCombatState, VectorLike } from '../../game/combat/combatTypes';
import type { EnemyType } from '../../types/models';
import { DEFAULT_FACING_VECTOR, distanceBetween, normalizeOr } from './vectors';

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
  targetId: string | null;
}

export interface EnemyStepResult {
  enemy: EnemyRuntimeState;
  damageEvents: CombatDamageEvent[];
  shouldFireProjectile: boolean;
  shouldCleanupTelegraph: boolean;
}

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
    targetId: null,
  };
};

export const stepEnemyCombat = (
  enemy: EnemyRuntimeState,
  playerPosition: VectorLike,
  now: number,
  playerArmor = 0,
  targetId = 'player',
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
  const nextFacing = normalizeOr(toPlayer, DEFAULT_FACING_VECTOR);
  const rangeToPlayer = distanceBetween(playerPosition, enemy.position);
  if (enemy.state === 'windup' && now >= enemy.phaseEndsAt) {
    const lockedFacing = enemy.directionLock ?? nextFacing;
    const damageEvents: CombatDamageEvent[] = attack.projectileId
      ? []
      : rangeToPlayer <= attack.range
        ? [
            {
              sourceId: enemy.id,
              targetId: enemy.targetId ?? targetId,
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
  // Active timed states: preserve deadline and do not re-enter the attack-selection branch.
  if (enemy.state === 'windup' && now < enemy.phaseEndsAt) {
    // Tracking attacks may update facing toward the player; locked attacks keep directionLock stable.
    const updatedFacing = attack.trackingDuringWindup ? nextFacing : (enemy.directionLock ?? enemy.facing);
    return {
      enemy: { ...enemy, facing: updatedFacing },
      damageEvents: [],
      shouldFireProjectile: false,
      shouldCleanupTelegraph: false,
    };
  }
  if (enemy.state === 'active_attack' && now < enemy.phaseEndsAt) {
    return { enemy: { ...enemy }, damageEvents: [], shouldFireProjectile: false, shouldCleanupTelegraph: false };
  }
  if (enemy.state === 'recovery' && now < enemy.phaseEndsAt) {
    return { enemy: { ...enemy }, damageEvents: [], shouldFireProjectile: false, shouldCleanupTelegraph: false };
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
        targetId,
      },
      damageEvents: [],
      shouldFireProjectile: false,
      shouldCleanupTelegraph: false,
    };
  }
  const nextState: EnemyCombatState = rangeToPlayer <= definition.detectionRange ? (rangeToPlayer < definition.preferredDistance && enemy.type === 'clergy_hunter' ? 'reposition' : 'approach') : 'return_home';
  return {
    enemy: { ...enemy, state: nextState, facing: nextFacing, telegraphVisible: false, directionLock: null, targetId: nextState === 'return_home' ? null : targetId },
    damageEvents: [],
    shouldFireProjectile: false,
    shouldCleanupTelegraph: enemy.telegraphVisible,
  };
};

export const applyEnemyStagger = (enemy: EnemyRuntimeState, stagger: number, now: number): EnemyRuntimeState => {
  if (stagger < enemy.poise) {
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

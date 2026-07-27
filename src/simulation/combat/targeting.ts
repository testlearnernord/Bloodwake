import { LOCK_BREAK_RANGE, LOCK_RANGE } from '../../config/balancing';
import type { CombatTargetSnapshot, VectorLike } from '../../game/combat/combatTypes';
import { DEFAULT_FACING_VECTOR, normalizeOr } from './vectors';

const EPSILON = 0.0001;

const distanceSquared = (left: VectorLike, right: VectorLike): number => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
};

export const normalizeVector = (vector: VectorLike): VectorLike => normalizeOr(vector, DEFAULT_FACING_VECTOR);

const dot = (left: VectorLike, right: VectorLike): number => left.x * right.x + left.y * right.y;

export const isValidLockTarget = (
  target: CombatTargetSnapshot,
  playerPosition: VectorLike,
  maxRange = LOCK_RANGE,
): boolean =>
  target.alive &&
  target.active &&
  target.hostile &&
  distanceSquared(playerPosition, target) <= maxRange * maxRange;

export const shouldBreakLock = (
  target: CombatTargetSnapshot | null | undefined,
  playerPosition: VectorLike,
  breakRange = LOCK_BREAK_RANGE,
): boolean => !target || !isValidLockTarget(target, playerPosition, breakRange);

export const selectLockTarget = (
  targets: CombatTargetSnapshot[],
  playerPosition: VectorLike,
  facingVector: VectorLike,
  maxRange = LOCK_RANGE,
): CombatTargetSnapshot | null => {
  const normalizedFacing = normalizeVector(facingVector);
  return (
    targets
      .filter((target) => isValidLockTarget(target, playerPosition, maxRange))
      .sort((left, right) => {
        const leftDir = normalizeVector({ x: left.x - playerPosition.x, y: left.y - playerPosition.y });
        const rightDir = normalizeVector({ x: right.x - playerPosition.x, y: right.y - playerPosition.y });
        const leftAngleScore = 1 - dot(normalizedFacing, leftDir);
        const rightAngleScore = 1 - dot(normalizedFacing, rightDir);
        if (Math.abs(leftAngleScore - rightAngleScore) > EPSILON) {
          return leftAngleScore - rightAngleScore;
        }
        const leftDistance = distanceSquared(playerPosition, left);
        const rightDistance = distanceSquared(playerPosition, right);
        if (Math.abs(leftDistance - rightDistance) > EPSILON) {
          return leftDistance - rightDistance;
        }
        return left.id.localeCompare(right.id);
      })[0] ?? null
  );
};

export const cycleLockTarget = (
  targets: CombatTargetSnapshot[],
  currentTargetId: string | null,
  playerPosition: VectorLike,
  direction: 1 | -1,
  maxRange = LOCK_RANGE,
): CombatTargetSnapshot | null => {
  const validTargets = targets
    .filter((target) => isValidLockTarget(target, playerPosition, maxRange))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (validTargets.length === 0) {
    return null;
  }
  const currentIndex = currentTargetId ? validTargets.findIndex((target) => target.id === currentTargetId) : -1;
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + validTargets.length) % validTargets.length;
  return validTargets[nextIndex] ?? null;
};

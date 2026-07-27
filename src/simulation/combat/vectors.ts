import type { VectorLike } from '../../game/combat/combatTypes';

export const ZERO_VECTOR: VectorLike = { x: 0, y: 0 };
export const DEFAULT_FACING_VECTOR: VectorLike = { x: 1, y: 0 };

export const normalizeOr = (vector: VectorLike, fallback: VectorLike): VectorLike => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { ...fallback };
  }
  return { x: vector.x / length, y: vector.y / length };
};

export const scaleVector = (vector: VectorLike, factor: number): VectorLike => ({ x: vector.x * factor, y: vector.y * factor });
export const addVectors = (left: VectorLike, right: VectorLike): VectorLike => ({ x: left.x + right.x, y: left.y + right.y });
export const distanceBetween = (left: VectorLike, right: VectorLike): number => Math.hypot(left.x - right.x, left.y - right.y);

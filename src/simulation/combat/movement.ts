import { MIN_ORBIT_RADIUS } from '../../config/balancing';
import type { VectorLike } from '../../game/combat/combatTypes';
import { DEFAULT_FACING_VECTOR, ZERO_VECTOR, addVectors, normalizeOr, scaleVector } from './vectors';

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface MovementResult {
  velocity: VectorLike;
  facing: VectorLike;
  minimumSeparation: number;
}

export const getInputVector = (input: MovementInput): VectorLike =>
  normalizeOr({ x: (input.right ? 1 : 0) - (input.left ? 1 : 0), y: (input.down ? 1 : 0) - (input.up ? 1 : 0) }, ZERO_VECTOR);

export const computeFreeMovement = (input: MovementInput, speed: number, facing: VectorLike): MovementResult => {
  const direction = getInputVector(input);
  return {
    velocity: scaleVector(direction, speed),
    facing: normalizeOr(facing, DEFAULT_FACING_VECTOR),
    minimumSeparation: 0,
  };
};

export const computeLockedMovement = (
  input: MovementInput,
  playerPosition: VectorLike,
  targetPosition: VectorLike,
  speed: number,
  minimumOrbitRadius = MIN_ORBIT_RADIUS,
): MovementResult => {
  const toTargetRaw = { x: targetPosition.x - playerPosition.x, y: targetPosition.y - playerPosition.y };
  const distance = Math.hypot(toTargetRaw.x, toTargetRaw.y);
  const toTarget = normalizeOr(toTargetRaw, DEFAULT_FACING_VECTOR);
  const tangent = { x: -toTarget.y, y: toTarget.x };
  const radialInput = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const tangentialInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const base = addVectors(scaleVector(toTarget, radialInput), scaleVector(tangent, tangentialInput));
  let velocity = scaleVector(normalizeOr(base, ZERO_VECTOR), speed);
  if (distance <= minimumOrbitRadius && radialInput > 0) {
    velocity = scaleVector(normalizeOr(scaleVector(tangent, tangentialInput || 1), ZERO_VECTOR), speed);
  }
  return {
    velocity,
    facing: toTarget,
    minimumSeparation: minimumOrbitRadius,
  };
};

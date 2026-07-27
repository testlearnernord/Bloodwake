import { MIN_ORBIT_RADIUS } from '../../config/balancing';
import type { VectorLike } from '../../game/combat/combatTypes';

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

const normalize = (vector: VectorLike): VectorLike => {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
};

const scale = (vector: VectorLike, factor: number): VectorLike => ({ x: vector.x * factor, y: vector.y * factor });
const add = (left: VectorLike, right: VectorLike): VectorLike => ({ x: left.x + right.x, y: left.y + right.y });

export const getInputVector = (input: MovementInput): VectorLike =>
  normalize({ x: (input.right ? 1 : 0) - (input.left ? 1 : 0), y: (input.down ? 1 : 0) - (input.up ? 1 : 0) });

export const computeFreeMovement = (input: MovementInput, speed: number, facing: VectorLike): MovementResult => {
  const direction = getInputVector(input);
  return {
    velocity: scale(direction, speed),
    facing: normalize(facing),
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
  const toTarget = distance === 0 ? { x: 1, y: 0 } : { x: toTargetRaw.x / distance, y: toTargetRaw.y / distance };
  const tangent = { x: -toTarget.y, y: toTarget.x };
  const radialInput = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const tangentialInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const base = add(scale(toTarget, radialInput), scale(tangent, tangentialInput));
  let velocity = scale(normalize(base), speed);
  if (distance <= minimumOrbitRadius && radialInput > 0) {
    velocity = scale(normalize(scale(tangent, tangentialInput || 1)), speed);
  }
  return {
    velocity,
    facing: toTarget,
    minimumSeparation: minimumOrbitRadius,
  };
};

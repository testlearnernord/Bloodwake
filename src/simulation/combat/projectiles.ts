import { PROJECTILES_BY_ID } from '../../data/abilities';
import type { ProjectileDefinition, VectorLike } from '../../game/combat/combatTypes';
import { DEFAULT_FACING_VECTOR, normalizeOr } from './vectors';

export interface CombatProjectile {
  id: string;
  projectileId: string;
  sourceId: string;
  targetId: string | null;
  position: VectorLike;
  velocity: VectorLike;
  direction: VectorLike;
  spawnedAt: number;
  expiresAt: number;
  maxRange: number;
  distanceTravelled: number;
  hitTargetIds: string[];
  destroyed: boolean;
}

export const resolveProjectileDirection = (origin: VectorLike, target: VectorLike | null, pointer: VectorLike): VectorLike =>
  normalizeOr(target ? { x: target.x - origin.x, y: target.y - origin.y } : { x: pointer.x - origin.x, y: pointer.y - origin.y }, DEFAULT_FACING_VECTOR);

export const createProjectile = (
  projectileId: string,
  sourceId: string,
  origin: VectorLike,
  direction: VectorLike,
  now: number,
  targetId: string | null,
): CombatProjectile => {
  const definition = PROJECTILES_BY_ID[projectileId];
  const normalizedDirection = normalizeOr(direction, DEFAULT_FACING_VECTOR);
  return {
    id: `${projectileId}-${now}-${sourceId}`,
    projectileId,
    sourceId,
    targetId,
    position: { ...origin },
    velocity: { x: normalizedDirection.x * definition.speed, y: normalizedDirection.y * definition.speed },
    direction: normalizedDirection,
    spawnedAt: now,
    expiresAt: now + definition.lifetimeMs,
    maxRange: definition.maxRange,
    distanceTravelled: 0,
    hitTargetIds: [],
    destroyed: false,
  };
};

export const stepProjectile = (projectile: CombatProjectile, now: number, deltaMs: number, homingTarget?: VectorLike | null): CombatProjectile => {
  if (projectile.destroyed) {
    return projectile;
  }
  const definition: ProjectileDefinition = PROJECTILES_BY_ID[projectile.projectileId];
  const nextDirection = homingTarget && definition.homingStrength
    ? normalizeOr({
        x: projectile.direction.x * (1 - definition.homingStrength) + (homingTarget.x - projectile.position.x) * definition.homingStrength,
        y: projectile.direction.y * (1 - definition.homingStrength) + (homingTarget.y - projectile.position.y) * definition.homingStrength,
      }, DEFAULT_FACING_VECTOR)
    : projectile.direction;
  const distanceStep = definition.speed * (deltaMs / 1000);
  const nextPosition = {
    x: projectile.position.x + nextDirection.x * distanceStep,
    y: projectile.position.y + nextDirection.y * distanceStep,
  };
  const distanceTravelled = projectile.distanceTravelled + distanceStep;
  const expired = now >= projectile.expiresAt || distanceTravelled >= projectile.maxRange;
  return {
    ...projectile,
    position: nextPosition,
    direction: nextDirection,
    velocity: { x: nextDirection.x * definition.speed, y: nextDirection.y * definition.speed },
    distanceTravelled,
    destroyed: expired,
  };
};

export const registerProjectileImpact = (projectile: CombatProjectile, targetId: string): { projectile: CombatProjectile; applied: boolean } => {
  if (projectile.destroyed || projectile.hitTargetIds.includes(targetId)) {
    return { projectile, applied: false };
  }
  return {
    projectile: {
      ...projectile,
      destroyed: true,
      hitTargetIds: [...projectile.hitTargetIds, targetId],
    },
    applied: true,
  };
};

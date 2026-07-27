import type { ProjectileDefinition } from '../game/combat/combatTypes';
import {
  BLOOD_LANCE_COLLISION_RADIUS,
  BLOOD_LANCE_DAMAGE,
  BLOOD_LANCE_HIT_STOP_MS,
  BLOOD_LANCE_LIFETIME_MS,
  BLOOD_LANCE_MAX_RANGE,
  BLOOD_LANCE_SHAKE,
  BLOOD_LANCE_SPEED,
  BLOOD_LANCE_STAGGER,
} from '../config/balancing';

export const BLOOD_LANCE_PROJECTILE: ProjectileDefinition = {
  id: 'blood_lance',
  label: 'Blood Lance',
  speed: BLOOD_LANCE_SPEED,
  lifetimeMs: BLOOD_LANCE_LIFETIME_MS,
  maxRange: BLOOD_LANCE_MAX_RANGE,
  collisionRadius: BLOOD_LANCE_COLLISION_RADIUS,
  damage: BLOOD_LANCE_DAMAGE,
  stagger: BLOOD_LANCE_STAGGER,
  trailColor: 0xb91c3c,
  impactColor: 0xff6b81,
  hitStopMs: BLOOD_LANCE_HIT_STOP_MS,
  cameraShake: BLOOD_LANCE_SHAKE,
  canHitHumans: false,
  homingStrength: 0.08,
};

export const HOLY_BOLT_PROJECTILE: ProjectileDefinition = {
  id: 'holy_bolt',
  label: 'Holy Bolt',
  speed: Math.round(BLOOD_LANCE_SPEED * 0.82),
  lifetimeMs: BLOOD_LANCE_LIFETIME_MS,
  maxRange: Math.round(BLOOD_LANCE_MAX_RANGE * 0.9),
  collisionRadius: BLOOD_LANCE_COLLISION_RADIUS,
  damage: Math.max(1, BLOOD_LANCE_DAMAGE - 1),
  stagger: Math.max(1, BLOOD_LANCE_STAGGER - 1),
  trailColor: 0xf8e16c,
  impactColor: 0xfff3bf,
  hitStopMs: 0,
  cameraShake: 0,
  canHitHumans: false,
};

export const PROJECTILES_BY_ID = {
  [BLOOD_LANCE_PROJECTILE.id]: BLOOD_LANCE_PROJECTILE,
  [HOLY_BOLT_PROJECTILE.id]: HOLY_BOLT_PROJECTILE,
} satisfies Record<string, ProjectileDefinition>;

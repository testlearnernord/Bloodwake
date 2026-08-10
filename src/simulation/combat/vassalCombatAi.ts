import { PLAYER_ACTIONS_BY_ID } from '../../data/combatActions';
import type { CombatActionId, CombatTargetSnapshot, EnemyCombatState, VectorLike } from '../../game/combat/combatTypes';
import type { VampireVassal, VassalOperationalOrderType } from '../../types/models';
import { SeededRng } from '../../utilities/rng';
import { getCombatFeedEligibility } from './combatFeed';
import type { PlayerActionRuntime } from './actionState';
import type { MovementInput } from './movement';

export type VassalCombatMovementIntent = 'hold' | 'approach' | 'orbit_left' | 'orbit_right' | 'retreat';

export interface VassalCombatTarget extends CombatTargetSnapshot {
  state: EnemyCombatState;
}

export interface VassalCombatDecision {
  targetId: string | null;
  actionId: CombatActionId | null;
  movement: VassalCombatMovementIntent;
  retreating: boolean;
  reason: string;
}

const ENGAGEMENT_RANGE: Record<VassalOperationalOrderType, number> = {
  none: 0,
  guard: 220,
  companion: 360,
  scout: 135,
  hunt: 320,
  raid: 520,
};

const RETREAT_HEALTH_RATIO: Record<VassalOperationalOrderType, number> = {
  none: 0.3,
  guard: 0.25,
  companion: 0.3,
  scout: 0.55,
  hunt: 0.35,
  raid: 0.2,
};

const distance = (left: VectorLike, right: VectorLike): number => Math.hypot(right.x - left.x, right.y - left.y);
const healthRatio = (health: number, maxHealth: number): number => maxHealth > 0 ? health / maxHealth : 0;
const cooldownReady = (runtime: PlayerActionRuntime, actionId: CombatActionId, now: number): boolean =>
  (runtime.cooldowns[actionId] ?? 0) <= now;

const deterministicOrbitLeft = (id: string): boolean =>
  [...id].reduce((score, char) => score + char.charCodeAt(0), 0) % 2 === 0;

export const getVassalCombatEngagementRange = (type: VassalOperationalOrderType): number => ENGAGEMENT_RANGE[type];
export const getVassalRetreatHealthRatio = (type: VassalOperationalOrderType): number => RETREAT_HEALTH_RATIO[type];

export const shouldVassalRetreat = (vassal: VampireVassal): boolean =>
  healthRatio(vassal.health, vassal.maxHealth) <= RETREAT_HEALTH_RATIO[vassal.operationalOrder.type];

const targetEligible = (
  vassal: VampireVassal,
  actorPosition: VectorLike,
  playerPosition: VectorLike,
  target: VassalCombatTarget,
  rangeMultiplier = 1,
): boolean => {
  if (!target.alive || !target.active || !target.hostile) return false;
  const range = ENGAGEMENT_RANGE[vassal.operationalOrder.type] * rangeMultiplier;
  if (range <= 0) return false;
  const actorDistance = distance(actorPosition, target);
  if (actorDistance <= range) return true;
  return vassal.operationalOrder.type === 'companion' && distance(playerPosition, target) <= range;
};

export const selectVassalCombatTarget = (
  vassal: VampireVassal,
  actorPosition: VectorLike,
  playerPosition: VectorLike,
  targets: VassalCombatTarget[],
  currentTargetId: string | null,
): VassalCombatTarget | null => {
  if (vassal.state !== 'active' || vassal.operationalOrder.type === 'none') return null;
  const current = currentTargetId ? targets.find((target) => target.id === currentTargetId) : undefined;
  if (current && targetEligible(vassal, actorPosition, playerPosition, current, 1.35)) return current;

  const eligible = targets.filter((target) => targetEligible(vassal, actorPosition, playerPosition, target));
  if (eligible.length === 0) return null;
  return eligible.sort((left, right) => {
    const scoreFor = (target: VassalCombatTarget): number => {
      const actorDistance = distance(actorPosition, target);
      if (vassal.operationalOrder.type === 'companion') {
        return distance(playerPosition, target) * 0.72 + actorDistance * 0.28;
      }
      if (vassal.operationalOrder.type === 'hunt') {
        return actorDistance + healthRatio(target.health, target.maxHealth) * 35;
      }
      return actorDistance;
    };
    const scoreDifference = scoreFor(left) - scoreFor(right);
    return Math.abs(scoreDifference) > 0.001 ? scoreDifference : left.id.localeCompare(right.id);
  })[0] ?? null;
};

const orbitMovement = (vassal: VampireVassal): VassalCombatMovementIntent =>
  deterministicOrbitLeft(vassal.id) ? 'orbit_left' : 'orbit_right';

export const chooseVassalCombatDecision = (
  vassal: VampireVassal,
  actorPosition: VectorLike,
  target: VassalCombatTarget | null,
  runtime: PlayerActionRuntime,
  now: number,
): VassalCombatDecision => {
  if (vassal.state !== 'active' || vassal.operationalOrder.type === 'none' || !target) {
    return { targetId: null, actionId: null, movement: 'hold', retreating: false, reason: 'No combat target.' };
  }
  if (shouldVassalRetreat(vassal)) {
    return { targetId: target.id, actionId: null, movement: 'retreat', retreating: true, reason: 'Health threshold reached; disengaging.' };
  }

  const targetDistance = distance(actorPosition, target);
  const closeOrbit = orbitMovement(vassal);
  if (runtime.actionId) {
    return {
      targetId: target.id,
      actionId: null,
      movement: runtime.actionId === 'bite' ? 'hold' : targetDistance > PLAYER_ACTIONS_BY_ID.light.range * 0.9 ? 'approach' : closeOrbit,
      retreating: false,
      reason: `Executing ${PLAYER_ACTIONS_BY_ID[runtime.actionId].label}.`,
    };
  }

  if (target.state === 'windup' && targetDistance <= 115 && cooldownReady(runtime, 'dodge', now)) {
    return { targetId: target.id, actionId: 'dodge', movement: 'retreat', retreating: false, reason: 'Incoming telegraph; dodge.' };
  }

  const biteReady = getCombatFeedEligibility({
    id: target.id,
    health: target.health,
    maxHealth: target.maxHealth,
    elite: target.elite,
    distance: targetDistance,
    state: target.state,
  });
  if (biteReady.ok && vassal.vitae < vassal.maxVitae * 0.8 && cooldownReady(runtime, 'bite', now)) {
    return { targetId: target.id, actionId: 'bite', movement: 'hold', retreating: false, reason: 'Predatory Bite opportunity.' };
  }

  const lance = PLAYER_ACTIONS_BY_ID.blood_lance;
  if (targetDistance > PLAYER_ACTIONS_BY_ID.heavy.range * 1.2 && targetDistance <= ENGAGEMENT_RANGE[vassal.operationalOrder.type]
      && vassal.vitae >= lance.vitaeCost && cooldownReady(runtime, 'blood_lance', now)) {
    return { targetId: target.id, actionId: 'blood_lance', movement: closeOrbit, retreating: false, reason: 'Target is outside melee range.' };
  }

  const heavy = PLAYER_ACTIONS_BY_ID.heavy;
  if (targetDistance <= heavy.range && vassal.vitae >= heavy.vitaeCost && cooldownReady(runtime, 'heavy', now)
      && (target.elite || vassal.combat >= 3 || healthRatio(target.health, target.maxHealth) > 0.55)) {
    return { targetId: target.id, actionId: 'heavy', movement: closeOrbit, retreating: false, reason: 'Heavy opening available.' };
  }

  const light = PLAYER_ACTIONS_BY_ID.light;
  if (targetDistance <= light.range && cooldownReady(runtime, 'light', now)) {
    return { targetId: target.id, actionId: 'light', movement: closeOrbit, retreating: false, reason: 'Melee opening available.' };
  }

  return { targetId: target.id, actionId: null, movement: 'approach', retreating: false, reason: 'Closing to attack range.' };
};

export const getVassalCombatMovementInput = (intent: VassalCombatMovementIntent): MovementInput => ({
  up: intent === 'approach',
  down: intent === 'retreat',
  left: intent === 'orbit_left',
  right: intent === 'orbit_right',
});

export const getVassalPredatoryBiteSuccessChance = (vassal: VampireVassal, elite: boolean): number => {
  const chance = 0.42
    + vassal.combat * 0.065
    + vassal.attributes.bloodControl * 0.035
    + vassal.attributes.willpower * 0.018
    - (elite ? 0.22 : 0);
  return Math.max(0.2, Math.min(0.95, chance));
};

export const resolveVassalPredatoryBiteSuccess = (
  worldSeed: string,
  day: number,
  vassal: VampireVassal,
  targetId: string,
  elite: boolean,
  attempt: number,
): boolean => new SeededRng(`${worldSeed}:vassal-bite:${day}:${vassal.id}:${targetId}:${attempt}`)
  .chance(getVassalPredatoryBiteSuccessChance(vassal, elite));

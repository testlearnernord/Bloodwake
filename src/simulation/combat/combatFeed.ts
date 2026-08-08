import {
  COMBAT_FEED_ELITE_FAILURE_DAMAGE,
  COMBAT_FEED_ELITE_HEALTH_RATIO,
  COMBAT_FEED_ELITE_WINDOW_MS,
  COMBAT_FEED_FAILURE_DAMAGE,
  COMBAT_FEED_NORMAL_HEALTH_RATIO,
  COMBAT_FEED_NORMAL_WINDOW_MS,
  COMBAT_FEED_POUNCE_MS,
  COMBAT_FEED_RANGE,
  COMBAT_FEED_SECOND_WINDOW_DELAY_MS,
  COMBAT_FEED_VITAE_GAIN,
} from '../../config/balancing';
import type { EnemyCombatState } from '../../game/combat/combatTypes';

export type CombatFeedPhase = 'pounce' | 'first_window' | 'second_window' | 'success' | 'failure';

export interface CombatFeedTargetState {
  id: string;
  health: number;
  maxHealth: number;
  elite: boolean;
  distance: number;
  state: EnemyCombatState;
}

export interface CombatFeedRuntime {
  enemyId: string;
  elite: boolean;
  phase: CombatFeedPhase;
  startedAt: number;
  windowOpensAt: number;
  windowClosesAt: number;
  successfulInputs: number;
}

export interface CombatFeedEligibility {
  ok: boolean;
  reason: string;
}

export interface CombatFeedInputResult {
  runtime: CombatFeedRuntime;
  accepted: boolean;
  succeeded: boolean;
  failed: boolean;
}

const getHealthThreshold = (elite: boolean): number =>
  elite ? COMBAT_FEED_ELITE_HEALTH_RATIO : COMBAT_FEED_NORMAL_HEALTH_RATIO;

const getWindowMs = (elite: boolean): number =>
  elite ? COMBAT_FEED_ELITE_WINDOW_MS : COMBAT_FEED_NORMAL_WINDOW_MS;

export const getCombatFeedEligibility = (target: CombatFeedTargetState): CombatFeedEligibility => {
  if (target.health <= 0 || target.maxHealth <= 0) return { ok: false, reason: 'Target is already defeated.' };
  if (target.distance > COMBAT_FEED_RANGE) return { ok: false, reason: 'Move closer for Predatory Bite.' };
  const ratio = target.health / target.maxHealth;
  const threshold = getHealthThreshold(target.elite);
  if (ratio > threshold && target.state !== 'stagger') {
    return { ok: false, reason: target.elite ? 'Elite must be staggered or below 20% health.' : 'Target must be staggered or below 35% health.' };
  }
  return { ok: true, reason: 'Predatory Bite ready.' };
};

export const createCombatFeedRuntime = (enemyId: string, elite: boolean, now: number): CombatFeedRuntime => ({
  enemyId,
  elite,
  phase: 'pounce',
  startedAt: now,
  windowOpensAt: now + COMBAT_FEED_POUNCE_MS,
  windowClosesAt: now + COMBAT_FEED_POUNCE_MS + getWindowMs(elite),
  successfulInputs: 0,
});

export const stepCombatFeedRuntime = (runtime: CombatFeedRuntime, now: number): CombatFeedRuntime => {
  if (runtime.phase === 'success' || runtime.phase === 'failure') return runtime;
  if (runtime.phase === 'pounce' && now >= runtime.windowOpensAt) {
    if (now > runtime.windowClosesAt) return { ...runtime, phase: 'failure' };
    return { ...runtime, phase: 'first_window' };
  }
  if ((runtime.phase === 'first_window' || runtime.phase === 'second_window') && now > runtime.windowClosesAt) {
    return { ...runtime, phase: 'failure' };
  }
  return runtime;
};

export const pressCombatFeedInput = (runtime: CombatFeedRuntime, now: number): CombatFeedInputResult => {
  const stepped = stepCombatFeedRuntime(runtime, now);
  if (stepped.phase === 'success') return { runtime: stepped, accepted: false, succeeded: true, failed: false };
  if (stepped.phase === 'failure') return { runtime: stepped, accepted: false, succeeded: false, failed: true };
  if (now < stepped.windowOpensAt || now > stepped.windowClosesAt || stepped.phase === 'pounce') {
    const failed = { ...stepped, phase: 'failure' as const };
    return { runtime: failed, accepted: false, succeeded: false, failed: true };
  }
  if (stepped.phase === 'first_window') {
    const opensAt = now + COMBAT_FEED_SECOND_WINDOW_DELAY_MS;
    const next = {
      ...stepped,
      phase: 'second_window' as const,
      successfulInputs: 1,
      windowOpensAt: opensAt,
      windowClosesAt: opensAt + getWindowMs(stepped.elite),
    };
    return { runtime: next, accepted: true, succeeded: false, failed: false };
  }
  const success = { ...stepped, phase: 'success' as const, successfulInputs: 2 };
  return { runtime: success, accepted: true, succeeded: true, failed: false };
};

export const getCombatFeedVitaeGain = (currentVitae: number, maxVitae: number): number =>
  Math.max(0, Math.min(COMBAT_FEED_VITAE_GAIN, maxVitae - currentVitae));

export const getCombatFeedFailureDamage = (elite: boolean): number =>
  elite ? COMBAT_FEED_ELITE_FAILURE_DAMAGE : COMBAT_FEED_FAILURE_DAMAGE;

export const getCombatFeedPrompt = (runtime: CombatFeedRuntime, now: number): string => {
  if (runtime.phase === 'pounce') return 'Predatory Bite: pouncing...';
  if (runtime.phase === 'first_window') return now >= runtime.windowOpensAt ? 'Predatory Bite: F NOW (1/2)' : 'Predatory Bite: wait...';
  if (runtime.phase === 'second_window') return now >= runtime.windowOpensAt ? 'Predatory Bite: F NOW (2/2)' : 'Predatory Bite: hold...';
  return runtime.phase === 'success' ? 'Predatory Bite succeeds.' : 'Predatory Bite failed.';
};

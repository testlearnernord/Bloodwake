import {
  COMBAT_FEED_ELITE_FAILURE_DAMAGE,
  COMBAT_FEED_ELITE_HEALTH_RATIO,
  COMBAT_FEED_ELITE_ROUND_MS,
  COMBAT_FEED_ELITE_ZONE_SIZE,
  COMBAT_FEED_FAILURE_DAMAGE,
  COMBAT_FEED_NORMAL_HEALTH_RATIO,
  COMBAT_FEED_NORMAL_ROUND_MS,
  COMBAT_FEED_NORMAL_ZONE_SIZE,
  COMBAT_FEED_POUNCE_MS,
  COMBAT_FEED_RANGE,
  COMBAT_FEED_SECOND_ROUND_DELAY_MS,
  COMBAT_FEED_VITAE_GAIN,
  COMBAT_FEED_ZONE_MAX_END,
  COMBAT_FEED_ZONE_MIN_START,
} from '../../config/balancing';
import type { EnemyCombatState } from '../../game/combat/combatTypes';
import { SeededRng } from '../../utilities/rng';

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
  roundDurationMs: number;
  successZoneStarts: [number, number];
  successZoneSize: number;
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

const getRoundDurationMs = (elite: boolean): number =>
  elite ? COMBAT_FEED_ELITE_ROUND_MS : COMBAT_FEED_NORMAL_ROUND_MS;

const getZoneSize = (elite: boolean): number =>
  elite ? COMBAT_FEED_ELITE_ZONE_SIZE : COMBAT_FEED_NORMAL_ZONE_SIZE;

const createZoneStart = (rng: SeededRng, zoneSize: number): number => {
  const maxStart = Math.max(COMBAT_FEED_ZONE_MIN_START, COMBAT_FEED_ZONE_MAX_END - zoneSize);
  return COMBAT_FEED_ZONE_MIN_START + rng.next() * (maxStart - COMBAT_FEED_ZONE_MIN_START);
};

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

export const createCombatFeedRuntime = (
  enemyId: string,
  elite: boolean,
  now: number,
  seed: string | number = `${enemyId}:${elite ? 'elite' : 'normal'}:${Math.round(now * 1000)}`,
): CombatFeedRuntime => {
  const rng = new SeededRng(seed);
  const roundDurationMs = getRoundDurationMs(elite);
  const successZoneSize = getZoneSize(elite);
  const firstRoundStartsAt = now + COMBAT_FEED_POUNCE_MS;
  return {
    enemyId,
    elite,
    phase: 'pounce',
    startedAt: now,
    windowOpensAt: firstRoundStartsAt,
    windowClosesAt: firstRoundStartsAt + roundDurationMs,
    successfulInputs: 0,
    roundDurationMs,
    successZoneStarts: [createZoneStart(rng, successZoneSize), createZoneStart(rng, successZoneSize)],
    successZoneSize,
  };
};

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

const getCombatFeedRoundIndex = (runtime: CombatFeedRuntime): 0 | 1 | null => {
  if (runtime.phase === 'first_window') return 0;
  if (runtime.phase === 'second_window') return 1;
  return null;
};

export const getCombatFeedMarkerProgress = (runtime: CombatFeedRuntime, now: number): number => {
  if (getCombatFeedRoundIndex(runtime) === null || now < runtime.windowOpensAt) return 0;
  const duration = Math.max(1, runtime.windowClosesAt - runtime.windowOpensAt);
  return Math.max(0, Math.min(1, (now - runtime.windowOpensAt) / duration));
};

export const isCombatFeedTimingHit = (runtime: CombatFeedRuntime, now: number): boolean => {
  const roundIndex = getCombatFeedRoundIndex(runtime);
  if (roundIndex === null || now < runtime.windowOpensAt || now > runtime.windowClosesAt) return false;
  const markerProgress = getCombatFeedMarkerProgress(runtime, now);
  const zoneStart = runtime.successZoneStarts[roundIndex];
  return markerProgress >= zoneStart && markerProgress <= zoneStart + runtime.successZoneSize;
};

export const pressCombatFeedInput = (runtime: CombatFeedRuntime, now: number): CombatFeedInputResult => {
  const stepped = stepCombatFeedRuntime(runtime, now);
  if (stepped.phase === 'success') return { runtime: stepped, accepted: false, succeeded: true, failed: false };
  if (stepped.phase === 'failure') return { runtime: stepped, accepted: false, succeeded: false, failed: true };
  if (!isCombatFeedTimingHit(stepped, now)) {
    const failed = { ...stepped, phase: 'failure' as const };
    return { runtime: failed, accepted: false, succeeded: false, failed: true };
  }
  if (stepped.phase === 'first_window') {
    const secondRoundStartsAt = now + COMBAT_FEED_SECOND_ROUND_DELAY_MS;
    const next: CombatFeedRuntime = {
      ...stepped,
      phase: 'second_window',
      successfulInputs: 1,
      windowOpensAt: secondRoundStartsAt,
      windowClosesAt: secondRoundStartsAt + stepped.roundDurationMs,
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
  if (runtime.phase === 'first_window' || runtime.phase === 'second_window') {
    if (now < runtime.windowOpensAt) return 'Predatory Bite: next circle incoming...';
    return `Predatory Bite: land F in the green arc (${runtime.successfulInputs + 1}/2).`;
  }
  return runtime.phase === 'success' ? 'Predatory Bite succeeds.' : 'Predatory Bite failed.';
};

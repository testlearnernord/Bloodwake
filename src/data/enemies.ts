import {
  BANDIT_DETECTION_RANGE,
  BANDIT_PREFERRED_DISTANCE,
  BANDIT_SPEED,
  BANDIT_STAGGER_RESISTANCE,
  CLERGY_DETECTION_RANGE,
  CLERGY_PREFERRED_DISTANCE,
  CLERGY_SPEED,
  CLERGY_STAGGER_RESISTANCE,
  ELITE_DETECTION_RANGE,
  ELITE_PREFERRED_DISTANCE,
  ELITE_SPEED,
  ELITE_STAGGER_RESISTANCE,
} from '../config/balancing';
import type { EnemyDefinition, EnemyType } from '../types/models';

export const ENEMIES: EnemyDefinition[] = [
  {
    id: 'bandit',
    name: 'Bandit',
    health: 16,
    speed: BANDIT_SPEED,
    detectionRange: BANDIT_DETECTION_RANGE,
    preferredDistance: BANDIT_PREFERRED_DISTANCE,
    attackIds: ['bandit_slash'],
    poise: BANDIT_STAGGER_RESISTANCE,
    roleLabel: 'Melee raider',
    description: 'Fast opportunist who closes on an angle and swings quickly.',
  },
  {
    id: 'clergy_hunter',
    name: 'Clergy Hunter',
    health: 18,
    speed: CLERGY_SPEED,
    detectionRange: CLERGY_DETECTION_RANGE,
    preferredDistance: CLERGY_PREFERRED_DISTANCE,
    attackIds: ['clergy_holy_bolt'],
    poise: CLERGY_STAGGER_RESISTANCE,
    roleLabel: 'Ranged zealot',
    description: 'Keeps range, channels a holy shot, and retreats when pressed.',
  },
  {
    id: 'elite_knight',
    name: 'Knight-Errant',
    health: 30,
    speed: ELITE_SPEED,
    detectionRange: ELITE_DETECTION_RANGE,
    preferredDistance: ELITE_PREFERRED_DISTANCE,
    attackIds: ['elite_knight_cleave'],
    poise: ELITE_STAGGER_RESISTANCE,
    roleLabel: 'Elite heavy',
    description: 'Armored duelist with an obvious cleave that direction-locks before release.',
    elite: true,
  },
];

export const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy])) as Record<EnemyType, EnemyDefinition>;

import type { DayPhase, JobPriority, QualityLevel, TraitRarity } from '../types/models';

export const TRAIT_RARITY_WEIGHTS: Record<TraitRarity, number> = {
  common: 1,
  uncommon: 0.5,
  rare: 0.2,
  legendary: 0.03,
  negative: 0.6,
};

export const STARTING_TRAIT_RULES = {
  noneChance: 0.1,
  extraTraitChance: 0.55,
  rareUpgradeChance: 0.08,
  legendaryChance: 0.01,
  negativeChance: 0.2,
  maxTraits: 4,
} as const;

export const STARTING_ATTRIBUTE_RANGE = {
  min: 2,
  max: 6,
} as const;

export const INHERITANCE_BALANCING = {
  retainedHumanTraits: 1,
  sireTraits: 2,
  mutationChance: 0.22,
  rareMutationChance: 0.05,
  extraRetainedHumanTraitEffect: 1,
} as const;

export const TURN_COST_VITAE = 3;
export const BITE_RANGE = 60;

export const COMBAT_FEED_RANGE = 112;
export const COMBAT_FEED_NORMAL_HEALTH_RATIO = 0.35;
export const COMBAT_FEED_ELITE_HEALTH_RATIO = 0.2;
export const COMBAT_FEED_VITAE_GAIN = 2;
export const COMBAT_FEED_FAILURE_DAMAGE = 3;
export const COMBAT_FEED_ELITE_FAILURE_DAMAGE = 5;
export const COMBAT_FEED_POUNCE_MS = 180;
export const COMBAT_FEED_NORMAL_ROUND_MS = 1150;
export const COMBAT_FEED_ELITE_ROUND_MS = 850;
export const COMBAT_FEED_NORMAL_ZONE_SIZE = 0.18;
export const COMBAT_FEED_ELITE_ZONE_SIZE = 0.12;
export const COMBAT_FEED_ZONE_MIN_START = 0.18;
export const COMBAT_FEED_ZONE_MAX_END = 0.9;
export const COMBAT_FEED_SECOND_ROUND_DELAY_MS = 220;
export const COMBAT_FEED_KNOCKBACK_SPEED = 250;
export const COMBAT_FEED_KNOCKBACK_MS = 220;

export const PLAYER_VITAE_UPKEEP_PER_DAWN = 1;
export const TARGET_HUMAN_POPULATION = 5;
export const HUMAN_REGIONAL_POOL_TARGET = 8;
export const ESCAPED_HUMAN_RETURN_CHANCE = 0.7;
export const ESCAPED_HUMAN_RETURN_MIN_DAYS = 2;
export const ESCAPED_HUMAN_RETURN_MAX_DAYS = 6;
export const ESCAPED_HUMAN_RETENTION_DAYS = 30;
export const ESCAPED_HUMAN_DORMANT_CAP = 40;

export const HUMAN_BASE_HOUSING_CAPACITY = 2;
export const SERVANT_QUARTERS_HOUSING_CAPACITY = 4;
export const ENTHRALL_VITAE_COST = 1;
export const THRALL_CONTROL_BASE = 55;
export const THRALL_CONTROL_BLOOD_CONTROL_BONUS = 5;
export const THRALL_CONTROL_FEAR_BONUS = 0.2;
export const THRALL_CONTROL_RESOLVE_PENALTY = 6;
export const THRALL_CONTROL_DECAY_BASE = 6;
export const THRALL_CONTROL_DECAY_PER_RESISTANCE = 2;
export const THRALL_REASSERT_CONTROL_GAIN = 35;
export const THRALL_REASSERT_VITAE_COST = 1;
export const THRALL_REASSERT_FEAR_GAIN = 8;
export const THRALL_REASSERT_STRESS_GAIN = 4;
export const THRALL_FOOD_PER_DAY = 1;
export const THRALL_STARVATION_CONTROL_PENALTY = 12;
export const THRALL_STARVATION_STRESS_GAIN = 15;

export const HUMAN_WORK_BALANCING = {
  baseWork: 1,
  professionBonusScale: 0.35,
  skillBonusScale: 0.1,
  traitBonusScale: 0.15,
  controlFloor: 0.35,
  maxStressPenalty: 0.65,
  minimumEfficiency: 0.2,
  maximumEfficiency: 3,
  gatherYieldScale: 2,
  huntingFoodYieldScale: 2,
  leatherEfficiencyThreshold: 1.25,
} as const;

export const PLAYER_MOVE_SPEED = 168;
export const LOCK_RANGE = 280;
export const LOCK_BREAK_RANGE = 360;
export const MIN_ORBIT_RADIUS = 42;

export const DODGE_SPEED = 320;
export const DODGE_DURATION_MS = 220;
export const DODGE_COOLDOWN_MS = 1150;
export const DODGE_INVULNERABLE_MS = 150;

export const LIGHT_WINDUP_MS = 110;
export const LIGHT_ACTIVE_MS = 110;
export const LIGHT_RECOVERY_MS = 180;
export const LIGHT_COOLDOWN_MS = 420;
export const LIGHT_DAMAGE_MULTIPLIER = 1;
export const LIGHT_RANGE = 66;
export const LIGHT_ATTACK_ARC = 92;
export const LIGHT_LUNGE_DISTANCE = 18;
export const LIGHT_STAGGER = 1;
export const LIGHT_HIT_STOP_MS = 40;

export const HEAVY_WINDUP_MS = 280;
export const HEAVY_ACTIVE_MS = 160;
export const HEAVY_RECOVERY_MS = 340;
export const HEAVY_COOLDOWN_MS = 920;
export const HEAVY_DAMAGE_MULTIPLIER = 1.8;
export const HEAVY_DAMAGE_BONUS = 3;
export const HEAVY_RANGE = 82;
export const HEAVY_ATTACK_ARC = 132;
export const HEAVY_LUNGE_DISTANCE = 28;
export const HEAVY_VITAE_COST = 1;
export const HEAVY_STAGGER = 3;
export const HEAVY_HIT_STOP_MS = 80;
export const HEAVY_CAMERA_SHAKE = 0.004;

export const RANGED_WINDUP_MS = 240;
export const RANGED_RELEASE_MS = 70;
export const RANGED_RECOVERY_MS = 220;
export const BLOOD_LANCE_VITAE_COST = 2;
export const BLOOD_LANCE_COOLDOWN_MS = 1800;
export const BLOOD_LANCE_SPEED = 360;
export const BLOOD_LANCE_LIFETIME_MS = 1200;
export const BLOOD_LANCE_MAX_RANGE = 360;
export const BLOOD_LANCE_COLLISION_RADIUS = 18;
export const BLOOD_LANCE_DAMAGE = 7;
export const BLOOD_LANCE_STAGGER = 1;
export const BLOOD_LANCE_HIT_STOP_MS = 25;
export const BLOOD_LANCE_SHAKE = 0.002;

export const HIT_FLASH_MS = 120;
export const DAMAGE_NUMBER_LIFETIME_MS = 750;
export const PLAYER_HURT_FLASH_MS = 180;
export const PLAYER_HEALTH_LAG_MS = 380;
export const TARGET_HEALTH_LAG_MS = 240;
export const VITAE_PULSE_MS = 260;
export const DEATH_FADE_MS = 900;
export const COFFIN_RESPAWN_FADE_MS = 520;

export const BANDIT_RANGE = 62;
export const BANDIT_PREFERRED_DISTANCE = 54;
export const BANDIT_WINDUP_MS = 260;
export const BANDIT_ACTIVE_MS = 130;
export const BANDIT_RECOVERY_MS = 280;
export const BANDIT_COOLDOWN_MS = 820;
export const BANDIT_DAMAGE = 3;
export const BANDIT_DETECTION_RANGE = 220;
export const BANDIT_SPEED = 78;
export const BANDIT_STAGGER_RESISTANCE = 0;

export const CLERGY_RANGE = 230;
export const CLERGY_PREFERRED_DISTANCE = 180;
export const CLERGY_WINDUP_MS = 420;
export const CLERGY_ACTIVE_MS = 40;
export const CLERGY_RECOVERY_MS = 340;
export const CLERGY_COOLDOWN_MS = 1200;
export const CLERGY_DAMAGE = 4;
export const CLERGY_DETECTION_RANGE = 260;
export const CLERGY_SPEED = 70;
export const CLERGY_RETREAT_RANGE = 118;
export const CLERGY_STAGGER_RESISTANCE = 1;

export const ELITE_RANGE = 94;
export const ELITE_PREFERRED_DISTANCE = 80;
export const ELITE_WINDUP_MS = 560;
export const ELITE_ACTIVE_MS = 180;
export const ELITE_RECOVERY_MS = 420;
export const ELITE_COOLDOWN_MS = 1350;
export const ELITE_DAMAGE = 7;
export const ELITE_DETECTION_RANGE = 240;
export const ELITE_SPEED = 58;
export const ELITE_DIRECTION_LOCK_MS = 180;
export const ELITE_STAGGER_RESISTANCE = 3;
export const ELITE_HEAVY_STAGGER_BONUS = 2;

export const JOB_PRIORITY_WEIGHT: Record<JobPriority, number> = {
  Disabled: 0,
  Low: 1,
  Normal: 2,
  High: 3,
  Critical: 5,
};

export const QUALITY_ORDER: QualityLevel[] = ['Poor', 'Common', 'Fine', 'Masterwork'];

export const QUALITY_SCORE_THRESHOLDS = [
  { min: 0, quality: 'Poor' },
  { min: 5, quality: 'Common' },
  { min: 8, quality: 'Fine' },
  { min: 11, quality: 'Masterwork' },
] as const satisfies ReadonlyArray<{ min: number; quality: QualityLevel }>;

export const WORK_PHASES: Record<'human' | 'vampire', DayPhase[]> = {
  human: ['day'],
  vampire: ['night'],
};

export const DEFAULT_SETTINGS = {
  volume: 0.6,
  uiScale: 1,
} as const;

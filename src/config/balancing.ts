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
export const FEED_VITAE_GAIN = 2;
export const DRAIN_ESSENCE_GAIN = 1;
export const BITE_RANGE = 60;

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

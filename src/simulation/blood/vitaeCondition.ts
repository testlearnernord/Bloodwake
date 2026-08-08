export type VitaeCondition = 'Sated' | 'Thirsty' | 'Starved' | 'Bloodless';

export interface VitaeConditionEffects {
  attackMultiplier: number;
  movementMultiplier: number;
}

export const VITAE_CONDITION_EFFECTS: Readonly<Record<VitaeCondition, VitaeConditionEffects>> = {
  Sated: { attackMultiplier: 1, movementMultiplier: 1 },
  Thirsty: { attackMultiplier: 0.9, movementMultiplier: 0.95 },
  Starved: { attackMultiplier: 0.75, movementMultiplier: 0.85 },
  Bloodless: { attackMultiplier: 0.6, movementMultiplier: 0.75 },
};

export const getVitaeRatio = (vitae: number, maxVitae: number): number => {
  if (!Number.isFinite(maxVitae) || maxVitae <= 0) return 0;
  const safeVitae = Number.isFinite(vitae) ? Math.max(0, vitae) : 0;
  return Math.min(1, safeVitae / maxVitae);
};

export const getVitaeCondition = (vitae: number, maxVitae: number): VitaeCondition => {
  if (!Number.isFinite(vitae) || vitae <= 0 || !Number.isFinite(maxVitae) || maxVitae <= 0) return 'Bloodless';
  const ratio = getVitaeRatio(vitae, maxVitae);
  if (ratio < 0.25) return 'Starved';
  if (ratio < 0.5) return 'Thirsty';
  return 'Sated';
};

export const getVitaeConditionEffects = (vitae: number, maxVitae: number): VitaeConditionEffects =>
  VITAE_CONDITION_EFFECTS[getVitaeCondition(vitae, maxVitae)];

export const getVitaeConditionDescription = (vitae: number, maxVitae: number): string => {
  const condition = getVitaeCondition(vitae, maxVitae);
  const effects = VITAE_CONDITION_EFFECTS[condition];
  if (condition === 'Sated') return 'Blood reserves are healthy. No penalties.';
  const attackPenalty = Math.round((1 - effects.attackMultiplier) * 100);
  const movementPenalty = Math.round((1 - effects.movementMultiplier) * 100);
  if (condition === 'Bloodless') {
    return `Bloodless: -${attackPenalty}% attack damage, -${movementPenalty}% movement. Vitae abilities require blood.`;
  }
  const prefix = condition === 'Starved' ? 'Severe blood thirst' : 'Low blood reserves';
  return `${prefix}: -${attackPenalty}% attack damage, -${movementPenalty}% movement.`;
};

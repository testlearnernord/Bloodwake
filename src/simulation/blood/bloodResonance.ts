import type { BloodResonance } from '../../types/models';
import type { SeededRng } from '../../utilities/rng';

export const BLOOD_RESONANCE_WEIGHTS = [
  { resonance: 1, weight: 35 },
  { resonance: 2, weight: 35 },
  { resonance: 3, weight: 20 },
  { resonance: 4, weight: 8 },
  { resonance: 5, weight: 2 },
] as const satisfies ReadonlyArray<{ resonance: BloodResonance; weight: number }>;

export const BLOOD_RESONANCE_LABELS: Record<BloodResonance, string> = {
  1: 'Thin',
  2: 'Common',
  3: 'Rich',
  4: 'Potent',
  5: 'Exceptional',
};

export const rollBloodResonance = (rng: SeededRng): BloodResonance =>
  rng.weightedPick(BLOOD_RESONANCE_WEIGHTS).resonance;

export const getBloodResonanceLabel = (resonance: BloodResonance): string =>
  BLOOD_RESONANCE_LABELS[resonance];

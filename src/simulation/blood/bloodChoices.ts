import type { BloodResonance, HumanCharacter, SaveGame } from '../../types/models';
import { applyFeedGainEffects } from '../traits/traitEffects';
import { getTraitEffectIds } from '../traits/traitUtils';

export type BloodChoiceMode = 'feed' | 'drain';

export interface BloodChoiceOutcome {
  nominalVitaeGain: number;
  actualVitaeGain: number;
  bloodEssenceGain: number;
  targetSurvives: boolean;
}

export const getFeedBaseVitaeGain = (resonance: BloodResonance): number =>
  1 + Math.ceil(resonance / 2);

export const getDrainVitaeGain = (resonance: BloodResonance): number =>
  2 + resonance;

export const getDrainBloodEssenceGain = (resonance: BloodResonance): number =>
  resonance >= 4 ? 2 : 1;

export const calculateBloodChoiceOutcome = (
  state: Pick<SaveGame, 'player'>,
  human: Pick<HumanCharacter, 'bloodResonance'>,
  mode: BloodChoiceMode,
): BloodChoiceOutcome => {
  const nominalVitaeGain = mode === 'feed'
    ? applyFeedGainEffects(getFeedBaseVitaeGain(human.bloodResonance), getTraitEffectIds(state.player.traitIds))
    : getDrainVitaeGain(human.bloodResonance);
  const missingVitae = Math.max(0, state.player.maxVitae - state.player.vitae);
  return {
    nominalVitaeGain,
    actualVitaeGain: Math.min(nominalVitaeGain, missingVitae),
    bloodEssenceGain: mode === 'drain' ? getDrainBloodEssenceGain(human.bloodResonance) : 0,
    targetSurvives: mode === 'feed',
  };
};

export const getBloodChoicePreview = (
  state: Pick<SaveGame, 'player'>,
  human: Pick<HumanCharacter, 'bloodResonance'>,
  mode: BloodChoiceMode,
): string => {
  const outcome = calculateBloodChoiceOutcome(state, human, mode);
  const capped = outcome.actualVitaeGain < outcome.nominalVitaeGain
    ? ` (cap; ${outcome.nominalVitaeGain} available)`
    : '';
  if (mode === 'feed') {
    return `+${outcome.actualVitaeGain} Vitae${capped} · Target survives · unavailable until next night`;
  }
  return `+${outcome.actualVitaeGain} Vitae${capped} · +${outcome.bloodEssenceGain} Blood Essence · Target dies`;
};

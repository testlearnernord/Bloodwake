import { FEED_VITAE_GAIN, INHERITANCE_BALANCING } from '../../config/balancing';
import type { TraitEffectId } from '../../types/models';

export const traitEffectHandlers: Record<
  TraitEffectId,
  {
    modifyRetainedHumanTraits?: (value: number) => number;
    modifyFeedGain?: (value: number) => number;
    dayPenalty?: () => number;
  }
> = {
  retain_extra_human_trait: {
    modifyRetainedHumanTraits: (value) => value + INHERITANCE_BALANCING.extraRetainedHumanTraitEffect,
  },
  feed_bonus: {
    modifyFeedGain: (value) => value + 1,
  },
  day_restriction_penalty: {
    dayPenalty: () => 1,
  },
};

export const applyFeedGainEffects = (effectIds: TraitEffectId[]): number =>
  effectIds.reduce<number>(
    (value, effectId) => traitEffectHandlers[effectId].modifyFeedGain?.(value) ?? value,
    FEED_VITAE_GAIN,
  );

export const applyRetainedTraitEffects = (effectIds: TraitEffectId[]): number =>
  effectIds.reduce<number>(
    (value, effectId) => traitEffectHandlers[effectId].modifyRetainedHumanTraits?.(value) ?? value,
    INHERITANCE_BALANCING.retainedHumanTraits,
  );

export const getDayRestrictionPenalty = (effectIds: TraitEffectId[]): number =>
  effectIds.reduce<number>((value, effectId) => value + (traitEffectHandlers[effectId].dayPenalty?.() ?? 0), 0);

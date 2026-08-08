import { getDayRestrictionPenalty } from '../traits/traitEffects';
import { getTraitEffectIds } from '../traits/traitUtils';
import type { DayPhase, VampireCharacter, VampireVassal } from '../../types/models';

export const togglePhase = (phase: DayPhase): DayPhase => (phase === 'night' ? 'day' : 'night');

export const canPlayerExplore = (phase: DayPhase): boolean => phase === 'night';

export const applyDayRestriction = (player: VampireCharacter, phase: DayPhase): VampireCharacter => {
  if (phase === 'night') return player;
  const penalty = getDayRestrictionPenalty(getTraitEffectIds(player.traitIds));
  return { ...player, health: Math.max(1, player.health - penalty) };
};

export const vassalCanWork = (vassal: VampireVassal, phase: DayPhase): boolean =>
  vassal.kind === 'vampire_vassal' && phase === 'night';

import type { SaveGame, VampireVassal } from '../../types/models';

export interface DominionSummary {
  capacity: number;
  activeCost: number;
  strain: number;
  activeVassals: number;
  torpidVassals: number;
}

export const getDominionCapacity = (state: Pick<SaveGame, 'player'>): number =>
  Math.max(1, 1 + Math.floor((state.player.attributes.bloodControl + state.player.attributes.presence) / 4));

export const getVassalDominionCost = (vassal: VampireVassal): number => vassal.state === 'active' ? 1 : 0;

export const getDominionSummary = (state: Pick<SaveGame, 'player' | 'vampireVassals'>): DominionSummary => {
  const capacity = getDominionCapacity(state as Pick<SaveGame, 'player'>);
  const activeCost = state.vampireVassals.reduce((sum, vassal) => sum + getVassalDominionCost(vassal), 0);
  return {
    capacity,
    activeCost,
    strain: Math.max(0, activeCost - capacity),
    activeVassals: state.vampireVassals.filter((vassal) => vassal.state === 'active').length,
    torpidVassals: state.vampireVassals.filter((vassal) => vassal.state === 'torpor').length,
  };
};

export const setVassalTorpor = (
  state: SaveGame,
  vassalId: string,
  torpor: boolean,
): { state: SaveGame; message: string } => {
  const vassal = state.vampireVassals.find((candidate) => candidate.id === vassalId);
  if (!vassal) return { state, message: 'Vampire Vassal not found.' };
  const nextState = torpor ? 'torpor' : 'active';
  if (vassal.state === nextState) {
    return { state, message: `${vassal.name} is already ${torpor ? 'in Torpor' : 'active'}.` };
  }
  const updated: VampireVassal = {
    ...vassal,
    state: nextState,
    torporSinceDay: torpor ? state.time.day : null,
    currentJob: null,
    currentTask: null,
    taskReason: torpor ? 'In Torpor. No orders, work, or Dominion cost.' : 'Awakened and awaiting orders.',
  };
  return {
    state: {
      ...state,
      vampireVassals: state.vampireVassals.map((candidate) => candidate.id === vassalId ? updated : candidate),
      lastEventLog: [`${vassal.name} ${torpor ? 'entered Torpor' : 'awoke from Torpor'}.`, ...state.lastEventLog],
    },
    message: torpor
      ? `${vassal.name} entered Torpor and no longer consumes Dominion.`
      : `${vassal.name} awoke and again consumes Dominion.`,
  };
};

import { ROOMS_BY_ID } from '../../data/rooms';
import type { BuiltRoom, SaveGame, VampireVassal } from '../../types/models';

export interface DominionSummary {
  baseCapacity: number;
  cryptCapacity: number;
  capacity: number;
  activeCost: number;
  strain: number;
  strainState: DominionStrainState;
  activeVassals: number;
  torpidVassals: number;
}

export type DominionStrainState = 'Stable' | 'Strained' | 'Overextended' | 'Fractured';

export interface DominionStrainResult {
  vampireVassals: VampireVassal[];
  events: string[];
  summary: DominionSummary;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const getDominionBaseCapacity = (state: Pick<SaveGame, 'player'>): number =>
  Math.max(1, 1 + Math.floor((state.player.attributes.bloodControl + state.player.attributes.presence) / 4));

export const getVassalCryptCapacity = (rooms: BuiltRoom[]): number =>
  rooms
    .filter((room) => room.status === 'built')
    .reduce((sum, room) => sum + (ROOMS_BY_ID[room.roomId]?.dominionCapacity ?? 0), 0);

export const getDominionCapacity = (state: Pick<SaveGame, 'player' | 'rooms'>): number =>
  getDominionBaseCapacity(state) + getVassalCryptCapacity(state.rooms);

export const getVassalDominionCost = (vassal: VampireVassal): number => vassal.state === 'active' ? 1 : 0;

export const getDominionStrainState = (strain: number): DominionStrainState => {
  if (strain <= 0) return 'Stable';
  if (strain === 1) return 'Strained';
  if (strain <= 3) return 'Overextended';
  return 'Fractured';
};

export const getDominionSummary = (state: Pick<SaveGame, 'player' | 'rooms' | 'vampireVassals'>): DominionSummary => {
  const baseCapacity = getDominionBaseCapacity(state);
  const cryptCapacity = getVassalCryptCapacity(state.rooms);
  const capacity = baseCapacity + cryptCapacity;
  const activeCost = state.vampireVassals.reduce((sum, vassal) => sum + getVassalDominionCost(vassal), 0);
  const strain = Math.max(0, activeCost - capacity);
  return {
    baseCapacity,
    cryptCapacity,
    capacity,
    activeCost,
    strain,
    strainState: getDominionStrainState(strain),
    activeVassals: state.vampireVassals.filter((vassal) => vassal.state === 'active').length,
    torpidVassals: state.vampireVassals.filter((vassal) => vassal.state === 'torpor').length,
  };
};

/**
 * Temporary daily settlement hook. The authority is the derived Dominion state, not the phase button.
 * 0.6.5a will trigger the same resolver from continuous world time.
 */
export const resolveDominionStrain = (
  state: Pick<SaveGame, 'player' | 'rooms' | 'vampireVassals'>,
): DominionStrainResult => {
  const summary = getDominionSummary(state);
  if (summary.strain <= 0) {
    return { vampireVassals: state.vampireVassals, events: [], summary };
  }
  const loyaltyLoss = summary.strain * 2;
  const stressGain = summary.strain * 4;
  const vampireVassals = state.vampireVassals.map((vassal) =>
    vassal.state === 'active'
      ? {
          ...vassal,
          loyalty: clamp(vassal.loyalty - loyaltyLoss, 0, 100),
          stress: clamp(vassal.stress + stressGain, 0, 100),
        }
      : vassal,
  );
  return {
    vampireVassals,
    summary,
    events: [
      `Dominion ${summary.strainState}: Strain ${summary.strain} costs each active Vassal ${loyaltyLoss} Loyalty and adds ${stressGain} Stress.`,
    ],
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
    operationalOrder: torpor ? { type: 'none', issuedDay: null } : vassal.operationalOrder,
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

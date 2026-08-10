import type { SaveGame, TaskCandidate, VampireVassal, VassalOperationalOrderType } from '../../types/models';
import { SeededRng } from '../../utilities/rng';
import { getVassalPoliticalProfile } from './vassalPolitics';

export const VASSAL_OPERATIONAL_ORDER_TYPES: VassalOperationalOrderType[] = [
  'none',
  'guard',
  'companion',
  'scout',
  'hunt',
  'raid',
];

export interface VassalOperationalOrderDefinition {
  type: VassalOperationalOrderType;
  label: string;
  description: string;
  complianceModifier: number;
}

const DEFINITIONS: Record<VassalOperationalOrderType, VassalOperationalOrderDefinition> = {
  none: {
    type: 'none',
    label: 'Stronghold Duties',
    description: 'No field operation. The Vassal follows ordinary Stronghold work priorities.',
    complianceModifier: 100,
  },
  guard: {
    type: 'guard',
    label: 'Guard Stronghold',
    description: 'Hold a Stronghold guard post and engage intruders with shared Vassal combat.',
    complianceModifier: 20,
  },
  companion: {
    type: 'companion',
    label: 'Companion',
    description: 'Remain with the Vampire Lord and prioritize threats around the player.',
    complianceModifier: 10,
  },
  scout: {
    type: 'scout',
    label: 'Scout',
    description: 'Range ahead, favor information and survival, and avoid unfavorable engagements.',
    complianceModifier: 0,
  },
  hunt: {
    type: 'hunt',
    label: 'Hunt',
    description: 'Seek prey in the surrounding region and accept moderate combat risk.',
    complianceModifier: -5,
  },
  raid: {
    type: 'raid',
    label: 'Raid',
    description: 'Conduct an aggressive hostile operation with a high expectation of combat.',
    complianceModifier: -20,
  },
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const getVassalOperationalOrderDefinition = (type: VassalOperationalOrderType): VassalOperationalOrderDefinition => DEFINITIONS[type];
export const getVassalOrderLabel = (type: VassalOperationalOrderType): string => DEFINITIONS[type].label;

export const getVassalOrderComplianceChance = (vassal: VampireVassal, type: VassalOperationalOrderType): number => {
  if (type === 'none') return 1;
  const politics = getVassalPoliticalProfile(vassal);
  return clamp((politics.obedience + DEFINITIONS[type].complianceModifier) / 100, 0.05, 1);
};

export const getVassalOperationalTask = (vassal: VampireVassal): TaskCandidate | null => {
  const type = vassal.operationalOrder.type;
  if (type === 'none') return null;
  if (type === 'guard') {
    return {
      id: 'vassal-order:guard',
      type: 'guard_stronghold',
      jobType: 'Guarding',
      score: 1000,
      reason: 'Operational order: hold a Stronghold guard post.',
      operationalOrderType: type,
    };
  }
  if (type === 'companion') {
    return {
      id: 'vassal-order:companion',
      type: 'vassal_companion',
      jobType: 'Guarding',
      score: 1000,
      reason: 'Operational order: remain close to the Vampire Lord.',
      operationalOrderType: type,
    };
  }
  if (type === 'scout') {
    return {
      id: 'vassal-order:scout',
      type: 'vassal_scout',
      jobType: 'Hunting',
      score: 1000,
      reason: 'Operational order: scout the outer region and avoid needless risk.',
      operationalOrderType: type,
    };
  }
  if (type === 'hunt') {
    return {
      id: 'vassal-order:hunt',
      type: 'vassal_hunt',
      jobType: 'Hunting',
      score: 1000,
      reason: 'Operational order: hunt in the surrounding region.',
      operationalOrderType: type,
    };
  }
  return {
    id: 'vassal-order:raid',
    type: 'vassal_raid',
    jobType: 'Guarding',
    score: 1000,
    reason: 'Operational order: stage an aggressive raid.',
    operationalOrderType: type,
  };
};

export const issueVassalOperationalOrder = (
  state: SaveGame,
  vassalId: string,
  type: VassalOperationalOrderType,
): { state: SaveGame; accepted: boolean; message: string } => {
  const vassal = state.vampireVassals.find((candidate) => candidate.id === vassalId);
  if (!vassal) return { state, accepted: false, message: 'Vampire Vassal not found.' };
  if (vassal.operationalOrder.type === type) {
    return { state, accepted: true, message: `${vassal.name} already has the ${getVassalOrderLabel(type)} order.` };
  }

  if (type !== 'none' && vassal.state === 'torpor') {
    return { state, accepted: false, message: `${vassal.name} is in Torpor and cannot receive operational orders.` };
  }

  const politics = getVassalPoliticalProfile(vassal);
  const complianceChance = getVassalOrderComplianceChance(vassal, type);
  const accepted = type === 'none'
    || new SeededRng(`${state.seed}:vassal-order:${state.time.day}:${vassal.id}:${type}`).chance(complianceChance);

  if (!accepted) {
    return {
      state,
      accepted: false,
      message: `${vassal.name} refuses ${getVassalOrderLabel(type)} (${Math.round(complianceChance * 100)}% compliance; ${politics.stance}).`,
    };
  }

  const updated: VampireVassal = {
    ...vassal,
    operationalOrder: {
      type,
      issuedDay: type === 'none' ? null : state.time.day,
    },
    currentJob: null,
    currentTask: null,
    taskReason: type === 'none'
      ? 'Operational order cleared. Returning to Stronghold priorities.'
      : `Operational order: ${getVassalOrderLabel(type)}.`,
  };
  const message = type === 'none'
    ? `${vassal.name} returns to ordinary Stronghold duties.`
    : `${vassal.name} accepts the ${getVassalOrderLabel(type)} order.`;
  return {
    state: {
      ...state,
      vampireVassals: state.vampireVassals.map((candidate) => candidate.id === vassalId ? updated : candidate),
      lastEventLog: [`[Order] ${message}`, ...state.lastEventLog].slice(0, 20),
    },
    accepted: true,
    message,
  };
};

import { TURN_COST_VITAE } from '../../config/balancing';
import type { HumanCharacter, HumanServant, SaveGame } from '../../types/models';
import { inheritVampire } from '../bloodlines/inheritance';
import { createVampireVassal } from './vampireVassals';

export interface ThrallElevationResult {
  state: SaveGame;
  message: string;
  inheritanceSummary?: string;
}

const humanSnapshotFromThrall = (state: SaveGame, thrall: HumanServant): HumanCharacter | null => {
  const identity = state.npcs.find((human) => human.id === thrall.id);
  if (!identity) return null;
  return {
    ...identity,
    name: thrall.name,
    familyName: thrall.familyName,
    age: thrall.age,
    professionId: thrall.professionId,
    attributes: { ...thrall.attributes },
    traitIds: [...thrall.traitIds],
    factionId: thrall.factionId,
    bloodResonance: thrall.bloodResonance,
    resolve: thrall.resolve,
    disposition: thrall.disposition,
    fear: thrall.fear,
    relationships: { ...thrall.relationships },
    health: thrall.health,
    maxHealth: thrall.maxHealth,
    stress: thrall.stress,
    combat: thrall.combat,
    status: 'enthralled',
  };
};

export const validateElevateThrall = (
  state: SaveGame,
  thrall: HumanServant | undefined,
): { ok: true } | { ok: false; reason: string } => {
  if (!thrall) return { ok: false, reason: 'Human thrall not found.' };
  if (state.player.vitae < TURN_COST_VITAE) return { ok: false, reason: `Elevation requires ${TURN_COST_VITAE} Vitae.` };
  const identity = state.npcs.find((human) => human.id === thrall.id);
  if (!identity || identity.status !== 'enthralled') return { ok: false, reason: 'The captive identity is no longer available for elevation.' };
  if (state.vampireVassals.some((vassal) => vassal.id === `vampire-${thrall.id}`)) return { ok: false, reason: 'This bloodline already contains that vassal.' };
  return { ok: true };
};

export const elevateThrallToVassal = (state: SaveGame, thrallId: string): ThrallElevationResult => {
  const thrall = state.humanServants.find((candidate) => candidate.id === thrallId);
  const validation = validateElevateThrall(state, thrall);
  if (!validation.ok || !thrall) return { state, message: validation.ok ? 'Human thrall not found.' : validation.reason };
  const human = humanSnapshotFromThrall(state, thrall);
  if (!human) return { state, message: 'The captive identity is missing.' };

  const inherited = inheritVampire(
    state.player,
    human,
    `${state.seed}-thrall-elevation-${state.time.day}`,
    thrall.professionSkills,
  );
  const vassal = {
    ...createVampireVassal(inherited.vampire),
    equipped: { ...thrall.equipped },
  };

  const nextState: SaveGame = {
    ...state,
    player: { ...state.player, vitae: state.player.vitae - TURN_COST_VITAE },
    npcs: state.npcs.map((candidate) =>
      candidate.id === thrall.id
        ? {
            ...candidate,
            status: 'turned' as const,
            fear: thrall.fear,
            disposition: thrall.disposition,
            stress: thrall.stress,
            health: thrall.health,
          }
        : candidate,
    ),
    humanServants: state.humanServants.filter((candidate) => candidate.id !== thrall.id),
    vampireVassals: [...state.vampireVassals, vassal],
    inheritanceHistory: [inherited.report, ...state.inheritanceHistory],
    lastEventLog: [
      `Elevated ${thrall.name} ${thrall.familyName} from mortal thrall to vampire vassal.`,
      ...state.lastEventLog,
    ].slice(0, 20),
  };

  return {
    state: nextState,
    message: `${thrall.name} ${thrall.familyName} rises as a vampire vassal.`,
    inheritanceSummary: `Retained ${inherited.report.retainedTraits.join(', ') || 'no mortal traits'}; inherited ${inherited.report.inheritedTraits.join(', ') || 'no sire traits'}; mutations ${inherited.report.mutations.join(', ') || 'none'}.`,
  };
};

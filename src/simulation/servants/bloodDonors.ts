import { PROFESSIONS_BY_ID } from '../../data/professions';
import type { BloodDonor, HumanServant, SaveGame } from '../../types/models';
import { getAvailableBloodCellar } from '../blood/bloodStock';

export type BloodDonorValidation =
  | { ok: true; roomInstanceId: string }
  | { ok: false; reason: string };

export const validateBindThrallAsBloodDonor = (
  state: SaveGame,
  servant: HumanServant | undefined,
): BloodDonorValidation => {
  if (!servant || !state.humanServants.some((candidate) => candidate.id === servant.id)) {
    return { ok: false, reason: 'Human Thrall is not available.' };
  }
  if (servant.health <= 0) {
    return { ok: false, reason: 'A dead or dying Thrall cannot be bound as a donor.' };
  }
  const backingHuman = state.npcs.find((human) => human.id === servant.id);
  if (!backingHuman) {
    return { ok: false, reason: 'The Thrall has no persisted human identity.' };
  }
  const cellar = getAvailableBloodCellar(state.rooms, state.bloodDonors);
  if (!cellar) {
    const hasBuiltCellar = state.rooms.some((room) => room.roomId === 'blood_cellar' && room.status === 'built');
    return {
      ok: false,
      reason: hasBuiltCellar ? 'All Blood Donor slots are occupied.' : 'Build a Blood Cellar before binding donors.',
    };
  }
  return { ok: true, roomInstanceId: cellar.id };
};

export const bindThrallAsBloodDonor = (
  state: SaveGame,
  servantId: string,
): { state: SaveGame; message: string } => {
  const servant = state.humanServants.find((candidate) => candidate.id === servantId);
  const validation = validateBindThrallAsBloodDonor(state, servant);
  if (!validation.ok || !servant) {
    return { state, message: validation.ok ? 'Human Thrall is not available.' : validation.reason };
  }

  const donorOnlyKeys = new Set(['kind', 'priorities', 'currentJob', 'currentTask', 'taskReason']);
  const preserved = Object.fromEntries(
    Object.entries(servant).filter(([key]) => !donorOnlyKeys.has(key)),
  ) as Omit<HumanServant, 'kind' | 'priorities' | 'currentJob' | 'currentTask' | 'taskReason'>;
  const donor: BloodDonor = {
    ...preserved,
    kind: 'blood_donor',
    boundRoomInstanceId: validation.roomInstanceId,
    boundAtDay: state.time.day,
    donorStatus: 'bound',
  };
  const professionName = PROFESSIONS_BY_ID[servant.professionId].name;

  return {
    state: {
      ...state,
      humanServants: state.humanServants.filter((candidate) => candidate.id !== servantId),
      bloodDonors: [...state.bloodDonors, donor],
      npcs: state.npcs.map((human) => human.id === servantId
        ? {
            ...human,
            status: 'donor' as const,
            worldPresence: 'dormant' as const,
            dormantReason: 'captured' as const,
            dormantSinceDay: state.time.day,
            scheduledReturnDay: null,
            lastSeenDay: state.time.day,
          }
        : human),
      lastEventLog: [
        `${servant.name} ${servant.familyName} was permanently bound to the Blood Cellar as a donor. Their ${professionName} labor is lost.`,
        ...state.lastEventLog,
      ],
    },
    message: `${servant.name} is permanently bound as a Blood Donor. They can no longer perform ordinary work.`,
  };
};

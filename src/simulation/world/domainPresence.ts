import type { HumanServant, SaveGame, VampireVassal } from '../../types/models';

export type DomainPopulationKind = 'human_thrall' | 'vampire_vassal';

export interface DomainPopulationAnchor {
  x: number;
  y: number;
}

export const getDomainPopulationIds = (
  state: Pick<SaveGame, 'humanServants' | 'vampireVassals'>,
  kind: DomainPopulationKind,
): string[] => kind === 'human_thrall'
  ? state.humanServants.map((thrall) => thrall.id)
  : state.vampireVassals.map((vassal) => vassal.id);

export const getDomainPopulationAnchor = (kind: DomainPopulationKind, index: number): DomainPopulationAnchor => {
  const safeIndex = Math.max(0, Math.floor(index));
  if (kind === 'human_thrall') {
    const columns = 4;
    return {
      x: 55 + (safeIndex % columns) * 68,
      y: 455 + (Math.floor(safeIndex / columns) % 3) * 46,
    };
  }
  const columns = 3;
  return {
    x: 65 + (safeIndex % columns) * 82,
    y: 602 + (Math.floor(safeIndex / columns) % 2) * 44,
  };
};

export const getHumanThrallPresenceLabel = (thrall: HumanServant): string =>
  thrall.currentJob ? `Thrall · ${thrall.currentJob}` : 'Thrall · Idle';

export const getVassalPresenceLabel = (vassal: VampireVassal): string =>
  vassal.currentJob ? `Vassal · ${vassal.currentJob}` : 'Vassal · Idle';

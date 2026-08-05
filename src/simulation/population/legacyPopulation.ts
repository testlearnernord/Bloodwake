/**
 * Pure conversion helpers for migrating legacy Servant records into explicit
 * HumanServant or VampireVassal population types.
 *
 * These functions are preparation for the save-v4 migration (Milestone 0.6.1b).
 * They must not be called in production runtime yet, and must not mutate their
 * source objects.
 */

import type { HumanServant, Servant, VampireVassal } from '../../types/models';

export class InvalidServantTypeError extends Error {
  constructor(type: string) {
    super(`Cannot convert servant with unknown type: "${type}"`);
    this.name = 'InvalidServantTypeError';
  }
}

/**
 * Converts a legacy human Servant into a HumanServant.
 * Clones all nested mutable objects so the source is never mutated.
 * @throws {InvalidServantTypeError} if the servant type is not "human".
 */
export const convertLegacyHumanServant = (servant: Servant): HumanServant => {
  if (servant.type !== 'human') {
    throw new InvalidServantTypeError(servant.type);
  }
  return {
    kind: 'human_servant',
    id: servant.id,
    name: servant.name,
    age: servant.age,
    professionId: servant.professionId,
    attributes: { ...servant.attributes },
    traitIds: [...servant.traitIds],
    health: servant.health,
    maxHealth: servant.maxHealth,
    morale: servant.morale,
    loyalty: servant.loyalty,
    stress: servant.stress,
    priorities: { ...servant.priorities },
    currentJob: servant.currentJob,
    currentTask: servant.currentTask,
    taskReason: servant.taskReason,
    equipped: { ...servant.equipped },
  };
};

/**
 * Converts a legacy vampire Servant into a VampireVassal.
 * Clones all nested mutable objects so the source is never mutated.
 *
 * Note: the legacy Servant type does not carry distinct vitae/maxVitae fields.
 * A starter vitae of 2 and maxVitae of 8 are used as the canonical fledgling
 * defaults (matching the values set in bite.ts at turning time).
 * @throws {InvalidServantTypeError} if the servant type is not "vampire".
 */
export const convertLegacyVampireVassal = (servant: Servant): VampireVassal => {
  if (servant.type !== 'vampire') {
    throw new InvalidServantTypeError(servant.type);
  }
  return {
    kind: 'vampire_vassal',
    id: servant.id,
    name: servant.name,
    age: servant.age,
    professionId: servant.professionId,
    attributes: { ...servant.attributes },
    traitIds: [...servant.traitIds],
    health: servant.health,
    maxHealth: servant.maxHealth,
    morale: servant.morale,
    loyalty: servant.loyalty,
    ambition: servant.ambition,
    stress: servant.stress,
    combat: servant.combat,
    vitae: 2,
    maxVitae: 8,
    hunger: servant.hunger,
    priorities: { ...servant.priorities },
    currentJob: servant.currentJob,
    currentTask: servant.currentTask,
    taskReason: servant.taskReason,
    equipped: { ...servant.equipped },
  };
};

export interface SplitLegacyServantsResult {
  humanServants: HumanServant[];
  vampireVassals: VampireVassal[];
}

/**
 * Splits a mixed legacy Servant array into separate HumanServant and
 * VampireVassal arrays, preserving original input order within each group.
 * @throws {InvalidServantTypeError} on any servant with an unknown type.
 */
export const splitLegacyServants = (servants: Servant[]): SplitLegacyServantsResult => {
  const humanServants: HumanServant[] = [];
  const vampireVassals: VampireVassal[] = [];
  for (const servant of servants) {
    if (servant.type === 'human') {
      humanServants.push(convertLegacyHumanServant(servant));
    } else if (servant.type === 'vampire') {
      vampireVassals.push(convertLegacyVampireVassal(servant));
    } else {
      throw new InvalidServantTypeError(servant.type);
    }
  }
  return { humanServants, vampireVassals };
};

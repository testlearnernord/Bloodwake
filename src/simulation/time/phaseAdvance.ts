import { PLAYER_VITAE_UPKEEP_PER_DAWN, TARGET_HUMAN_POPULATION } from '../../config/balancing';
import type { DayPhase, SaveGame } from '../../types/models';
import { runWorkShift } from '../servants/production';
import { getDayRestrictionPenalty } from '../traits/traitEffects';
import { getTraitEffectIds } from '../traits/traitUtils';
import { markHumanEscaped, resolveNightlyHumanPopulation } from '../world/nightlyWorld';
import { resolveHumanThrallDay } from '../servants/humanThralls';
import { runHumanWorkDay } from '../servants/humanWork';

export interface PhaseAdvanceResult {
  state: SaveGame;
  events: string[];
  worldCycleChanged: boolean;
}

const togglePhase = (phase: DayPhase): DayPhase => (phase === 'night' ? 'day' : 'night');

export const advanceWorldPhase = (state: SaveGame): PhaseAdvanceResult => {
  const nextPhase = togglePhase(state.time.phase);
  const events: string[] = [];
  let worldCycleChanged = false;

  let player = { ...state.player };
  let npcs = state.npcs.map((npc) => ({ ...npc }));
  let worldCycle = { ...state.worldCycle };
  let humanServants = state.humanServants.map((servant) => ({ ...servant, relationships: { ...servant.relationships }, priorities: { ...servant.priorities }, equipped: { ...servant.equipped } }));
  let inventory = state.inventory.map((entry) => ({ ...entry }));
  let rooms = state.rooms.map((room) => ({ ...room, assignedWorkerIds: [...room.assignedWorkerIds] }));
  let craftingQueue = state.craftingQueue.map((order) => ({ ...order }));
  let strategicResources = { ...state.strategicResources };

  // Night -> Day: vampires consume stored Vitae; daylight traits remain separate.
  if (nextPhase === 'day') {
    const vitaeBefore = player.vitae;
    const vitaeAfter = Math.max(0, vitaeBefore - PLAYER_VITAE_UPKEEP_PER_DAWN);
    if (vitaeAfter < vitaeBefore) {
      events.push(`Dawn deepens your thirst. (-${vitaeBefore - vitaeAfter} Vitae)`);
    }

    const penalty = getDayRestrictionPenalty(getTraitEffectIds(player.traitIds));
    let newHealth = player.health;
    if (penalty > 0) {
      newHealth = Math.max(1, newHealth - penalty);
      events.push(`Daylight weakens you. (-${penalty} health penalty applied)`);
    }
    player = { ...player, vitae: vitaeAfter, health: newHealth };
  }

  // Day -> Night: increment day, refresh world cycle, replenish humans.
  const nextDay = nextPhase === 'night' ? state.time.day + 1 : state.time.day;
  if (nextPhase === 'night') {
    worldCycle = {
      cycle: worldCycle.cycle + 1,
      collectedResourceNodeIds: [],
      defeatedEnemyIds: [],
    };
    worldCycleChanged = true;

    const humanWork = runHumanWorkDay({ humanServants, rooms, craftingQueue, inventory }, state.seed, nextDay);
    humanServants = humanWork.humanServants;
    rooms = humanWork.rooms;
    craftingQueue = humanWork.craftingQueue;
    inventory = humanWork.inventory;
    for (const event of humanWork.events) events.push(event);

    const thrallSnapshots = new Map(humanServants.map((servant) => [servant.id, servant] as const));
    const thrallDay = resolveHumanThrallDay({ ...state, humanServants, rooms, craftingQueue, strategicResources, inventory });
    humanServants = thrallDay.humanServants;
    inventory = thrallDay.inventory;
    for (const event of thrallDay.events) events.push(event);
    if (thrallDay.escapedHumanIds.length > 0) {
      const escapedIds = new Set(thrallDay.escapedHumanIds);
      npcs = npcs.map((human) => {
        if (!escapedIds.has(human.id)) return human;
        const escapedThrall = thrallSnapshots.get(human.id);
        const baseFear = escapedThrall?.fear ?? human.fear;
        const baseDisposition = escapedThrall?.disposition ?? human.disposition;
        return markHumanEscaped({
          ...human,
          status: 'wandering' as const,
          fear: Math.min(100, baseFear + 15),
          disposition: Math.max(-100, baseDisposition - 20),
        }, state.seed, nextDay);
      });
    }
    const population = resolveNightlyHumanPopulation(npcs, state.seed, nextDay, TARGET_HUMAN_POPULATION);
    npcs = population.npcs;
    for (const event of population.events) events.push(event);
    events.push(`Night ${nextDay} begins. The world stirs anew.`);
  }

  const shift = runWorkShift(
    state.vampireVassals,
    rooms,
    craftingQueue,
    strategicResources,
    inventory,
    nextPhase,
    state.seed,
  );

  for (const logEntry of shift.log) events.push(logEntry);

  const newState: SaveGame = {
    ...state,
    player,
    npcs,
    time: { day: nextDay, phase: nextPhase },
    worldCycle,
    humanServants,
    vampireVassals: shift.vampireVassals,
    rooms: shift.rooms,
    craftingQueue: shift.craftingQueue,
    strategicResources: shift.strategicResources,
    inventory: shift.inventory,
    lastEventLog: [...events.map((e) => `[Phase] ${e}`), ...state.lastEventLog].slice(0, 20),
  };

  return { state: newState, events, worldCycleChanged };
};

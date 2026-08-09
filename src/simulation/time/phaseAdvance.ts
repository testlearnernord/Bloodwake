import { PLAYER_VITAE_UPKEEP_PER_DAWN, TARGET_HUMAN_POPULATION } from '../../config/balancing';
import type { DayPhase, SaveGame } from '../../types/models';
import { runWorkShift } from '../servants/production';
import { getDayRestrictionPenalty } from '../traits/traitEffects';
import { getTraitEffectIds } from '../traits/traitUtils';
import { replenishHumanPopulation } from '../world/humans';
import { resolveHumanThrallDay } from '../servants/humanThralls';

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
    const thrallSnapshots = new Map(humanServants.map((servant) => [servant.id, servant] as const));
    const thrallDay = resolveHumanThrallDay({ ...state, humanServants, inventory });
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
        return {
          ...human,
          status: 'wandering' as const,
          fear: Math.min(100, baseFear + 15),
          disposition: Math.max(-100, baseDisposition - 20),
        };
      });
    }
    events.push(`Night ${nextDay} begins. The world stirs anew.`);
    npcs = replenishHumanPopulation(npcs, state.seed, nextDay, TARGET_HUMAN_POPULATION);
  }

  const shift = runWorkShift(
    state.vampireVassals,
    state.rooms,
    state.craftingQueue,
    state.strategicResources,
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

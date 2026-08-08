import { PLAYER_VITAE_UPKEEP_PER_DAWN, TARGET_HUMAN_POPULATION } from '../../config/balancing';
import type { DayPhase, SaveGame } from '../../types/models';
import { runWorkShift } from '../servants/production';
import { getDayRestrictionPenalty } from '../traits/traitEffects';
import { getTraitEffectIds } from '../traits/traitUtils';
import { replenishHumanPopulation } from '../world/humans';

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
    events.push(`Night ${nextDay} begins. The world stirs anew.`);
    npcs = replenishHumanPopulation(npcs, state.seed, nextDay, TARGET_HUMAN_POPULATION);
  }

  const shift = runWorkShift(
    state.vampireVassals,
    state.rooms,
    state.craftingQueue,
    state.strategicResources,
    state.inventory,
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
    vampireVassals: shift.vampireVassals,
    rooms: shift.rooms,
    craftingQueue: shift.craftingQueue,
    strategicResources: shift.strategicResources,
    inventory: shift.inventory,
    lastEventLog: [...events.map((e) => `[Phase] ${e}`), ...state.lastEventLog].slice(0, 20),
  };

  return { state: newState, events, worldCycleChanged };
};

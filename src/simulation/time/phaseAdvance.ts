import {
  DRAIN_HUNGER_REDUCTION,
  FEED_HUNGER_REDUCTION,
  MAX_HUNGER,
  STARVATION_HEALTH_DAMAGE,
  TARGET_HUMAN_POPULATION,
} from '../../config/balancing';
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

  // Night → Day: apply hunger and day restriction penalty
  if (nextPhase === 'day') {
    const penalty = getDayRestrictionPenalty(getTraitEffectIds(player.traitIds));
    const hungerIncrease = 1 + penalty;
    const newHunger = Math.min(MAX_HUNGER, player.hunger + hungerIncrease);

    if (newHunger >= MAX_HUNGER) {
      events.push(`Hunger reaches its limit — you are starving. (${MAX_HUNGER}/${MAX_HUNGER})`);
    }

    // Starvation damage — only at max hunger
    let newHealth = player.health;
    if (newHunger >= MAX_HUNGER) {
      newHealth = Math.max(1, player.health - STARVATION_HEALTH_DAMAGE - penalty);
      events.push(`Starvation saps your strength. (-${STARVATION_HEALTH_DAMAGE + penalty} health)`);
    }

    player = { ...player, hunger: newHunger, health: newHealth };

    if (penalty > 0) {
      events.push(`Daylight weakens you. (-${penalty} health penalty applied)`);
    }
  }

  // Day → Night: increment day, refresh world cycle, replenish humans
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

  // Run work shift for servants
  const shift = runWorkShift(
    state.servants,
    state.rooms,
    state.craftingQueue,
    state.strategicResources,
    state.inventory,
    nextPhase,
    state.seed,
  );

  for (const logEntry of shift.log) {
    events.push(logEntry);
  }

  const newState: SaveGame = {
    ...state,
    player,
    npcs,
    time: { day: nextDay, phase: nextPhase },
    worldCycle,
    servants: shift.servants,
    rooms: shift.rooms,
    craftingQueue: shift.craftingQueue,
    strategicResources: shift.strategicResources,
    inventory: shift.inventory,
    lastEventLog: [...events.map((e) => `[Phase] ${e}`), ...state.lastEventLog].slice(0, 20),
  };

  return { state: newState, events, worldCycleChanged };
};

/**
 * Apply hunger reduction from feeding. Returns clamped new hunger value.
 */
export const applyFeedHungerReduction = (currentHunger: number): number =>
  Math.max(0, currentHunger - FEED_HUNGER_REDUCTION);

/**
 * Apply hunger reduction from draining. Returns clamped new hunger value.
 */
export const applyDrainHungerReduction = (currentHunger: number): number =>
  Math.max(0, currentHunger - DRAIN_HUNGER_REDUCTION);

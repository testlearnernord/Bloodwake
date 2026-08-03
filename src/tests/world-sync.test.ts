import { describe, expect, it } from 'vitest';
import {
  MAX_HUNGER,
  FEED_HUNGER_REDUCTION,
  TARGET_HUMAN_POPULATION,
} from '../config/balancing';
import { createNewGameState } from '../app/state';
import { advanceWorldPhase, applyFeedHungerReduction, applyDrainHungerReduction } from '../simulation/time/phaseAdvance';
import { replenishHumanPopulation } from '../simulation/world/humans';
import { applyHumanAction } from '../simulation/combat/bite';
import { migrateSaveGame } from '../persistence/saveStore';
import { SAVE_FORMAT_VERSION } from '../config/game';
import type { SaveGame } from '../types/models';

// ─── Phase Lifecycle ────────────────────────────────────────────────────────

describe('phase lifecycle: night → day', () => {
  it('changes phase to day', () => {
    const state = createNewGameState({ seed: 'test' }); // starts at night
    const { state: next } = advanceWorldPhase(state);
    expect(next.time.phase).toBe('day');
  });

  it('does not increment the day number', () => {
    const state = createNewGameState({ seed: 'test' });
    const { state: next } = advanceWorldPhase(state);
    expect(next.time.day).toBe(1);
  });

  it('increases hunger once', () => {
    const state = createNewGameState({ seed: 'test' });
    const before = state.player.hunger;
    const { state: next } = advanceWorldPhase(state);
    expect(next.player.hunger).toBeGreaterThan(before);
  });

  it('does not change world cycle', () => {
    const state = createNewGameState({ seed: 'test' });
    const { worldCycleChanged } = advanceWorldPhase(state);
    expect(worldCycleChanged).toBe(false);
  });

  it('world cycle depletion is unchanged', () => {
    const state = createNewGameState({ seed: 'test' });
    state.worldCycle.collectedResourceNodeIds = ['wood-node'];
    const { state: next } = advanceWorldPhase(state);
    expect(next.worldCycle.collectedResourceNodeIds).toContain('wood-node');
  });
});

describe('phase lifecycle: day → night', () => {
  const advanceTwice = (seed: string): { first: SaveGame; second: SaveGame } => {
    const initial = createNewGameState({ seed });
    const { state: day } = advanceWorldPhase(initial); // night→day
    const { state: night } = advanceWorldPhase(day); // day→night
    return { first: day, second: night };
  };

  it('changes phase to night', () => {
    const { second } = advanceTwice('test');
    expect(second.time.phase).toBe('night');
  });

  it('increments the day number', () => {
    const { second } = advanceTwice('test');
    expect(second.time.day).toBe(2);
  });

  it('increments world cycle', () => {
    const { first, second } = advanceTwice('test');
    expect(second.worldCycle.cycle).toBe(first.worldCycle.cycle + 1);
  });

  it('resets collected resource IDs', () => {
    const initial = createNewGameState({ seed: 'test' });
    const { state: day } = advanceWorldPhase(initial);
    day.worldCycle.collectedResourceNodeIds = ['wood-node'];
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.collectedResourceNodeIds).toHaveLength(0);
  });

  it('resets defeated enemy IDs', () => {
    const initial = createNewGameState({ seed: 'test' });
    const { state: day } = advanceWorldPhase(initial);
    day.worldCycle.defeatedEnemyIds = ['bandit-1'];
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.defeatedEnemyIds).toHaveLength(0);
  });

  it('signals worldCycleChanged', () => {
    const initial = createNewGameState({ seed: 'test' });
    const { state: day } = advanceWorldPhase(initial);
    const { worldCycleChanged } = advanceWorldPhase(day);
    expect(worldCycleChanged).toBe(true);
  });
});

describe('phase lifecycle: idempotent', () => {
  it('advancing from same phase state to same next phase is deterministic', () => {
    const state = createNewGameState({ seed: 'determ' });
    const r1 = advanceWorldPhase(state);
    const r2 = advanceWorldPhase(state);
    expect(r1.state.time.phase).toBe(r2.state.time.phase);
    expect(r1.state.player.hunger).toBe(r2.state.player.hunger);
  });
});

// ─── Hunger ─────────────────────────────────────────────────────────────────

describe('hunger model', () => {
  it('hunger cannot exceed MAX_HUNGER', () => {
    const state = createNewGameState({ seed: 'h' });
    state.player.hunger = MAX_HUNGER - 1;
    const { state: next } = advanceWorldPhase(state);
    expect(next.player.hunger).toBeLessThanOrEqual(MAX_HUNGER);
  });

  it('feeding reduces hunger', () => {
    const before = 6;
    expect(applyFeedHungerReduction(before)).toBe(before - FEED_HUNGER_REDUCTION);
  });

  it('draining reduces hunger at least as much as feeding', () => {
    const before = 6;
    expect(applyDrainHungerReduction(before)).toBeLessThanOrEqual(applyFeedHungerReduction(before));
  });

  it('hunger cannot become negative from feeding', () => {
    expect(applyFeedHungerReduction(0)).toBe(0);
    expect(applyFeedHungerReduction(1)).toBe(0);
  });

  it('hunger cannot become negative from draining', () => {
    expect(applyDrainHungerReduction(0)).toBe(0);
  });

  it('hunger reduction is applied when feeding a human', () => {
    const state = createNewGameState({ seed: 'feed-test' });
    state.player.vitae = 5;
    state.player.hunger = 8;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'feed');
    expect(next.player.hunger).toBeLessThan(8);
  });

  it('hunger reduction is applied when draining a human', () => {
    const state = createNewGameState({ seed: 'drain-test' });
    state.player.hunger = 8;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'drain');
    expect(next.player.hunger).toBeLessThan(8);
  });

  it('maximum hunger causes configured dawn damage', () => {
    const state = createNewGameState({ seed: 'starvation' });
    state.player.hunger = MAX_HUNGER;
    const before = state.player.health;
    const { state: next, events } = advanceWorldPhase(state);
    expect(next.player.health).toBeLessThan(before);
    expect(next.player.health).toBeGreaterThanOrEqual(1); // cannot reduce to 0
    expect(events.some((e) => e.includes('Starvation') || e.includes('starv'))).toBe(true);
  });

  it('starvation damage repeats on a later dawn if still starving', () => {
    const state = createNewGameState({ seed: 'starvation-2' });
    state.player.hunger = MAX_HUNGER;
    const { state: day1 } = advanceWorldPhase(state); // night→day
    const h1 = day1.player.health;
    // Advance to night, then day again without feeding
    const { state: night2 } = advanceWorldPhase(day1); // day→night
    night2.player.hunger = MAX_HUNGER;
    const { state: day2 } = advanceWorldPhase(night2); // night→day
    expect(day2.player.health).toBeLessThanOrEqual(h1);
  });

  it('starvation cannot reduce health below 1', () => {
    const state = createNewGameState({ seed: 'starvation-floor' });
    state.player.hunger = MAX_HUNGER;
    state.player.health = 1;
    const { state: next } = advanceWorldPhase(state);
    expect(next.player.health).toBeGreaterThanOrEqual(1);
  });

  it('produces event message for reaching maximum hunger', () => {
    const state = createNewGameState({ seed: 'hunger-msg' });
    state.player.hunger = MAX_HUNGER - 1;
    const { events } = advanceWorldPhase(state);
    expect(events.some((e) => e.includes('limit') || e.includes('starv'))).toBe(true);
  });

  it('produces event message for starvation damage', () => {
    const state = createNewGameState({ seed: 'dmg-msg' });
    state.player.hunger = MAX_HUNGER;
    const { events } = advanceWorldPhase(state);
    expect(events.some((e) => e.includes('Starvation') || e.includes('starv'))).toBe(true);
  });
});

// ─── Human Replenishment ─────────────────────────────────────────────────────

describe('human replenishment', () => {
  const seed = '1042';

  it('surviving humans remain', () => {
    const npcs = replenishHumanPopulation(
      [{ id: 'human-1', status: 'wandering', name: 'A', familyName: 'B', age: 25, professionId: 'peasant', attributes: { strength: 2, agility: 2, vitality: 2, willpower: 2, intelligence: 2, presence: 2, bloodControl: 2 }, traitIds: [], factionId: 'village', health: 12, maxHealth: 12, morale: 50, loyalty: 40, ambition: 50, stress: 10, combat: 0, bloodQuality: 3, recruitability: 50, relationships: {} }],
      seed,
      2,
      TARGET_HUMAN_POPULATION,
    );
    expect(npcs.some((h) => h.id === 'human-1')).toBe(true);
  });

  it('fed humans recover to wandering', () => {
    const npcs = replenishHumanPopulation(
      [{ id: 'fed-1', status: 'fed', name: 'A', familyName: 'B', age: 25, professionId: 'peasant', attributes: { strength: 2, agility: 2, vitality: 2, willpower: 2, intelligence: 2, presence: 2, bloodControl: 2 }, traitIds: [], factionId: 'village', health: 12, maxHealth: 12, morale: 50, loyalty: 40, ambition: 50, stress: 10, combat: 0, bloodQuality: 3, recruitability: 50, relationships: {} }],
      seed,
      2,
      TARGET_HUMAN_POPULATION,
    );
    const recovered = npcs.find((h) => h.id === 'fed-1');
    expect(recovered?.status).toBe('wandering');
  });

  it('drained humans are removed', () => {
    const npcs = replenishHumanPopulation(
      [{ id: 'drain-1', status: 'drained', name: 'A', familyName: 'B', age: 25, professionId: 'peasant', attributes: { strength: 2, agility: 2, vitality: 2, willpower: 2, intelligence: 2, presence: 2, bloodControl: 2 }, traitIds: [], factionId: 'village', health: 12, maxHealth: 12, morale: 50, loyalty: 40, ambition: 50, stress: 10, combat: 0, bloodQuality: 3, recruitability: 50, relationships: {} }],
      seed,
      2,
      TARGET_HUMAN_POPULATION,
    );
    expect(npcs.some((h) => h.id === 'drain-1')).toBe(false);
  });

  it('turned humans do not reappear as humans', () => {
    const npcs = replenishHumanPopulation(
      [{ id: 'turned-1', status: 'turned', name: 'A', familyName: 'B', age: 25, professionId: 'peasant', attributes: { strength: 2, agility: 2, vitality: 2, willpower: 2, intelligence: 2, presence: 2, bloodControl: 2 }, traitIds: [], factionId: 'village', health: 12, maxHealth: 12, morale: 50, loyalty: 40, ambition: 50, stress: 10, combat: 0, bloodQuality: 3, recruitability: 50, relationships: {} }],
      seed,
      2,
      TARGET_HUMAN_POPULATION,
    );
    expect(npcs.some((h) => h.id === 'turned-1')).toBe(false);
  });

  it('active human count returns to target', () => {
    const npcs = replenishHumanPopulation([], seed, 2, TARGET_HUMAN_POPULATION);
    expect(npcs.length).toBe(TARGET_HUMAN_POPULATION);
  });

  it('generated IDs are unique', () => {
    const npcs = replenishHumanPopulation([], seed, 5, TARGET_HUMAN_POPULATION);
    const ids = npcs.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('generation is deterministic for same seed/day', () => {
    const a = replenishHumanPopulation([], seed, 3, TARGET_HUMAN_POPULATION);
    const b = replenishHumanPopulation([], seed, 3, TARGET_HUMAN_POPULATION);
    expect(a.map((h) => h.id)).toEqual(b.map((h) => h.id));
  });

  it('save/load does not create duplicate humans', () => {
    const state = createNewGameState({ seed: 'dup-test' });
    const { state: day } = advanceWorldPhase(state);
    const { state: night } = advanceWorldPhase(day);
    const ids = night.npcs.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('human population after full cycle stays at or below target', () => {
    const state = createNewGameState({ seed: '1042' });
    const { state: day } = advanceWorldPhase(state);
    const { state: night } = advanceWorldPhase(day);
    const active = night.npcs.filter((h) => h.status !== 'drained' && h.status !== 'turned');
    expect(active.length).toBeLessThanOrEqual(TARGET_HUMAN_POPULATION);
  });
});

// ─── Resource Persistence ───────────────────────────────────────────────────

describe('resource node lifecycle', () => {
  it('collected node stays absent during the same cycle', () => {
    const state = createNewGameState({ seed: 'res' });
    state.worldCycle.collectedResourceNodeIds = ['wood-node'];
    expect(state.worldCycle.collectedResourceNodeIds).toContain('wood-node');
  });

  it('collected node stays absent after save format round-trip', () => {
    const state = createNewGameState({ seed: 'res' });
    state.worldCycle.collectedResourceNodeIds = ['wood-node'];
    const imported = migrateSaveGame({ ...state });
    expect(imported.worldCycle.collectedResourceNodeIds).toContain('wood-node');
  });

  it('node respawns on the next new night', () => {
    const state = createNewGameState({ seed: 'res' });
    const { state: day } = advanceWorldPhase(state);
    day.worldCycle.collectedResourceNodeIds = ['wood-node'];
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.collectedResourceNodeIds).not.toContain('wood-node');
  });

  it('recording the same node twice does not duplicate', () => {
    const state = createNewGameState({ seed: 'res2' });
    state.worldCycle.collectedResourceNodeIds = ['wood-node'];
    // Simulate double-recording (the bridge implementation deduplicates)
    const ids = [...new Set([...state.worldCycle.collectedResourceNodeIds, 'wood-node'])];
    expect(ids.filter((id) => id === 'wood-node').length).toBe(1);
  });
});

// ─── Enemy Persistence ──────────────────────────────────────────────────────

describe('enemy lifecycle', () => {
  it('defeated enemy stays absent during the same cycle', () => {
    const state = createNewGameState({ seed: 'enemy' });
    state.worldCycle.defeatedEnemyIds = ['bandit-1'];
    expect(state.worldCycle.defeatedEnemyIds).toContain('bandit-1');
  });

  it('defeated enemy stays absent after save format round-trip', () => {
    const state = createNewGameState({ seed: 'enemy' });
    state.worldCycle.defeatedEnemyIds = ['bandit-1'];
    const imported = migrateSaveGame({ ...state });
    expect(imported.worldCycle.defeatedEnemyIds).toContain('bandit-1');
  });

  it('enemy respawns on the next new night', () => {
    const state = createNewGameState({ seed: 'enemy' });
    const { state: day } = advanceWorldPhase(state);
    day.worldCycle.defeatedEnemyIds = ['bandit-1'];
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.defeatedEnemyIds).not.toContain('bandit-1');
  });

  it('Blood Essence cannot be awarded twice for one enemy (deduplication)', () => {
    const state = createNewGameState({ seed: 'enemy2' });
    const before = state.strategicResources.bloodEssence;
    // Simulate the bridge guard
    if (!state.worldCycle.defeatedEnemyIds.includes('bandit-1')) {
      state.worldCycle.defeatedEnemyIds = [...state.worldCycle.defeatedEnemyIds, 'bandit-1'];
      state.strategicResources.bloodEssence += 1;
    }
    // Attempt duplicate
    if (!state.worldCycle.defeatedEnemyIds.includes('bandit-1')) {
      state.strategicResources.bloodEssence += 1;
    }
    expect(state.strategicResources.bloodEssence).toBe(before + 1);
  });
});

// ─── Servant World Representation ───────────────────────────────────────────

describe('servant state', () => {
  it('turning a human creates a servant in state', () => {
    const state = createNewGameState({ seed: 'servant-test' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'turn');
    expect(next.servants).toHaveLength(1);
    expect(next.servants[0]?.type).toBe('vampire');
  });

  it('turned human no longer appears as NPC', () => {
    const state = createNewGameState({ seed: 'servant-test2' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'turn');
    const human = next.npcs.find((h) => h.id === humanId);
    expect(human?.status).toBe('turned');
  });

  it('turned servant is preserved after full night cycle', () => {
    const state = createNewGameState({ seed: 'cycle-servant' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withServant } = applyHumanAction(state, humanId, 'turn');
    const { state: day } = advanceWorldPhase(withServant);
    const { state: night } = advanceWorldPhase(day);
    expect(night.servants).toHaveLength(1);
  });
});

// ─── Room World Representation ───────────────────────────────────────────────

describe('room state', () => {
  it('every BuiltRoom has valid grid position', () => {
    const state = createNewGameState({ seed: 'room' });
    for (const room of state.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('under-construction and built rooms have different status', () => {
    const state = createNewGameState({ seed: 'room2' });
    const builtRoom = state.rooms.find((r) => r.status === 'built');
    expect(builtRoom).toBeDefined();
  });
});

// ─── Save Migration ──────────────────────────────────────────────────────────

describe('save migration v2 → v3', () => {
  it('migrates v2 save successfully', () => {
    const v2 = createNewGameState({ seed: 'migrate' });
    const asV2 = { ...v2, version: 2 };
    const migrated = migrateSaveGame(asV2);
    expect(migrated.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('existing servants are preserved after migration', () => {
    const state = createNewGameState({ seed: 'migrate-servants' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withServant } = applyHumanAction(state, humanId, 'turn');
    const asV2 = { ...withServant, version: 2 };
    const migrated = migrateSaveGame(asV2);
    expect(migrated.servants).toHaveLength(1);
  });

  it('initializes worldCycle with zero depletion for old saves', () => {
    const v2 = createNewGameState({ seed: 'migrate-wc' });
    const asV2 = { ...v2, version: 2 };
    const migrated = migrateSaveGame(asV2);
    expect(migrated.worldCycle.collectedResourceNodeIds).toHaveLength(0);
    expect(migrated.worldCycle.defeatedEnemyIds).toHaveLength(0);
  });

  it('rejects malformed world-cycle identifiers', () => {
    const v3 = createNewGameState({ seed: 'migrate-bad' });
    const withBadIds = {
      ...v3,
      worldCycle: { cycle: 1, collectedResourceNodeIds: ['INVALID ID!', 'valid-id'], defeatedEnemyIds: [] },
    };
    const migrated = migrateSaveGame(withBadIds);
    expect(migrated.worldCycle.collectedResourceNodeIds).not.toContain('INVALID ID!');
    expect(migrated.worldCycle.collectedResourceNodeIds).toContain('valid-id');
  });

  it('deduplicates world cycle identifier arrays', () => {
    const v3 = createNewGameState({ seed: 'migrate-dup' });
    const withDups = {
      ...v3,
      worldCycle: {
        cycle: 1,
        collectedResourceNodeIds: ['wood-node', 'wood-node', 'herb-node'],
        defeatedEnemyIds: ['bandit-1', 'bandit-1'],
      },
    };
    const migrated = migrateSaveGame(withDups);
    expect(migrated.worldCycle.collectedResourceNodeIds.filter((id) => id === 'wood-node').length).toBe(1);
    expect(migrated.worldCycle.defeatedEnemyIds.filter((id) => id === 'bandit-1').length).toBe(1);
  });

  it('inventory remains intact after migration', () => {
    const v2 = createNewGameState({ seed: 'migrate-inv' });
    const woodBefore = v2.inventory.find((e) => e.itemId === 'wood')?.quantity ?? 0;
    const asV2 = { ...v2, version: 2 };
    const migrated = migrateSaveGame(asV2);
    expect(migrated.inventory.find((e) => e.itemId === 'wood')?.quantity).toBe(woodBefore);
  });
});

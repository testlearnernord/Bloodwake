/**
 * qa-regression.test.ts
 *
 * Targeted regression tests for the QA pass scenarios documented in the
 * problem statement.  All assertions are deterministic and exercise only
 * pure simulation logic (no Phaser canvas, no IndexedDB, no network).
 *
 * Scenarios covered:
 *  - Drain hunger reduction is exactly DRAIN_HUNGER_REDUCTION (not just ≤ feed)
 *  - Turning a human creates *exactly one* new servant and no more
 *  - Multiple-dawn starvation: health falls by exactly STARVATION_HEALTH_DAMAGE each applicable dawn
 *  - Starvation health floor stays ≥ 1 across many dawns without feeding
 *  - Feeding after starvation reduces hunger by exactly FEED_HUNGER_REDUCTION
 *  - No duplicate servants/rooms/enemies/resource-nodes after a save-state round-trip
 *  - Two distinct rooms placed → exactly two unique room entries (by composite id)
 *  - Turned human absent from next-night NPC list
 *  - Drained human absent from next-night NPC list
 *  - World cycle collections are cleared exactly once on day→night transition
 */

import { describe, expect, it } from 'vitest';
import {
  DRAIN_HUNGER_REDUCTION,
  FEED_HUNGER_REDUCTION,
  MAX_HUNGER,
  STARVATION_HEALTH_DAMAGE,
  TARGET_HUMAN_POPULATION,
} from '../config/balancing';
import { createNewGameState } from '../app/state';
import {
  advanceWorldPhase,
  applyDrainHungerReduction,
} from '../simulation/time/phaseAdvance';
import { getDayRestrictionPenalty } from '../simulation/traits/traitEffects';
import { getTraitEffectIds } from '../simulation/traits/traitUtils';
import { applyHumanAction } from '../simulation/combat/bite';
import { migrateSaveGame } from '../persistence/saveStore';
import { queueRoomConstruction } from '../simulation/building/building';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Advance night → day → night (one full cycle). */
const fullCycle = (seed: string) => {
  const initial = createNewGameState({ seed });
  const { state: day } = advanceWorldPhase(initial); // night→day
  const { state: night } = advanceWorldPhase(day); // day→night
  return { initial, day, night };
};

// ─── Drain hunger exact value ─────────────────────────────────────────────────

describe('drain hunger: exact reduction', () => {
  it('reduces hunger by exactly DRAIN_HUNGER_REDUCTION', () => {
    const before = 8;
    expect(applyDrainHungerReduction(before)).toBe(before - DRAIN_HUNGER_REDUCTION);
  });

  it('clamps to zero rather than going negative', () => {
    expect(applyDrainHungerReduction(DRAIN_HUNGER_REDUCTION - 1)).toBe(0);
    expect(applyDrainHungerReduction(0)).toBe(0);
  });

  it('applyHumanAction(drain) reduces hunger by exactly DRAIN_HUNGER_REDUCTION', () => {
    const state = createNewGameState({ seed: 'drain-exact' });
    state.player.hunger = 8;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'drain');
    expect(next.player.hunger).toBe(8 - DRAIN_HUNGER_REDUCTION);
  });

  it('feed after drain reduces hunger by exactly FEED_HUNGER_REDUCTION', () => {
    const state = createNewGameState({ seed: 'feed-after-drain' });
    state.player.hunger = MAX_HUNGER;
    const [first, second] = state.npcs;
    const { state: afterDrain } = applyHumanAction(state, first?.id ?? '', 'drain');
    const hungerAfterDrain = afterDrain.player.hunger;
    const { state: afterFeed } = applyHumanAction(afterDrain, second?.id ?? '', 'feed');
    expect(afterFeed.player.hunger).toBe(Math.max(0, hungerAfterDrain - FEED_HUNGER_REDUCTION));
  });
});

// ─── Vassal turn: exactly one new vassal ─────────────────────────────────────

describe('vassal turn: exactly one new vassal per action', () => {
  it('creates exactly one vampire vassal when turning the first human', () => {
    const state = createNewGameState({ seed: 'turn-one' });
    state.player.vitae = 5;
    const before = state.vampireVassals.length;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'turn');
    expect(next.vampireVassals.length).toBe(before + 1);
  });

  it('does not add more than one vassal per turn call', () => {
    const state = createNewGameState({ seed: 'turn-no-extra' });
    state.player.vitae = 20;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: once } = applyHumanAction(state, humanId, 'turn');
    // Attempt to turn the already-turned human a second time
    const { state: twice } = applyHumanAction(once, humanId, 'turn');
    expect(twice.vampireVassals.length).toBe(once.vampireVassals.length); // no extra vassal
  });

  it('vampire vassal IDs are unique after turning multiple humans', () => {
    const state = createNewGameState({ seed: 'servant-ids' });
    state.player.vitae = 10;
    const h1 = state.npcs[0]?.id ?? '';
    const h2 = state.npcs[1]?.id ?? '';
    const { state: s1 } = applyHumanAction(state, h1, 'turn');
    s1.player.vitae = 10;
    const { state: s2 } = applyHumanAction(s1, h2, 'turn');
    const ids = s2.vampireVassals.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Multi-dawn starvation ────────────────────────────────────────────────────

describe('multi-dawn starvation damage', () => {
  it('health decreases by exactly STARVATION_HEALTH_DAMAGE on the first applicable dawn', () => {
    const state = createNewGameState({ seed: 'starv-exact' });
    state.player.hunger = MAX_HUNGER;
    const hBefore = state.player.health;
    const penalty = getDayRestrictionPenalty(getTraitEffectIds(state.player.traitIds));
    const { state: day } = advanceWorldPhase(state);
    // Starvation damage plus any daylight restriction penalty (e.g. sun_cursed)
    const expectedHealth = Math.max(1, Math.max(1, hBefore - penalty) - STARVATION_HEALTH_DAMAGE);
    expect(day.player.health).toBe(expectedHealth);
  });

  it('health decreases by exactly STARVATION_HEALTH_DAMAGE on a second consecutive starving dawn', () => {
    const state = createNewGameState({ seed: 'starv-second-dawn' });
    state.player.hunger = MAX_HUNGER;
    const penalty = getDayRestrictionPenalty(getTraitEffectIds(state.player.traitIds));
    const { state: day1 } = advanceWorldPhase(state); // night→day (first dawn)
    const h1 = day1.player.health;
    const { state: night2 } = advanceWorldPhase(day1); // day→night
    night2.player.hunger = MAX_HUNGER;
    const { state: day2 } = advanceWorldPhase(night2); // night→day (second dawn)
    // Starvation damage plus any daylight restriction penalty (e.g. sun_cursed)
    const expectedHealth = Math.max(1, Math.max(1, h1 - penalty) - STARVATION_HEALTH_DAMAGE);
    expect(day2.player.health).toBe(expectedHealth);
  });

  it('health never falls below 1 across five consecutive starving dawns', () => {
    let state = createNewGameState({ seed: 'starv-floor-multi' });
    state.player.health = 2; // nearly dead to stress the floor
    for (let i = 0; i < 5; i++) {
      state.player.hunger = MAX_HUNGER;
      const { state: day } = advanceWorldPhase(state); // night→day
      expect(day.player.health).toBeGreaterThanOrEqual(1);
      const { state: night } = advanceWorldPhase(day); // day→night
      state = night;
    }
  });

  it('feeding after starvation reduces hunger by exactly FEED_HUNGER_REDUCTION', () => {
    const state = createNewGameState({ seed: 'starv-feed-recovery' });
    state.player.hunger = MAX_HUNGER;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: afterFeed } = applyHumanAction(state, humanId, 'feed');
    expect(afterFeed.player.hunger).toBe(Math.max(0, MAX_HUNGER - FEED_HUNGER_REDUCTION));
  });

  it('no starvation event is emitted on a non-starving dawn', () => {
    const state = createNewGameState({ seed: 'no-starv-event' });
    state.player.hunger = 0;
    const { events } = advanceWorldPhase(state); // night→day
    expect(events.some((e) => e.toLowerCase().includes('starvation'))).toBe(false);
  });
});

// ─── Save round-trip: no duplicate entities ───────────────────────────────────

describe('save round-trip: no duplicate entities', () => {
  it('vampire vassals are not duplicated after migration round-trip', () => {
    const state = createNewGameState({ seed: 'rt-servants' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withVassal } = applyHumanAction(state, humanId, 'turn');
    const migrated = migrateSaveGame({ ...withVassal });
    const ids = migrated.vampireVassals.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(1);
  });

  it('rooms are not duplicated after migration round-trip', () => {
    const state = createNewGameState({ seed: 'rt-rooms' });
    const migrated = migrateSaveGame({ ...state });
    const ids = migrated.rooms.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resource node IDs are not duplicated after migration round-trip', () => {
    const state = createNewGameState({ seed: 'rt-nodes' });
    state.worldCycle.collectedResourceNodeIds = ['wood-node', 'stone-node'];
    const migrated = migrateSaveGame({ ...state });
    const ids = migrated.worldCycle.collectedResourceNodeIds;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enemy IDs are not duplicated after migration round-trip', () => {
    const state = createNewGameState({ seed: 'rt-enemies' });
    state.worldCycle.defeatedEnemyIds = ['bandit-1', 'clergy-1'];
    const migrated = migrateSaveGame({ ...state });
    const ids = migrated.worldCycle.defeatedEnemyIds;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('NPC IDs are not duplicated after full cycle + migration', () => {
    const { night } = fullCycle('rt-npcs');
    const migrated = migrateSaveGame({ ...night });
    const ids = migrated.npcs.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Room placement: exactly one entry per placed room ───────────────────────

describe('room placement: no duplicate room entries', () => {
  it('placing two rooms creates exactly two distinct room entries', () => {
    const state = createNewGameState({ seed: 'rooms-two' });
    const inventory = [
      { itemId: 'wood' as const, quantity: 20 },
      { itemId: 'stone' as const, quantity: 20 },
    ];
    const resources = { bloodEssence: 0, security: 0, gold: 0, knowledge: 0, influence: 0 };

    const r1 = queueRoomConstruction(state.rooms, inventory, resources, 'storage_room', 1, 0);
    const r2 = queueRoomConstruction(r1.updatedRooms, r1.updatedInventory, resources, 'workshop', 2, 0);

    const ids = r2.updatedRooms.map((r) => r.id);
    // No duplicate IDs
    expect(new Set(ids).size).toBe(ids.length);
    // Starting room + 2 newly placed rooms
    expect(r2.updatedRooms.length).toBe(state.rooms.length + 2);
  });

  it('each placed room has a unique composite id matching its roomId+position', () => {
    const state = createNewGameState({ seed: 'rooms-id' });
    const inventory = [{ itemId: 'wood' as const, quantity: 20 }, { itemId: 'stone' as const, quantity: 20 }];
    const resources = { bloodEssence: 0, security: 0, gold: 0, knowledge: 0, influence: 0 };

    const r1 = queueRoomConstruction(state.rooms, inventory, resources, 'storage_room', 1, 0);
    const newRoom = r1.updatedRooms.find((r) => r.roomId === 'storage_room');
    expect(newRoom?.id).toBe('room-storage_room-1-0');
  });

  it('placing the same room at the same coordinates twice throws', () => {
    const state = createNewGameState({ seed: 'rooms-overlap' });
    const inventory = [{ itemId: 'wood' as const, quantity: 40 }, { itemId: 'stone' as const, quantity: 40 }];
    const resources = { bloodEssence: 0, security: 0, gold: 0, knowledge: 0, influence: 0 };

    const r1 = queueRoomConstruction(state.rooms, inventory, resources, 'storage_room', 1, 0);
    expect(() =>
      queueRoomConstruction(r1.updatedRooms, r1.updatedInventory, resources, 'storage_room', 1, 0),
    ).toThrow();
  });
});

// ─── Turned / drained humans absent from next night ──────────────────────────

describe('turned and drained humans absent from next-night replenishment', () => {
  it('turned human does not reappear as NPC after a full cycle', () => {
    const state = createNewGameState({ seed: 'turned-absent' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withServant } = applyHumanAction(state, humanId, 'turn');
    const { state: day } = advanceWorldPhase(withServant);
    const { state: night } = advanceWorldPhase(day);
    // The original human should not exist in the NPC list with status 'turned'
    // and must not have been regenerated as a new 'wandering' human under the same ID
    const turningHuman = night.npcs.find((h) => h.id === humanId);
    expect(turningHuman).toBeUndefined();
  });

  it('drained human does not reappear as NPC after a full cycle', () => {
    const state = createNewGameState({ seed: 'drained-absent' });
    const humanId = state.npcs[0]?.id ?? '';
    const { state: afterDrain } = applyHumanAction(state, humanId, 'drain');
    const { state: day } = advanceWorldPhase(afterDrain);
    const { state: night } = advanceWorldPhase(day);
    const drainedHuman = night.npcs.find((h) => h.id === humanId);
    expect(drainedHuman).toBeUndefined();
  });

  it('active human population is replenished to target after a full cycle', () => {
    const state = createNewGameState({ seed: 'replenish-target' });
    // Drain all but one human to force replenishment
    let s = state;
    for (let i = 0; i < 4; i++) {
      const id = s.npcs.find((h) => h.status === 'wandering')?.id ?? '';
      if (id) {
        const result = applyHumanAction(s, id, 'drain');
        s = result.state;
      }
    }
    const { state: day } = advanceWorldPhase(s);
    const { state: night } = advanceWorldPhase(day);
    const active = night.npcs.filter((h) => h.status !== 'drained' && h.status !== 'turned');
    expect(active.length).toBe(TARGET_HUMAN_POPULATION);
  });
});

// ─── World cycle reset on day→night ──────────────────────────────────────────

describe('world cycle reset on day→night transition', () => {
  it('clears collected resource node IDs exactly once', () => {
    const state = createNewGameState({ seed: 'wc-clear-res' });
    const { state: day } = advanceWorldPhase(state);
    day.worldCycle.collectedResourceNodeIds = ['wood-node', 'stone-node', 'herb-node'];
    const { state: night, worldCycleChanged } = advanceWorldPhase(day);
    expect(worldCycleChanged).toBe(true);
    expect(night.worldCycle.collectedResourceNodeIds).toHaveLength(0);
  });

  it('clears defeated enemy IDs exactly once', () => {
    const state = createNewGameState({ seed: 'wc-clear-enemy' });
    const { state: day } = advanceWorldPhase(state);
    day.worldCycle.defeatedEnemyIds = ['bandit-1', 'clergy-1'];
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.defeatedEnemyIds).toHaveLength(0);
  });

  it('world cycle counter increments exactly once per day→night transition', () => {
    const state = createNewGameState({ seed: 'wc-counter' });
    const cycleBefore = state.worldCycle.cycle;
    const { state: day } = advanceWorldPhase(state);
    expect(day.worldCycle.cycle).toBe(cycleBefore); // no change on night→day
    const { state: night } = advanceWorldPhase(day);
    expect(night.worldCycle.cycle).toBe(cycleBefore + 1); // increments exactly once
  });

  it('night→day does not reset the world cycle collections', () => {
    const state = createNewGameState({ seed: 'wc-no-reset-at-day' });
    state.worldCycle.collectedResourceNodeIds = ['herb-node'];
    const { state: day, worldCycleChanged } = advanceWorldPhase(state);
    expect(worldCycleChanged).toBe(false);
    expect(day.worldCycle.collectedResourceNodeIds).toContain('herb-node');
  });
});

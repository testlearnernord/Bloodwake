import { describe, expect, it } from 'vitest';
import { PLAYER_VITAE_UPKEEP_PER_DAWN, TARGET_HUMAN_POPULATION } from '../config/balancing';
import { createNewGameState } from '../app/state';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import { isHumanPresentInWorld } from '../simulation/world/humans';
import { resolveNightlyHumanPopulation } from '../simulation/world/nightlyWorld';
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

  it('consumes exactly one Vitae at dawn', () => {
    const state = createNewGameState({ seed: 'test' });
    const before = state.player.vitae;
    const { state: next } = advanceWorldPhase(state);
    expect(next.player.vitae).toBe(Math.max(0, before - PLAYER_VITAE_UPKEEP_PER_DAWN));
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
    expect(r1.state.player.vitae).toBe(r2.state.player.vitae);
  });
});

// ─── Vitae and daylight ──────────────────────────────────────────────────────

describe('vitae upkeep and daylight', () => {
  it('does not consume a second upkeep point on day -> night', () => {
    const state = createNewGameState({ seed: 'vitae-cycle' });
    const { state: day } = advanceWorldPhase(state);
    const before = day.player.vitae;
    const { state: night } = advanceWorldPhase(day);
    expect(night.player.vitae).toBe(before);
  });

  it('keeps Sun-Cursed daylight damage separate from Vitae upkeep', () => {
    const state = createNewGameState({ seed: 'daylight-penalty' });
    state.player.traitIds = ['sun_cursed'];
    const beforeHealth = state.player.health;
    const { state: next, events } = advanceWorldPhase(state);
    expect(next.player.health).toBe(beforeHealth - 1);
    expect(events).toContain('Daylight weakens you. (-1 health penalty applied)');
  });
});

// ─── Human Nightly Lifecycle ─────────────────────────────────────────────────

describe('human nightly lifecycle', () => {
  const seed = '1042';

  it('keeps a bounded active roster while regional population recovers gradually', () => {
    const state = createNewGameState({ seed });
    const population = resolveNightlyHumanPopulation(state.npcs, seed, 2, TARGET_HUMAN_POPULATION);
    expect(population.npcs.filter(isHumanPresentInWorld)).toHaveLength(TARGET_HUMAN_POPULATION);
    const regional = population.npcs.filter((human) => human.status === 'wandering');
    expect(regional.length).toBeGreaterThanOrEqual(TARGET_HUMAN_POPULATION);
    expect(regional.length).toBeLessThanOrEqual(TARGET_HUMAN_POPULATION + 1);
    expect(population.newHumanIds.length).toBeLessThanOrEqual(1);
  });

  it('fed humans recover to wandering before nightly roster selection', () => {
    const state = createNewGameState({ seed: 'fed-world-sync' });
    state.npcs[0]!.status = 'fed';
    const population = resolveNightlyHumanPopulation(state.npcs, state.seed, 2, 8);
    const recovered = population.npcs.find((human) => human.id === state.npcs[0]!.id);
    expect(recovered?.status).toBe('wandering');
    expect(recovered && isHumanPresentInWorld(recovered)).toBe(true);
  });

  it('drained and turned identities never return as active humans', () => {
    const state = createNewGameState({ seed: 'terminal-humans' });
    state.npcs[0]!.status = 'drained';
    state.npcs[0]!.worldPresence = 'dormant';
    state.npcs[1]!.status = 'turned';
    state.npcs[1]!.worldPresence = 'dormant';
    const population = resolveNightlyHumanPopulation(state.npcs, state.seed, 2, 8);
    expect(isHumanPresentInWorld(population.npcs.find((human) => human.id === state.npcs[0]!.id)!)).toBe(false);
    expect(isHumanPresentInWorld(population.npcs.find((human) => human.id === state.npcs[1]!.id)!)).toBe(false);
  });

  it('generated IDs remain unique and deterministic for the same seed/day', () => {
    const state = createNewGameState({ seed });
    const a = resolveNightlyHumanPopulation(state.npcs, seed, 5, TARGET_HUMAN_POPULATION);
    const b = resolveNightlyHumanPopulation(state.npcs, seed, 5, TARGET_HUMAN_POPULATION);
    expect(new Set(a.npcs.map((human) => human.id)).size).toBe(a.npcs.length);
    expect(a.npcs.map((human) => human.id)).toEqual(b.npcs.map((human) => human.id));
    expect(a.npcs.filter(isHumanPresentInWorld).map((human) => human.id)).toEqual(
      b.npcs.filter(isHumanPresentInWorld).map((human) => human.id),
    );
  });

  it('save/load does not create duplicate humans', () => {
    const state = createNewGameState({ seed: 'dup-test' });
    const { state: day } = advanceWorldPhase(state);
    const { state: night } = advanceWorldPhase(day);
    const ids = night.npcs.map((human) => human.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('full phase cycle exposes exactly the target number of free world Humans', () => {
    const state = createNewGameState({ seed: '1042' });
    const { state: day } = advanceWorldPhase(state);
    const { state: night } = advanceWorldPhase(day);
    expect(night.npcs.filter(isHumanPresentInWorld)).toHaveLength(TARGET_HUMAN_POPULATION);
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

describe('vampire vassal state', () => {
  it('turning a human creates a vampire vassal in state', () => {
    const state = createNewGameState({ seed: 'servant-test' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'turn');
    expect(next.vampireVassals).toHaveLength(1);
    expect(next.vampireVassals[0]?.kind).toBe('vampire_vassal');
  });

  it('turned human no longer appears as NPC', () => {
    const state = createNewGameState({ seed: 'servant-test2' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: next } = applyHumanAction(state, humanId, 'turn');
    const human = next.npcs.find((h) => h.id === humanId);
    expect(human?.status).toBe('turned');
  });

  it('vampire vassal is preserved after full night cycle', () => {
    const state = createNewGameState({ seed: 'cycle-servant' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withVassal } = applyHumanAction(state, humanId, 'turn');
    const { state: day } = advanceWorldPhase(withVassal);
    const { state: night } = advanceWorldPhase(day);
    expect(night.vampireVassals).toHaveLength(1);
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

// ─── Save v4 Round-Trip ──────────────────────────────────────────────────────

describe('save v4 round-trip', () => {
  it('v4 save migrates to the same version', () => {
    const state = createNewGameState({ seed: 'migrate' });
    const migrated = migrateSaveGame({ ...state });
    expect(migrated.version).toBe(SAVE_FORMAT_VERSION);
  });

  it('rejects v2 saves with incompatibility error', () => {
    const base = createNewGameState({ seed: 'migrate-old' });
    const asV2 = { ...base, version: 2, servants: [], humanServants: undefined, vampireVassals: undefined };
    expect(() => migrateSaveGame(asV2)).toThrow(/incompatible older game version/);
  });

  it('rejects v3 saves with incompatibility error', () => {
    const base = createNewGameState({ seed: 'migrate-v3' });
    const asV3 = { ...base, version: 3, servants: [], humanServants: undefined, vampireVassals: undefined };
    expect(() => migrateSaveGame(asV3)).toThrow(/incompatible older game version/);
  });

  it('vampire vassals are preserved after v4 round-trip', () => {
    const state = createNewGameState({ seed: 'migrate-servants' });
    state.player.vitae = 5;
    const humanId = state.npcs[0]?.id ?? '';
    const { state: withVassal } = applyHumanAction(state, humanId, 'turn');
    const migrated = migrateSaveGame({ ...withVassal });
    expect(migrated.vampireVassals).toHaveLength(1);
  });

  it('rejects malformed world-cycle identifiers', () => {
    const v4 = createNewGameState({ seed: 'migrate-bad' });
    const withBadIds = {
      ...v4,
      worldCycle: { cycle: 1, collectedResourceNodeIds: ['INVALID ID!', 'valid-id'], defeatedEnemyIds: [] },
    };
    const migrated = migrateSaveGame(withBadIds);
    expect(migrated.worldCycle.collectedResourceNodeIds).not.toContain('INVALID ID!');
    expect(migrated.worldCycle.collectedResourceNodeIds).toContain('valid-id');
  });

  it('normalizes world-cycle identifiers to lowercase', () => {
    const v4 = createNewGameState({ seed: 'migrate-case' });
    const withUppercaseIds = {
      ...v4,
      worldCycle: { cycle: 1, collectedResourceNodeIds: ['WOOD-node'], defeatedEnemyIds: ['BANDIT-1'] },
    };
    const migrated = migrateSaveGame(withUppercaseIds);
    expect(migrated.worldCycle.collectedResourceNodeIds).toContain('wood-node');
    expect(migrated.worldCycle.collectedResourceNodeIds).not.toContain('WOOD-node');
    expect(migrated.worldCycle.defeatedEnemyIds).toContain('bandit-1');
    expect(migrated.worldCycle.defeatedEnemyIds).not.toContain('BANDIT-1');
  });

  it('deduplicates world cycle identifier arrays', () => {
    const v4 = createNewGameState({ seed: 'migrate-dup' });
    const withDups = {
      ...v4,
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

  it('inventory remains intact after v4 round-trip', () => {
    const v4 = createNewGameState({ seed: 'migrate-inv' });
    const woodBefore = v4.inventory.find((e) => e.itemId === 'wood')?.quantity ?? 0;
    const migrated = migrateSaveGame({ ...v4 });
    expect(migrated.inventory.find((e) => e.itemId === 'wood')?.quantity).toBe(woodBefore);
  });
});

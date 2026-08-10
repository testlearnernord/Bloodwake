import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { PLAYER_ACTIONS_BY_ID } from '../data/combatActions';
import { createInitialPlayerActionRuntime, startAction, stepAction } from '../simulation/combat/actionState';
import { createVampireVassal } from '../simulation/servants/vampireVassals';
import {
  chooseVassalCombatDecision,
  getVassalCombatEngagementRange,
  getVassalPredatoryBiteSuccessChance,
  resolveVassalPredatoryBiteSuccess,
  selectVassalCombatTarget,
  shouldVassalRetreat,
  type VassalCombatTarget,
} from '../simulation/combat/vassalCombatAi';
import { createEnemyRuntime, stepEnemyCombat } from '../simulation/combat/enemyCombat';
import { calculateVassalCombatStats } from '../simulation/combat/stats';

const createVassal = () => {
  const state = createNewGameState({ seed: 'vassal-combat' });
  const vassal = createVampireVassal({ ...state.player, id: 'vassal-ai', name: 'Alda' });
  vassal.operationalOrder = { type: 'companion', issuedDay: 1 };
  vassal.combat = 4;
  vassal.vitae = 5;
  return vassal;
};

const target = (overrides: Partial<VassalCombatTarget> = {}): VassalCombatTarget => ({
  id: 'enemy-1',
  type: 'bandit',
  name: 'Bandit',
  health: 12,
  maxHealth: 12,
  x: 80,
  y: 0,
  alive: true,
  active: true,
  hostile: true,
  elite: false,
  stateLabel: 'Approach',
  state: 'approach',
  ...overrides,
});

describe('0.6.4d1 shared Vassal combat AI', () => {
  it('uses operation-specific engagement ranges and keeps an existing lock slightly beyond acquisition range', () => {
    const vassal = createVassal();
    expect(getVassalCombatEngagementRange('scout')).toBeLessThan(getVassalCombatEngagementRange('raid'));
    const acquired = selectVassalCombatTarget(vassal, { x: 0, y: 0 }, { x: 0, y: 0 }, [target({ x: 300 })], null);
    expect(acquired?.id).toBe('enemy-1');
    const retained = selectVassalCombatTarget(vassal, { x: 0, y: 0 }, { x: 0, y: 0 }, [target({ x: 430 })], 'enemy-1');
    expect(retained?.id).toBe('enemy-1');
  });

  it('retreats earlier on Scout than Raid orders', () => {
    const scout = createVassal();
    scout.operationalOrder = { type: 'scout', issuedDay: 1 };
    scout.health = Math.floor(scout.maxHealth * 0.5);
    const raid = { ...scout, operationalOrder: { type: 'raid' as const, issuedDay: 1 } };
    expect(shouldVassalRetreat(scout)).toBe(true);
    expect(shouldVassalRetreat(raid)).toBe(false);
  });

  it('dodges telegraphed close attacks and uses Blood Lance at range', () => {
    const vassal = createVassal();
    const runtime = createInitialPlayerActionRuntime();
    const dodge = chooseVassalCombatDecision(vassal, { x: 0, y: 0 }, target({ x: 70, state: 'windup' }), runtime, 1000);
    expect(dodge.actionId).toBe('dodge');
    const ranged = chooseVassalCombatDecision(vassal, { x: 0, y: 0 }, target({ x: 240 }), runtime, 1000);
    expect(ranged.actionId).toBe('blood_lance');
  });

  it('uses Predatory Bite as a weakened-prey Vitae recovery decision', () => {
    const vassal = createVassal();
    vassal.vitae = 1;
    const decision = chooseVassalCombatDecision(vassal, { x: 0, y: 0 }, target({ x: 40, health: 3, state: 'stagger' }), createInitialPlayerActionRuntime(), 1000);
    expect(decision.actionId).toBe('bite');
    expect(getVassalPredatoryBiteSuccessChance(vassal, false)).toBeGreaterThan(getVassalPredatoryBiteSuccessChance(vassal, true));
    expect(resolveVassalPredatoryBiteSuccess('seed', 2, vassal, 'enemy-1', false, 1)).toBe(resolveVassalPredatoryBiteSuccess('seed', 2, vassal, 'enemy-1', false, 1));
  });

  it('reuses the player action runtime for Vassal windup/active/recovery timing and Vitae costs', () => {
    const vassal = createVassal();
    const started = startAction(PLAYER_ACTIONS_BY_ID.heavy, createInitialPlayerActionRuntime(), {
      now: 0,
      blocked: false,
      dead: false,
      activeMenuOpen: false,
      currentVitae: vassal.vitae,
    });
    if (!started.ok) throw new Error('Heavy should start.');
    const active = stepAction(started.runtime, PLAYER_ACTIONS_BY_ID.heavy.windupMs);
    expect(active.runtime.state).toBe('heavy_active');
    expect(active.committedCost).toBe(true);
  });

  it('lets enemy combat emit damage against a locked Vassal id rather than hard-coding player', () => {
    let enemy = createEnemyRuntime('bandit-1', 'bandit', { x: 0, y: 0 });
    enemy = { ...enemy, state: 'windup', phaseEndsAt: 100, targetId: 'vassal-ai' };
    const stepped = stepEnemyCombat(enemy, { x: 10, y: 0 }, 100, 0, 'vassal-ai');
    expect(stepped.damageEvents[0]?.targetId).toBe('vassal-ai');
  });

  it('derives Vassal combat damage from Vampire attributes, combat skill and current Vitae state', () => {
    const vassal = createVassal();
    const healthy = calculateVassalCombatStats(vassal);
    const depleted = calculateVassalCombatStats({ ...vassal, vitae: 0 });
    expect(healthy.attackDamage).toBeGreaterThanOrEqual(depleted.attackDamage);
    expect(healthy.attackDamage).toBeGreaterThan(0);
  });
});

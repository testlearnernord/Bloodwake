import type { EnemyDefinition } from '../types/models';

export const ENEMIES: EnemyDefinition[] = [
  { id: 'bandit', name: 'Bandit', health: 12, damage: 3, speed: 42 },
  { id: 'clergy_hunter', name: 'Clergy Hunter', health: 14, damage: 4, speed: 38 },
  { id: 'elite_knight', name: 'Knight-Errant', health: 22, damage: 6, speed: 34, elite: true },
];

export const ENEMIES_BY_ID = Object.fromEntries(ENEMIES.map((enemy) => [enemy.id, enemy]));

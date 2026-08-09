import {
  ESCAPED_HUMAN_DORMANT_CAP,
  ESCAPED_HUMAN_RETENTION_DAYS,
  ESCAPED_HUMAN_RETURN_CHANCE,
  ESCAPED_HUMAN_RETURN_MAX_DAYS,
  ESCAPED_HUMAN_RETURN_MIN_DAYS,
  HUMAN_REGIONAL_POOL_TARGET,
} from '../../config/balancing';
import type { EnemyType, HumanCharacter, ItemId } from '../../types/models';
import { SeededRng } from '../../utilities/rng';
import { generateHumanFromSeed } from './humans';

export interface WorldPoint {
  x: number;
  y: number;
}

export interface NightlyEnemySpawn extends WorldPoint {
  id: string;
  type: EnemyType;
}

export interface NightlyResourceNode extends WorldPoint {
  id: string;
  itemId: Extract<ItemId, 'wood' | 'herbs' | 'iron_ore' | 'stone' | 'food'>;
  amount: number;
}

export interface NightlyHumanPopulationResult {
  npcs: HumanCharacter[];
  events: string[];
  newHumanIds: string[];
  returnedHumanIds: string[];
  prunedHumanIds: string[];
}

const HUMAN_POSITION_SLOTS: readonly WorldPoint[] = [
  { x: 890, y: 190 },
  { x: 980, y: 255 },
  { x: 1110, y: 205 },
  { x: 1190, y: 320 },
  { x: 1040, y: 405 },
  { x: 900, y: 465 },
  { x: 1130, y: 545 },
  { x: 980, y: 590 },
];

const ENEMY_POSITION_SLOTS: readonly WorldPoint[] = [
  { x: 455, y: 205 },
  { x: 560, y: 330 },
  { x: 690, y: 205 },
  { x: 760, y: 465 },
  { x: 865, y: 345 },
  { x: 1030, y: 160 },
  { x: 1170, y: 400 },
  { x: 1060, y: 595 },
];

const RESOURCE_POSITION_SLOTS: readonly WorldPoint[] = [
  { x: 390, y: 280 },
  { x: 470, y: 470 },
  { x: 610, y: 175 },
  { x: 650, y: 585 },
  { x: 790, y: 285 },
  { x: 850, y: 540 },
  { x: 985, y: 140 },
  { x: 1180, y: 245 },
  { x: 1115, y: 520 },
];

const jitterPoint = (base: WorldPoint, rng: SeededRng, maxX: number, maxY: number): WorldPoint => ({
  x: base.x + rng.nextInt(-maxX, maxX),
  y: base.y + rng.nextInt(-maxY, maxY),
});

export const getNightlyHumanPosition = (seed: string, day: number, humanId: string, index: number): WorldPoint => {
  const rng = new SeededRng(`${seed}-night-${day}-human-position-${humanId}`);
  const slot = HUMAN_POSITION_SLOTS[index % HUMAN_POSITION_SLOTS.length];
  return jitterPoint(slot, rng, 22, 18);
};

const takeSlot = (slots: WorldPoint[], rng: SeededRng): WorldPoint => {
  const index = rng.nextInt(0, slots.length - 1);
  const [slot] = slots.splice(index, 1);
  return slot;
};

export const getNightlyEnemySpawns = (seed: string, day: number): NightlyEnemySpawn[] => {
  const rng = new SeededRng(`${seed}-night-${day}-enemies`);
  const slots = [...ENEMY_POSITION_SLOTS];
  const count = rng.nextInt(2, 4);
  const eliteWeight = Math.min(0.08 + day * 0.012, 0.24);
  return Array.from({ length: count }, (_, index) => {
    const selected = rng.weightedPick([
      { type: 'bandit' as const, weight: 0.58 },
      { type: 'clergy_hunter' as const, weight: 0.34 },
      { type: 'elite_knight' as const, weight: eliteWeight },
    ]);
    const point = jitterPoint(takeSlot(slots, rng), rng, 26, 24);
    return {
      id: `enemy-d${day}-${index + 1}`,
      type: selected.type,
      ...point,
    };
  });
};

export const getNightlyResourceNodes = (seed: string, day: number): NightlyResourceNode[] => {
  const rng = new SeededRng(`${seed}-night-${day}-resources`);
  const slots = [...RESOURCE_POSITION_SLOTS];
  const count = rng.nextInt(4, 6);
  return Array.from({ length: count }, (_, index) => {
    const selected = rng.weightedPick([
      { itemId: 'wood' as const, weight: 0.30 },
      { itemId: 'herbs' as const, weight: 0.20 },
      { itemId: 'iron_ore' as const, weight: 0.15 },
      { itemId: 'stone' as const, weight: 0.18 },
      { itemId: 'food' as const, weight: 0.17 },
    ]);
    const point = jitterPoint(takeSlot(slots, rng), rng, 24, 22);
    return {
      id: `resource-d${day}-${selected.itemId.replace('_', '-')}-${index + 1}`,
      itemId: selected.itemId,
      amount: selected.itemId === 'wood' ? rng.nextInt(2, 4) : rng.nextInt(1, 3),
      ...point,
    };
  });
};

export const markHumanEscaped = (human: HumanCharacter, seed: string, day: number): HumanCharacter => {
  const rng = new SeededRng(`${seed}-escaped-${human.id}-${day}`);
  const scheduledReturnDay = rng.chance(ESCAPED_HUMAN_RETURN_CHANCE)
    ? day + rng.nextInt(ESCAPED_HUMAN_RETURN_MIN_DAYS, ESCAPED_HUMAN_RETURN_MAX_DAYS)
    : null;
  return {
    ...human,
    status: 'wandering',
    worldPresence: 'dormant',
    dormantReason: 'escaped',
    dormantSinceDay: day,
    scheduledReturnDay,
    lastSeenDay: Math.max(1, day - 1),
  };
};

const isRegionalCandidate = (human: HumanCharacter): boolean =>
  human.status === 'wandering'
  && !(human.worldPresence === 'dormant' && human.dormantReason === 'escaped');

const escapedRetentionScore = (human: HumanCharacter): number =>
  Object.keys(human.relationships).length * 100
  + human.bloodResonance * 10
  + human.traitIds.length * 3
  + Math.min(20, Math.max(0, human.fear) / 5);

export const resolveNightlyHumanPopulation = (
  existingNpcs: HumanCharacter[],
  seed: string,
  day: number,
  activeTarget: number,
): NightlyHumanPopulationResult => {
  const events: string[] = [];
  const newHumanIds: string[] = [];
  const returnedEligibleIds = new Set<string>();
  const prunedHumanIds: string[] = [];

  let records = existingNpcs.map((human) => human.status === 'fed' ? { ...human, status: 'wandering' as const } : { ...human });

  records = records.map((human) => {
    if (
      human.worldPresence === 'dormant'
      && human.dormantReason === 'escaped'
      && human.scheduledReturnDay !== null
      && day >= human.scheduledReturnDay
    ) {
      returnedEligibleIds.add(human.id);
      return {
        ...human,
        worldPresence: 'dormant' as const,
        dormantReason: 'regional' as const,
        dormantSinceDay: day,
        scheduledReturnDay: null,
      };
    }
    return human;
  });

  const expiredEscapedIds = new Set(
    records
      .filter((human) =>
        human.worldPresence === 'dormant'
        && human.dormantReason === 'escaped'
        && human.dormantSinceDay !== null
        && day - human.dormantSinceDay > ESCAPED_HUMAN_RETENTION_DAYS,
      )
      .map((human) => human.id),
  );
  for (const id of expiredEscapedIds) prunedHumanIds.push(id);
  records = records.filter((human) => !expiredEscapedIds.has(human.id));

  const escaped = records
    .filter((human) => human.worldPresence === 'dormant' && human.dormantReason === 'escaped')
    .sort((left, right) => {
      const relevance = escapedRetentionScore(right) - escapedRetentionScore(left);
      if (relevance !== 0) return relevance;
      return (right.dormantSinceDay ?? 0) - (left.dormantSinceDay ?? 0);
    });
  const keepEscapedIds = new Set(escaped.slice(0, ESCAPED_HUMAN_DORMANT_CAP).map((human) => human.id));
  const overflowIds = new Set(escaped.slice(ESCAPED_HUMAN_DORMANT_CAP).map((human) => human.id));
  for (const id of overflowIds) {
    if (!prunedHumanIds.includes(id)) prunedHumanIds.push(id);
  }
  records = records.filter((human) => !(human.dormantReason === 'escaped' && !keepEscapedIds.has(human.id)));

  const ids = new Set(records.map((human) => human.id));
  let regionalCandidates = records.filter(isRegionalCandidate);
  let serial = 1;
  while (regionalCandidates.length < HUMAN_REGIONAL_POOL_TARGET) {
    const id = `human-d${day}-${serial}`;
    if (ids.has(id)) {
      serial += 1;
      continue;
    }
    const human = generateHumanFromSeed(`${seed}-day-${day}-spawn-${serial}`, id, day);
    records.push(human);
    regionalCandidates.push(human);
    ids.add(id);
    newHumanIds.push(id);
    serial += 1;
  }

  const ranked = regionalCandidates
    .map((human) => ({
      human,
      score: new SeededRng(`${seed}-night-${day}-roster-${human.id}`).next(),
    }))
    .sort((left, right) => right.score - left.score || left.human.id.localeCompare(right.human.id));
  const activeIds = new Set(ranked.slice(0, Math.max(0, activeTarget)).map((entry) => entry.human.id));

  records = records.map((human) => {
    if (!isRegionalCandidate(human)) return human;
    if (activeIds.has(human.id)) {
      return {
        ...human,
        worldPresence: 'active' as const,
        dormantReason: null,
        dormantSinceDay: null,
        scheduledReturnDay: null,
        lastSeenDay: day,
      };
    }
    return {
      ...human,
      worldPresence: 'dormant' as const,
      dormantReason: 'regional' as const,
      dormantSinceDay: human.worldPresence === 'dormant' && human.dormantReason === 'regional'
        ? human.dormantSinceDay ?? day
        : day,
      scheduledReturnDay: null,
    };
  });

  const returnedHumanIds = [...returnedEligibleIds].filter((id) => activeIds.has(id));
  for (const id of returnedHumanIds) {
    const human = records.find((candidate) => candidate.id === id);
    if (human) events.push(`${human.name} ${human.familyName}, once escaped, has resurfaced near the village.`);
  }
  if (newHumanIds.length > 0) {
    events.push(`${newHumanIds.length} new human ${newHumanIds.length === 1 ? 'face arrives' : 'faces arrive'} in the region.`);
  }

  return { npcs: records, events, newHumanIds, returnedHumanIds, prunedHumanIds };
};

import { DEFAULT_SETTINGS } from '../config/balancing';
import { GAME_TITLE, SAVE_FORMAT_VERSION } from '../config/game';
import { COLLECTIBLES } from '../data/collectibles';
import { QUESTS_BY_ID } from '../data/quests';
import { ROOMS_BY_ID } from '../data/rooms';
import type { BuiltRoom, CraftingOrder, HumanCharacter, NewGameOptions, SaveGame, VampireCharacter } from '../types/models';
import { generateStartingVampire } from '../simulation/bloodlines/generation';
import { createInitialQuestState } from '../simulation/quests/quests';
import { generateHumans } from '../simulation/world/humans';

const createStartingRooms = (): BuiltRoom[] => [
  {
    id: 'room-coffin-0-0',
    roomId: 'coffin_chamber',
    x: 0,
    y: 0,
    width: ROOMS_BY_ID.coffin_chamber.footprint.width,
    height: ROOMS_BY_ID.coffin_chamber.footprint.height,
    status: 'built',
    progress: 0,
    assignedWorkerIds: [],
  },
];

export const deriveCharacterSeed = (seed: string, characterRoll: number): string => `${seed}::roll-${characterRoll}`;

export const createNewGameState = (options: NewGameOptions = {}): SaveGame => {
  const worldSeed = options.seed?.trim() || '1042';
  const characterRoll = Number.isInteger(options.characterRoll) ? Math.max(0, options.characterRoll ?? 0) : 0;
  const { vampire } = generateStartingVampire({
    ...options,
    seed: deriveCharacterSeed(worldSeed, characterRoll),
  });
  const humans = generateHumans(worldSeed, 5);
  const player: VampireCharacter = { ...vampire, equipment: {} };
  return {
    version: SAVE_FORMAT_VERSION,
    title: GAME_TITLE,
    seed: worldSeed,
    characterRoll,
    player,
    npcs: humans,
    humanServants: [],
    bloodDonors: [],
    vampireVassals: [],
    bloodStock: { amount: 0 },
    strategicResources: {
      bloodEssence: 1,
      security: 0,
      gold: 0,
      knowledge: 0,
      influence: 0,
    },
    inventory: [
      { itemId: 'wood', quantity: 12 },
      { itemId: 'stone', quantity: 10 },
      { itemId: 'iron_ore', quantity: 4 },
      { itemId: 'leather', quantity: 2 },
      { itemId: 'herbs', quantity: 2 },
      { itemId: 'food', quantity: 4 },
      { itemId: 'memory_talisman', quantity: 1, quality: 'Common' },
    ],
    rooms: createStartingRooms(),
    craftingQueue: [] as CraftingOrder[],
    time: { day: 1, phase: 'night' },
    worldCycle: { cycle: 1, collectedResourceNodeIds: [], defeatedEnemyIds: [] },
    quests: createInitialQuestState(),
    collectibles: COLLECTIBLES.map((collectible) => ({ collectibleId: collectible.id, discovered: false })),
    inheritanceHistory: [],
    settings: { ...DEFAULT_SETTINGS },
    lastEventLog: [`${GAME_TITLE} begins anew.`],
  };
};

export const getHumanById = (state: SaveGame, humanId: string): HumanCharacter | undefined =>
  state.npcs.find((human) => human.id === humanId);

export const getQuestState = (state: SaveGame) => state.quests[0];

export const getActiveQuestStepText = (state: SaveGame): string => {
  const quest = QUESTS_BY_ID.awakening;
  const questState = getQuestState(state);
  return quest.steps.find((step) => step.id === questState.activeStepId)?.text ?? 'All steps complete.';
};

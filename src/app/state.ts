import { DEFAULT_SETTINGS } from '../config/balancing';
import { GAME_TITLE, SAVE_FORMAT_VERSION } from '../config/game';
import { COLLECTIBLES } from '../data/collectibles';
import { QUESTS_BY_ID } from '../data/quests';
import { ROOMS_BY_ID } from '../data/rooms';
import type { BuiltRoom, CraftingOrder, HumanCharacter, NewGameOptions, SaveGame, Servant, VampireCharacter } from '../types/models';
import { generateStartingVampire } from '../simulation/bloodlines/generation';
import { createInitialQuestState } from '../simulation/quests/quests';
import { generateHumans } from '../simulation/world/humans';

const createStarterServant = (): Servant => ({
  id: 'servant-steward',
  name: 'Matilda',
  age: 39,
  professionId: 'woodcutter',
  attributes: {
    strength: 3,
    agility: 3,
    vitality: 4,
    willpower: 3,
    intelligence: 2,
    presence: 2,
    bloodControl: 0,
  },
  traitIds: ['industrious'],
  health: 12,
  maxHealth: 12,
  morale: 55,
  loyalty: 52,
  ambition: 35,
  stress: 10,
  combat: 2,
  type: 'human',
  professionSkills: { Gathering: 2, Building: 2 },
  priorities: {
    Building: 'High',
    Crafting: 'Normal',
    Gathering: 'High',
    Guarding: 'Low',
    Research: 'Disabled',
    Hunting: 'Low',
  },
  currentJob: null,
  currentTask: null,
  taskReason: 'Waiting for orders.',
  hunger: 0,
  equipped: {},
});

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

export const createNewGameState = (options: NewGameOptions = {}): SaveGame => {
  const { seed, vampire } = generateStartingVampire(options);
  const humans = generateHumans(seed, 5);
  const player: VampireCharacter = { ...vampire };
  return {
    version: SAVE_FORMAT_VERSION,
    title: GAME_TITLE,
    seed,
    player,
    npcs: humans,
    servants: [createStarterServant()],
    resources: {
      Wood: 12,
      Stone: 10,
      'Iron Ore': 4,
      Leather: 2,
      Herbs: 2,
      Food: 4,
      'Blood Essence': 1,
      Security: 0,
    },
    inventory: [{ itemId: 'memory_talisman', quantity: 1, quality: 'Common' }],
    rooms: createStartingRooms(),
    constructionTasks: [],
    craftingQueue: [] as CraftingOrder[],
    time: { day: 1, phase: 'night' },
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

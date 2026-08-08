export type AttributeKey =
  | 'strength'
  | 'agility'
  | 'vitality'
  | 'willpower'
  | 'intelligence'
  | 'presence'
  | 'bloodControl';

export type TraitRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'negative';
export type TraitClassification = 'positive' | 'negative';
export type TraitInheritanceMode = 'dominant' | 'recessive';
export type TraitCategory = 'physical' | 'mental' | 'social' | 'mystic' | 'curse';
export type TraitEffectId = 'retain_extra_human_trait' | 'day_restriction_penalty' | 'feed_bonus';
export type ProfessionId =
  | 'peasant'
  | 'woodcutter'
  | 'hunter'
  | 'blacksmith'
  | 'herbalist'
  | 'guard'
  | 'monk'
  | 'scribe';
export type FactionId = 'village' | 'bandit' | 'clergy' | 'wild';
export type RoomId = 'coffin_chamber' | 'storage_room' | 'workshop' | 'servant_quarters' | 'blood_cellar';
export type JobType = 'Building' | 'Crafting' | 'Gathering' | 'Guarding' | 'Research' | 'Hunting';
export type JobPriority = 'Disabled' | 'Low' | 'Normal' | 'High' | 'Critical';
export type DayPhase = 'day' | 'night';
export type QualityLevel = 'Poor' | 'Common' | 'Fine' | 'Masterwork';
export type ItemSlot = 'Weapon' | 'Armor' | 'Accessory';
export type QuestStepStatus = 'locked' | 'active' | 'complete';
export type EnemyType = 'bandit' | 'clergy_hunter' | 'elite_knight';
export type TaskType = 'construct_room' | 'craft_recipe' | 'gather_resource' | 'guard_stronghold';
export type HumanStatus = 'wandering' | 'fed' | 'drained' | 'turned';
export type ItemCategory = 'material' | 'weapon' | 'armor' | 'accessory' | 'consumable' | 'quest' | 'relic';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemId =
  | 'wood'
  | 'stone'
  | 'iron_ore'
  | 'iron_ingot'
  | 'leather'
  | 'herbs'
  | 'food'
  | 'wood_planks'
  | 'simple_sword'
  | 'leather_armor'
  | 'healing_draught'
  | 'memory_talisman';

export type DomainResourceId = 'bloodEssence' | 'security' | 'gold' | 'knowledge' | 'influence';

export type AttributeSet = Record<AttributeKey, number>;
export type ItemQuantityMap = Partial<Record<ItemId, number>>;
export type DomainResourcePool = Record<DomainResourceId, number>;
export type ItemModifier = Partial<Record<AttributeKey | 'damage' | 'armor' | 'healing', number>>;

export interface TraitDefinition {
  id: string;
  name: string;
  description: string;
  rarity: TraitRarity;
  category: TraitCategory;
  classification: TraitClassification;
  tags: string[];
  modifiers: ItemModifier;
  inheritanceWeight: number;
  mutationWeight: number;
  incompatibleTraitIds: string[];
  requiredTraitIds: string[];
  humanOnly?: boolean;
  vampireOnly?: boolean;
  inheritable: boolean;
  inheritanceMode: TraitInheritanceMode;
  effectId?: TraitEffectId;
}

export interface ProfessionDefinition {
  id: ProfessionId;
  name: string;
  description: string;
  defaultFaction: FactionId;
  jobBonuses: Partial<Record<JobType, number>>;
  attributeBonuses: Partial<AttributeSet>;
  practicalBenefit: string;
}

export interface CharacterBase {
  id: string;
  name: string;
  age: number;
  professionId: ProfessionId;
  attributes: AttributeSet;
  traitIds: string[];
  health: number;
  maxHealth: number;
  morale: number;
  loyalty: number;
  ambition: number;
  stress: number;
  combat: number;
}

export interface HumanCharacter extends CharacterBase {
  familyName: string;
  factionId: FactionId;
  bloodQuality: number;
  recruitability: number;
  status: HumanStatus;
  relationships: Record<string, number>;
}

export interface EquipmentLoadout {
  Weapon?: ItemId;
  Armor?: ItemId;
  Accessory?: ItemId;
}

export interface VampireCharacter extends CharacterBase {
  vitae: number;
  maxVitae: number;
  bloodEssence: number;
  hunger: number;
  memoryFragments: string[];
  professionSkills: Partial<Record<JobType, number>>;
  equipment: EquipmentLoadout;
}

export interface JobPriorityMap {
  [key: string]: JobPriority;
  Building: JobPriority;
  Crafting: JobPriority;
  Gathering: JobPriority;
  Guarding: JobPriority;
  Research: JobPriority;
  Hunting: JobPriority;
}

/** Shared fields for all explicit population types. */
export interface PopulationBase {
  id: string;
  name: string;
  age: number;
  professionId: ProfessionId;
  attributes: AttributeSet;
  traitIds: string[];
  health: number;
  maxHealth: number;
  morale: number;
  loyalty: number;
  ambition: number;
  stress: number;
  combat: number;
  professionSkills: Partial<Record<JobType, number>>;
  priorities: JobPriorityMap;
  currentJob: JobType | null;
  currentTask: string | null;
  taskReason: string;
  hunger: number;
  equipped: Partial<Record<ItemSlot, ItemId>>;
}

/** Explicit population type for a human who has been recruited as a servant. */
export interface HumanServant extends PopulationBase {
  kind: 'human_servant';
}

/** Explicit population type for a vampire who serves the player. */
export interface VampireVassal extends PopulationBase {
  kind: 'vampire_vassal';
  vitae: number;
  maxVitae: number;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  description: string;
  iconId: string;
  footprint: { width: number; height: number };
  constructionCostItems: ItemQuantityMap;
  constructionCostResources?: Partial<DomainResourcePool>;
  constructionTime: number;
  requiredRoomId?: RoomId;
  workerSlots: number;
  storageCapacity: number;
  productionCapabilities: string[];
  modifiers: ItemModifier;
  allowedJobTypes: JobType[];
}

export interface BuiltRoom {
  id: string;
  roomId: RoomId;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'built' | 'under_construction';
  progress: number;
  assignedWorkerIds: string[];
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  iconId: string;
  stackLimit: number;
  baseValue: number;
  tags: string[];
  equipSlot?: ItemSlot;
  modifiers: ItemModifier;
  consumableEffectId?: 'heal_player';
  questItem?: boolean;
}

export interface InventoryEntry {
  itemId: ItemId;
  quantity: number;
  quality?: QualityLevel;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  description: string;
  category: 'materials' | 'equipment' | 'alchemy';
  inputs: ItemQuantityMap;
  outputs: InventoryEntry[];
  requiredRoomId: RoomId;
  requiredProfessionId?: ProfessionId;
  workAmount: number;
  minimumQuality: QualityLevel;
  traitModifierTags: string[];
}

export interface CraftingOrder {
  id: string;
  recipeId: string;
  progress: number;
  assignedServantId: string | null;
  status: 'queued' | 'complete';
}

export interface ConstructionTask {
  roomInstanceId: string;
  progress: number;
}

export interface QuestStepDefinition {
  id: string;
  text: string;
}

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  steps: QuestStepDefinition[];
}

export interface QuestState {
  questId: string;
  activeStepId: string;
  completedStepIds: string[];
}

export interface CollectibleDefinition {
  id: string;
  name: string;
  lore: string;
  reward: Partial<AttributeSet>;
}

export interface CollectibleState {
  collectibleId: string;
  discovered: boolean;
}

export interface EnemyDefinition {
  id: EnemyType;
  name: string;
  health: number;
  speed: number;
  detectionRange: number;
  preferredDistance: number;
  attackIds: string[];
  poise: number;
  description: string;
  roleLabel: string;
  elite?: boolean;
}

export interface ServantEventDefinition {
  id: string;
  title: string;
  description: string;
  condition: 'low_morale' | 'ambitious_vampire' | 'loyal_bonus';
  effect: {
    morale?: number;
    loyalty?: number;
    productivity?: number;
  };
}

export interface TaskCandidate {
  id: string;
  type: TaskType;
  jobType: JobType;
  score: number;
  reason: string;
}

export interface InheritanceReport {
  originalHumanTraits: string[];
  sireTraits: string[];
  finalTraits: string[];
  inheritedTraits: string[];
  retainedTraits: string[];
  mutations: string[];
  removedIncompatibleTraits: string[];
}

export interface TimeState {
  day: number;
  phase: DayPhase;
}

export interface WorldCycleState {
  cycle: number;
  collectedResourceNodeIds: string[];
  defeatedEnemyIds: string[];
}

export interface SaveGame {
  version: number;
  title: string;
  seed: string;
  characterRoll: number;
  player: VampireCharacter;
  npcs: HumanCharacter[];
  humanServants: HumanServant[];
  vampireVassals: VampireVassal[];
  strategicResources: DomainResourcePool;
  inventory: InventoryEntry[];
  rooms: BuiltRoom[];
  constructionTasks: ConstructionTask[];
  craftingQueue: CraftingOrder[];
  time: TimeState;
  worldCycle: WorldCycleState;
  quests: QuestState[];
  collectibles: CollectibleState[];
  inheritanceHistory: InheritanceReport[];
  settings: {
    volume: number;
    uiScale: number;
  };
  lastEventLog: string[];
}

export interface SaveSlot {
  id: string;
  updatedAt: number;
  data: SaveGame;
}

export interface NewGameOptions {
  playerName?: string;
  seed?: string;
  characterRoll?: number;
}

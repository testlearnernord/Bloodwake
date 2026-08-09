import {
  ENTHRALL_VITAE_COST,
  HUMAN_BASE_HOUSING_CAPACITY,
  THRALL_CONTROL_BASE,
  THRALL_CONTROL_BLOOD_CONTROL_BONUS,
  THRALL_CONTROL_DECAY_BASE,
  THRALL_CONTROL_DECAY_PER_RESISTANCE,
  THRALL_CONTROL_FEAR_BONUS,
  THRALL_CONTROL_RESOLVE_PENALTY,
  THRALL_FOOD_PER_DAY,
  THRALL_REASSERT_CONTROL_GAIN,
  THRALL_REASSERT_FEAR_GAIN,
  THRALL_REASSERT_STRESS_GAIN,
  THRALL_REASSERT_VITAE_COST,
  THRALL_STARVATION_CONTROL_PENALTY,
  THRALL_STARVATION_STRESS_GAIN,
} from '../../config/balancing';
import { ROOMS_BY_ID } from '../../data/rooms';
import type { BuiltRoom, HumanCharacter, HumanServant, SaveGame, VampireCharacter } from '../../types/models';
import { getItemQuantity, removeItem } from '../inventory/inventory';

export type ThrallControlState = 'Dominated' | 'Subdued' | 'Unstable' | 'Defiant' | 'Breaking';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const getThrallControlState = (control: number): ThrallControlState => {
  if (control >= 80) return 'Dominated';
  if (control >= 60) return 'Subdued';
  if (control >= 40) return 'Unstable';
  if (control >= 20) return 'Defiant';
  return 'Breaking';
};

export const getHumanHousingCapacity = (rooms: BuiltRoom[]): number =>
  HUMAN_BASE_HOUSING_CAPACITY + rooms
    .filter((room) => room.status === 'built')
    .reduce((total, room) => total + (ROOMS_BY_ID[room.roomId]?.housingCapacity ?? 0), 0);

export const calculateThrallResistance = (human: HumanCharacter): number => clamp(Math.round(human.resolve), 1, 5);

export const calculateInitialThrallControl = (player: VampireCharacter, human: HumanCharacter): number =>
  clamp(
    Math.round(
      THRALL_CONTROL_BASE
      + player.attributes.bloodControl * THRALL_CONTROL_BLOOD_CONTROL_BONUS
      + human.fear * THRALL_CONTROL_FEAR_BONUS
      - human.resolve * THRALL_CONTROL_RESOLVE_PENALTY,
    ),
    35,
    95,
  );

export const validateEnthrallHuman = (state: SaveGame, human: HumanCharacter): { ok: true } | { ok: false; reason: string } => {
  if (state.time.phase !== 'night') return { ok: false, reason: 'Enthrallment requires the cover of night.' };
  if (state.player.vitae < ENTHRALL_VITAE_COST) return { ok: false, reason: `Enthrallment requires ${ENTHRALL_VITAE_COST} Vitae.` };
  if (state.humanServants.some((servant) => servant.id === human.id)) return { ok: false, reason: 'This human is already enthralled.' };
  const capacity = getHumanHousingCapacity(state.rooms);
  if (state.humanServants.length >= capacity) return { ok: false, reason: `Human housing is full (${state.humanServants.length}/${capacity}). Build Servant Quarters.` };
  return { ok: true };
};

export const createHumanThrall = (player: VampireCharacter, human: HumanCharacter): HumanServant => ({
  kind: 'human_servant',
  id: human.id,
  name: human.name,
  familyName: human.familyName,
  age: human.age,
  professionId: human.professionId,
  attributes: { ...human.attributes },
  traitIds: [...human.traitIds],
  factionId: human.factionId,
  bloodResonance: human.bloodResonance,
  resolve: human.resolve,
  disposition: human.disposition,
  fear: human.fear,
  relationships: { ...human.relationships },
  resistance: calculateThrallResistance(human),
  control: calculateInitialThrallControl(player, human),
  health: human.health,
  maxHealth: human.maxHealth,
  stress: Math.max(15, human.stress),
  combat: human.combat,
  professionSkills: {},
  priorities: {
    Building: 'Normal',
    Crafting: 'Normal',
    Gathering: 'Normal',
    Guarding: 'Disabled',
    Research: 'Disabled',
    Hunting: 'Low',
  },
  currentJob: null,
  currentTask: null,
  taskReason: 'Held in the stronghold under vampiric control.',
  equipped: {},
});

export const validateReassertThrallControl = (state: SaveGame, servant: HumanServant): { ok: true } | { ok: false; reason: string } => {
  if (state.time.phase !== 'night') return { ok: false, reason: 'You can only reassert vampiric control at night.' };
  if (state.player.vitae < THRALL_REASSERT_VITAE_COST) return { ok: false, reason: `Requires ${THRALL_REASSERT_VITAE_COST} Vitae.` };
  if (servant.control >= 100) return { ok: false, reason: 'Control is already absolute.' };
  return { ok: true };
};

export const reassertThrallControl = (state: SaveGame, servantId: string): { state: SaveGame; message: string } => {
  const servant = state.humanServants.find((candidate) => candidate.id === servantId);
  if (!servant) return { state, message: 'Human thrall not found.' };
  const check = validateReassertThrallControl(state, servant);
  if (!check.ok) return { state, message: check.reason };
  const nextControl = clamp(servant.control + THRALL_REASSERT_CONTROL_GAIN, 0, 100);
  const nextServant: HumanServant = {
    ...servant,
    control: nextControl,
    fear: clamp(servant.fear + THRALL_REASSERT_FEAR_GAIN, 0, 100),
    stress: clamp(servant.stress + THRALL_REASSERT_STRESS_GAIN, 0, 100),
    taskReason: 'The vampiric bond has been freshly reinforced.',
  };
  return {
    state: {
      ...state,
      player: { ...state.player, vitae: state.player.vitae - THRALL_REASSERT_VITAE_COST },
      humanServants: state.humanServants.map((candidate) => candidate.id === servantId ? nextServant : candidate),
      lastEventLog: [`Reasserted control over ${servant.name}. Control ${servant.control} -> ${nextControl}.`, ...state.lastEventLog].slice(0, 20),
    },
    message: `Control over ${servant.name} rises to ${nextControl}.`,
  };
};

export interface HumanThrallDayResult {
  humanServants: HumanServant[];
  inventory: SaveGame['inventory'];
  escapedHumanIds: string[];
  events: string[];
}

export const resolveHumanThrallDay = (state: SaveGame): HumanThrallDayResult => {
  const servants = state.humanServants;
  if (servants.length === 0) return { humanServants: [], inventory: state.inventory, escapedHumanIds: [], events: [] };

  const foodRequired = servants.length * THRALL_FOOD_PER_DAY;
  const foodAvailable = getItemQuantity(state.inventory, 'food');
  const foodConsumed = Math.min(foodRequired, foodAvailable);
  const shortageRatio = foodRequired > 0 ? (foodRequired - foodConsumed) / foodRequired : 0;
  const starvationControlPenalty = Math.round(THRALL_STARVATION_CONTROL_PENALTY * shortageRatio);
  const starvationStressGain = Math.round(THRALL_STARVATION_STRESS_GAIN * shortageRatio);
  const inventory = foodConsumed > 0 ? removeItem(state.inventory, 'food', foodConsumed) : state.inventory;
  const events: string[] = [];
  const escapedHumanIds: string[] = [];
  const humanServants: HumanServant[] = [];

  if (foodConsumed > 0) events.push(`Human thralls consume ${foodConsumed}/${foodRequired} Food.`);
  if (shortageRatio > 0) events.push(`Food shortage weakens the mortal thralls (${Math.round(shortageRatio * 100)}% ration deficit).`);

  for (const servant of servants) {
    const controlDecay = THRALL_CONTROL_DECAY_BASE + servant.resistance * THRALL_CONTROL_DECAY_PER_RESISTANCE + starvationControlPenalty;
    const nextControl = clamp(servant.control - controlDecay, 0, 100);
    const nextStress = clamp(servant.stress + starvationStressGain, 0, 100);
    if (nextControl <= 0) {
      escapedHumanIds.push(servant.id);
      events.push(`${servant.name} breaks the thrall bond and escapes the stronghold.`);
      continue;
    }
    humanServants.push({
      ...servant,
      control: nextControl,
      stress: nextStress,
      taskReason: nextControl < 20 ? 'The vampiric bond is close to breaking.' : servant.taskReason,
    });
  }
  if (humanServants.length > 0) events.push(`Thrall Control decays after the day; higher Resistance accelerates the loss.`);
  return { humanServants, inventory, escapedHumanIds, events };
};

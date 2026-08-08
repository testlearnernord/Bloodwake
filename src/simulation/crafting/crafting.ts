import { QUALITY_ORDER, QUALITY_SCORE_THRESHOLDS } from '../../config/balancing';
import { ITEMS_BY_ID } from '../../data/items';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS_BY_ID } from '../../data/rooms';
import type { CraftingOrder, InventoryEntry, QualityLevel } from '../../types/models';
import { SeededRng } from '../../utilities/rng';
import { getTraitById } from '../traits/traitUtils';
import { addItem, consumeItems, hasItems, mergeCompatibleStacks } from '../inventory/inventory';

/** Minimal worker interface accepted by crafting functions. */
interface CraftWorker {
  id: string;
  professionId: string;
  traitIds: string[];
  professionSkills: Partial<Record<string, number>>;
}

export const canCraftRecipe = (inventory: InventoryEntry[], recipeId: string): boolean => {
  const recipe = RECIPES_BY_ID[recipeId];
  return hasItems(inventory, recipe.inputs);
};

export const queueCraftingOrder = (craftingQueue: CraftingOrder[], recipeId: string): CraftingOrder[] => {
  if (!RECIPES_BY_ID[recipeId]) {
    throw new Error(`Unknown recipe: ${recipeId}`);
  }
  return [
    ...craftingQueue,
    {
      id: `craft-${recipeId}-${craftingQueue.length + 1}`,
      recipeId,
      progress: 0,
      assignedServantId: null,
      status: 'queued',
    },
  ];
};

const scoreCraftQuality = (servant: CraftWorker, recipeId: string, seed: string): QualityLevel => {
  const recipe = RECIPES_BY_ID[recipeId];
  const profession = PROFESSIONS_BY_ID[servant.professionId];
  const relevantRoom = ROOMS_BY_ID[recipe.requiredRoomId];
  const traitBonus = servant.traitIds.reduce((score, traitId) => {
    const trait = getTraitById(traitId);
    return score + (recipe.traitModifierTags.some((tag) => trait.tags.includes(tag)) ? 1 : 0);
  }, 0);
  const rng = new SeededRng(`${seed}-${servant.id}-${recipeId}`);
  const score =
    (servant.professionSkills.Crafting ?? 0) +
    (profession.jobBonuses.Crafting ?? 0) +
    traitBonus +
    (relevantRoom.modifiers.intelligence ?? 0) +
    rng.nextInt(0, 2);
  let quality: QualityLevel = QUALITY_ORDER[0];
  for (const threshold of QUALITY_SCORE_THRESHOLDS) {
    if (score >= threshold.min) {
      quality = threshold.quality;
    }
  }
  return quality;
};

export const completeCraftingOrder = (
  inventory: InventoryEntry[],
  order: CraftingOrder,
  servant: CraftWorker,
  seed: string,
): { inventory: InventoryEntry[]; order: CraftingOrder } => {
  const recipe = RECIPES_BY_ID[order.recipeId];
  if (!canCraftRecipe(inventory, order.recipeId)) {
    throw new Error('Insufficient items for recipe.');
  }
  const quality = scoreCraftQuality(servant, order.recipeId, seed);
  let updatedInventory = consumeItems(inventory, recipe.inputs);
  for (const output of recipe.outputs) {
    const item = ITEMS_BY_ID[output.itemId];
    if (!item) {
      throw new Error(`Unknown item: ${output.itemId}`);
    }
    updatedInventory = addItem(updatedInventory, output.itemId, output.quantity, quality);
  }
  return {
    inventory: mergeCompatibleStacks(updatedInventory),
    order: { ...order, progress: recipe.workAmount, status: 'complete' },
  };
};

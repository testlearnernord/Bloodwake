import { QUALITY_ORDER, QUALITY_SCORE_THRESHOLDS } from '../../config/balancing';
import { ITEMS_BY_ID } from '../../data/items';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS_BY_ID } from '../../data/rooms';
import type { CraftingOrder, InventoryEntry, QualityLevel, ResourcePool, Servant } from '../../types/models';
import { SeededRng } from '../../utilities/rng';
import { getTraitById } from '../traits/traitUtils';

export const canCraftRecipe = (resources: ResourcePool, recipeId: string): boolean => {
  const recipe = RECIPES_BY_ID[recipeId];
  return Object.entries(recipe.inputs).every(([resourceId, amount]) => (resources[resourceId] ?? 0) >= amount);
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

const scoreCraftQuality = (servant: Servant, recipeId: string, seed: string): QualityLevel => {
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
  resources: ResourcePool,
  inventory: InventoryEntry[],
  order: CraftingOrder,
  servant: Servant,
  seed: string,
): { resources: ResourcePool; inventory: InventoryEntry[]; order: CraftingOrder } => {
  const recipe = RECIPES_BY_ID[order.recipeId];
  if (!canCraftRecipe(resources, order.recipeId)) {
    throw new Error('Insufficient resources for recipe.');
  }
  const updatedResources = { ...resources };
  for (const [resourceId, amount] of Object.entries(recipe.inputs)) {
    updatedResources[resourceId] -= amount;
  }
  const quality = scoreCraftQuality(servant, order.recipeId, seed);
  const updatedInventory = [...inventory];
  for (const output of recipe.outputs) {
    const item = ITEMS_BY_ID[output.itemId];
    if (!item) {
      throw new Error(`Unknown item: ${output.itemId}`);
    }
    updatedInventory.push({ itemId: output.itemId, quantity: output.quantity, quality });
  }
  return {
    resources: updatedResources,
    inventory: updatedInventory,
    order: { ...order, progress: recipe.workAmount, status: 'complete' },
  };
};

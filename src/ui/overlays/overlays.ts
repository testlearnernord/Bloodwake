import { ITEMS_BY_ID } from '../../data/items';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { QUESTS_BY_ID } from '../../data/quests';
import { RECIPES, RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS, ROOMS_BY_ID } from '../../data/rooms';
import { getTraitById } from '../../simulation/traits/traitUtils';
import { canCraftRecipe } from '../../simulation/crafting/crafting';
import { getItemQuantity, hasItems } from '../../simulation/inventory/inventory';
import { calculatePlayerCombatStats } from '../../simulation/combat/stats';
import { selectTaskForServant } from '../../simulation/servants/tasks';
import type { BuiltRoom, InventoryEntry, ItemCategory, ItemId, SaveGame } from '../../types/models';
import { renderIcon } from '../icons/registry';
import type { MenuId } from '../uiState';
import { htmlEscape } from '../../utilities/html';

const INVENTORY_FILTERS: Array<{ id: 'all' | ItemCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'material', label: 'Materials' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'consumable', label: 'Consumables' },
  { id: 'quest', label: 'Quest Items' },
  { id: 'relic', label: 'Relics' },
];

const flattenInventory = (inventory: InventoryEntry[]): Array<InventoryEntry & { label: string }> =>
  inventory
    .map((entry) => ({ ...entry, label: ITEMS_BY_ID[entry.itemId]?.name ?? entry.itemId }))
    .sort((left, right) => left.label.localeCompare(right.label));

const roomGridCell = (rooms: BuiltRoom[], x: number, y: number): string => {
  const room = rooms.find((entry) => entry.x === x && entry.y === y);
  if (!room) {
    return `<button class="grid-cell" data-build-x="${x}" data-build-y="${y}" aria-label="Empty room slot ${x},${y}">+</button>`;
  }
  return `<button class="grid-cell ${room.status}" data-build-x="${x}" data-build-y="${y}" aria-label="${room.roomId} at ${x},${y}">${room.roomId.replaceAll('_', ' ')}</button>`;
};

export const getRoomReadiness = (state: SaveGame, roomId: keyof typeof ROOMS_BY_ID): { ready: boolean; reason: string } => {
  const room = ROOMS_BY_ID[roomId];
  if (room.requiredRoomId && !state.rooms.some((entry) => entry.roomId === room.requiredRoomId && entry.status === 'built')) {
    return { ready: false, reason: `Requires ${ROOMS_BY_ID[room.requiredRoomId].name}.` };
  }
  if (!hasItems(state.inventory, room.constructionCostItems)) {
    const missing = Object.entries(room.constructionCostItems)
      .filter(([itemId, amount]) => getItemQuantity(state.inventory, itemId as ItemId) < (amount ?? 0))
      .map(([itemId, amount]) => `${Math.max(0, (amount ?? 0) - getItemQuantity(state.inventory, itemId as ItemId))} ${ITEMS_BY_ID[itemId as ItemId].name}`)
      .join(', ');
    return { ready: false, reason: `Missing ${missing}.` };
  }
  const missingResource = Object.entries(room.constructionCostResources ?? {}).find(
    ([resourceId, amount]) => (state.strategicResources[resourceId as keyof SaveGame['strategicResources']] ?? 0) < (amount ?? 0),
  );
  if (missingResource) {
    return { ready: false, reason: `Needs more ${missingResource[0]}.` };
  }
  return { ready: true, reason: 'Ready to place on an empty valid slot.' };
};

export const getRecipeReadiness = (state: SaveGame, recipeId: string): { ready: boolean; reason: string } => {
  const recipe = RECIPES_BY_ID[recipeId];
  if (!recipe) {
    return { ready: false, reason: 'Unknown recipe.' };
  }
  if (!state.rooms.some((room) => room.roomId === recipe.requiredRoomId && room.status === 'built')) {
    return { ready: false, reason: `Requires ${ROOMS_BY_ID[recipe.requiredRoomId].name}.` };
  }
  if (!canCraftRecipe(state.inventory, recipeId)) {
    const missing = Object.entries(recipe.inputs)
      .filter(([itemId, amount]) => getItemQuantity(state.inventory, itemId as ItemId) < (amount ?? 0))
      .map(([itemId, amount]) => `${Math.max(0, (amount ?? 0) - getItemQuantity(state.inventory, itemId as ItemId))} ${ITEMS_BY_ID[itemId as ItemId].name}`)
      .join(', ');
    return { ready: false, reason: `Missing ${missing}.` };
  }
  const hasCrafter = state.servants.some((servant) => servant.priorities.Crafting !== 'Disabled');
  if (!hasCrafter) {
    return { ready: false, reason: 'Need a servant with Crafting enabled.' };
  }
  return { ready: true, reason: 'Ready to queue.' };
};

const renderOverlayPanel = (title: string, bodyHtml: string): string => `
  <div class="overlay-panel">
    <header class="overlay-header">
      <h2 id="overlay-title">${htmlEscape(title)}</h2>
      <button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button>
    </header>
    <div class="overlay-body">${bodyHtml}</div>
  </div>
`;

export const renderOverlay = (
  menu: MenuId,
  state: SaveGame,
  selectedItemId: ItemId | null,
  selectedFilter: 'all' | ItemCategory,
  selectedRoomId: keyof typeof ROOMS_BY_ID,
): string => {
  if (menu === 'character') {
    const traits = state.player.traitIds.map((traitId) => getTraitById(traitId));
    const combatStats = calculatePlayerCombatStats(state.player);
    return renderOverlayPanel(
      'Character & Bloodline',
      `<div class="columns two">
        <section>
          <h3>${htmlEscape(state.player.name)}</h3>
          <p>Profession: ${htmlEscape(state.player.professionId)}</p>
          <p>Vitae Capacity: ${state.player.maxVitae} · Hunger: ${state.player.hunger}</p>
          <p>Attack ${combatStats.attackDamage} · Armor ${combatStats.armor} · Healing ${combatStats.healingPower}</p>
          <h4>Attributes</h4>
          <ul>${Object.entries(combatStats.finalAttributes)
            .map(([key, value]) => {
              const base = combatStats.baseAttributes[key as keyof typeof combatStats.baseAttributes];
              const bonus = combatStats.equipmentBonuses[key as keyof typeof combatStats.equipmentBonuses] ?? 0;
              return `<li>${htmlEscape(key)}: ${value}${bonus ? ` (${base} base + ${bonus} gear)` : ` (${base} base)`}</li>`;
            })
            .join('')}</ul>
        </section>
        <section>
          <h4>Traits</h4>
          <ul>${traits.map((trait) => `<li>${htmlEscape(trait.name)} (${htmlEscape(trait.rarity)}) — ${htmlEscape(trait.description)}</li>`).join('')}</ul>
          <h4>Inheritance History</h4>
          <ul>${state.inheritanceHistory
            .slice(0, 6)
            .map(
              (entry) =>
                `<li><strong>Final:</strong> ${entry.finalTraits.map(htmlEscape).join(', ') || 'none'}<br /><small>Inherited: ${entry.inheritedTraits.map(htmlEscape).join(', ') || 'none'} · Retained: ${entry.retainedTraits.map(htmlEscape).join(', ') || 'none'} · Mutations: ${entry.mutations.map(htmlEscape).join(', ') || 'none'}</small></li>`,
            )
            .join('') || '<li>No inheritance events yet.</li>'}</ul>
        </section>
      </div>`,
    );
  }

  if (menu === 'inventory') {
    const entries = flattenInventory(state.inventory).filter((entry) => selectedFilter === 'all' || ITEMS_BY_ID[entry.itemId].category === selectedFilter);
    const selectedEntry = entries.find((entry) => entry.itemId === selectedItemId) ?? entries[0];
    const selectedItem = selectedEntry ? ITEMS_BY_ID[selectedEntry.itemId] : null;
    return renderOverlayPanel(
      'Inventory & Equipment',
      `<div class="columns three">
        <section>
          <h3>Filters</h3>
          <div class="button-list">${INVENTORY_FILTERS.map((filter) => `<button class="${selectedFilter === filter.id ? 'selected' : ''}" data-item-filter="${filter.id}">${htmlEscape(filter.label)}</button>`).join('')}</div>
        </section>
        <section>
          <h3>Items</h3>
          <div class="item-grid">${entries
            .map(
              (entry) => `<button class="item-card ${selectedEntry?.itemId === entry.itemId ? 'selected' : ''}" data-item-id="${htmlEscape(entry.itemId)}">${renderIcon(ITEMS_BY_ID[entry.itemId].iconId)}<span>${htmlEscape(entry.label)}</span><span>× ${entry.quantity}</span><span>${htmlEscape(entry.quality ?? 'Common')} · ${htmlEscape(ITEMS_BY_ID[entry.itemId].rarity)}</span></button>`,
            )
            .join('') || '<p>No items in this category.</p>'}</div>
        </section>
        <section>
          <h3>Details</h3>
          ${
            selectedItem && selectedEntry
              ? `<article>
              <h4>${htmlEscape(selectedItem.name)}</h4>
              <div>${renderIcon(selectedItem.iconId, 'large')}</div>
              <p>${htmlEscape(selectedItem.description)}</p>
              <p>Category: ${htmlEscape(selectedItem.category)} · Rarity: ${htmlEscape(selectedItem.rarity)}</p>
              <p>Quantity: ${selectedEntry.quantity} · Quality: ${htmlEscape(selectedEntry.quality ?? 'Common')}</p>
              <p>Modifiers: ${Object.entries(selectedItem.modifiers)
                .map(([key, value]) => `${htmlEscape(key)} ${htmlEscape(String(value))}`)
                .join(', ') || 'None'}</p>
              <div class="button-row compact">
                <button data-equip-item="${htmlEscape(selectedItem.id)}" ${selectedItem.equipSlot ? '' : 'disabled'}>${selectedItem.equipSlot ? `Equip (${htmlEscape(selectedItem.equipSlot)})` : 'Not Equippable'}</button>
                <button data-use-item="${htmlEscape(selectedItem.id)}" ${selectedItem.consumableEffectId === 'heal_player' ? '' : 'disabled'}>${selectedItem.consumableEffectId === 'heal_player' ? 'Use' : 'Not Usable'}</button>
              </div>
            </article>`
              : '<p>Select an item to inspect details.</p>'
          }
          <h4>Equipment</h4>
          <ul>
            <li>Weapon: ${state.player.equipment.Weapon ? htmlEscape(ITEMS_BY_ID[state.player.equipment.Weapon].name) : 'None'} ${state.player.equipment.Weapon ? `<button data-unequip-slot="Weapon">Unequip</button>` : ''}</li>
            <li>Armor: ${state.player.equipment.Armor ? htmlEscape(ITEMS_BY_ID[state.player.equipment.Armor].name) : 'None'} ${state.player.equipment.Armor ? `<button data-unequip-slot="Armor">Unequip</button>` : ''}</li>
            <li>Accessory: ${state.player.equipment.Accessory ? htmlEscape(ITEMS_BY_ID[state.player.equipment.Accessory].name) : 'None'} ${state.player.equipment.Accessory ? `<button data-unequip-slot="Accessory">Unequip</button>` : ''}</li>
          </ul>
        </section>
      </div>`,
    );
  }

  if (menu === 'servants') {
    return renderOverlayPanel(
      'Servants',
      `<div class="columns three">
        <section>
          <h3>Roster</h3>
          ${
            state.servants.length === 0
              ? '<p>No servants have been recruited yet. Turn a human in the world to create your first vampire servant.</p>'
              : state.servants.map((servant) => `<button class="servant-card" data-servant-row="${servant.id}">${htmlEscape(servant.name)} · ${htmlEscape(servant.type)}</button>`).join('')
          }
        </section>
        <section>
          <h3>Overview</h3>
          ${
            state.servants.length === 0
              ? '<p>Once recruited, servants can gather, build, and craft for your stronghold.</p>'
              : state.servants
                  .map((servant) => {
                    const profession = PROFESSIONS_BY_ID[servant.professionId];
                    const predictedTask = selectTaskForServant(servant, state.rooms, state.craftingQueue, state.inventory, state.time.phase);
                    return `<article><h4>${htmlEscape(servant.name)}</h4><p>${htmlEscape(profession.name)} · ${htmlEscape(profession.practicalBenefit)}</p><p>Health ${servant.health}/${servant.maxHealth} · Morale ${servant.morale} · Loyalty ${servant.loyalty}</p><p>Ambition ${servant.ambition} · Stress ${servant.stress}</p><p>Current task: ${htmlEscape(servant.currentTask ?? 'none')} — ${htmlEscape(servant.taskReason)}</p><p>Next likely task: ${htmlEscape(predictedTask?.jobType ?? 'Idle')} — ${htmlEscape(predictedTask?.reason ?? 'No enabled work is available.')}</p></article>`;
                  })
                  .join('')
          }
        </section>
        <section>
          <h3>Priorities</h3>
          ${
            state.servants.length === 0
              ? '<p>Priority controls unlock once a servant exists.</p>'
              : state.servants
                  .map(
                    (servant) => `<article><h4>${htmlEscape(servant.name)}</h4>${(['Building', 'Crafting', 'Gathering', 'Guarding', 'Research', 'Hunting'] as const)
                      .map(
                        (jobType) => `<label>${htmlEscape(jobType)}<select data-servant-id="${htmlEscape(servant.id)}" data-job-type="${jobType}">${['Disabled', 'Low', 'Normal', 'High', 'Critical']
                          .map((priority) => `<option value="${priority}" ${servant.priorities[jobType] === priority ? 'selected' : ''}>${priority}</option>`)
                          .join('')}</select></label>`,
                      )
                      .join('')}</article>`,
                  )
                  .join('')
          }
        </section>
      </div>`,
    );
  }

  if (menu === 'stronghold') {
    return renderOverlayPanel(
      'Stronghold',
      `<div class="columns two">
        <section>
          <h3>Room Catalog</h3>
          <div class="button-list">
            ${ROOMS.filter((room) => room.id !== 'coffin_chamber')
              .map((room) => {
                const readiness = getRoomReadiness(state, room.id);
                return `<button class="${selectedRoomId === room.id ? 'selected' : ''}" data-room-select="${room.id}">${renderIcon(room.iconId)} ${htmlEscape(room.name)}<small>${Object.entries(room.constructionCostItems)
                  .map(([itemId, qty]) => `${qty} ${htmlEscape(ITEMS_BY_ID[itemId as ItemId].name)}`)
                  .join(', ') || 'No item cost'}</small><small>${htmlEscape(readiness.reason)}</small></button>`;
              })
              .join('')}
          </div>
        </section>
        <section>
          <h3>Build Grid</h3>
          <p>Selected room: ${htmlEscape(ROOMS_BY_ID[selectedRoomId].name)}. Empty cells build only when placement and costs are valid.</p>
          <div class="build-grid">${Array.from({ length: 16 }, (_, index) => roomGridCell(state.rooms, index % 4, Math.floor(index / 4))).join('')}</div>
          <h4>Current Rooms</h4>
          <ul>${state.rooms.map((room) => `<li>${htmlEscape(room.roomId)} at ${room.x},${room.y} · ${htmlEscape(room.status)} · progress ${room.progress}</li>`).join('')}</ul>
        </section>
      </div>`,
    );
  }

  if (menu === 'crafting') {
    return renderOverlayPanel(
      'Crafting',
      `<div class="columns three">
        <section><h3>Categories</h3><div class="button-list"><button disabled>Materials</button><button disabled>Equipment</button><button disabled>Alchemy</button></div></section>
        <section>
          <h3>Recipes</h3>
          <div class="button-list">${RECIPES.map((recipe) => {
            const readiness = getRecipeReadiness(state, recipe.id);
            return `<button data-recipe-id="${recipe.id}" ${readiness.ready ? '' : 'disabled'}>${htmlEscape(recipe.name)}<small>${htmlEscape(readiness.reason)}</small></button>`;
          }).join('')}</div>
        </section>
        <section>
          <h3>Queue</h3>
          <ul>${state.craftingQueue.map((order) => `<li>${htmlEscape(RECIPES_BY_ID[order.recipeId].name)} · ${htmlEscape(order.status)}</li>`).join('') || '<li>No crafting orders.</li>'}</ul>
          <p>Crafting requires matching rooms, resources, and capable servants.</p>
        </section>
      </div>`,
    );
  }

  if (menu === 'journal') {
    const quest = QUESTS_BY_ID.awakening;
    const questState = state.quests[0];
    return renderOverlayPanel(
      'Journal & Memory Codex',
      `<div class="columns two">
        <section>
          <h3>Active Quest</h3>
          <ol>${quest.steps
            .map((step) => {
              const done = questState.completedStepIds.includes(step.id);
              const active = questState.activeStepId === step.id;
              return `<li class="${done ? 'complete' : active ? 'active' : ''}">${htmlEscape(step.text)}</li>`;
            })
            .join('')}</ol>
          <h3>Completed Steps</h3>
          <ul>${questState.completedStepIds.map((stepId) => `<li>${htmlEscape(stepId)}</li>`).join('') || '<li>None yet.</li>'}</ul>
        </section>
        <section>
          <h3>Memories</h3>
          <ul>${state.collectibles.filter((entry) => entry.discovered).map((entry) => `<li>${htmlEscape(entry.collectibleId)}</li>`).join('') || '<li>No memories recovered yet.</li>'}</ul>
          <h3>Recent Events</h3>
          <ul>${state.lastEventLog.slice(0, 10).map((line) => `<li>${htmlEscape(line)}</li>`).join('')}</ul>
        </section>
      </div>`,
    );
  }

  return renderOverlayPanel(
    'Pause & Settings',
    `<p>Use save/export controls from the top bar or resume to continue.</p>
    <h3>Combat controls</h3>
    <ul>
      <li>WASD move, mouse aim, Ctrl lock-on toggle, Tab next target, Shift+Tab previous target</li>
      <li>Mouse wheel also cycles targets, middle mouse locks the enemy nearest the cursor</li>
      <li>Left Mouse light attack, Right Mouse heavy attack, Q Blood Lance, Space dodge</li>
      <li>E interact, F bite/feed, Escape close overlay or pause</li>
    </ul>
    <label>UI Scale
      <select data-setting-ui-scale>
        ${[0.9, 1, 1.1, 1.25]
          .map((scale) => `<option value="${scale}" ${state.settings.uiScale === scale ? 'selected' : ''}>${Math.round(scale * 100)}%</option>`)
          .join('')}
      </select>
    </label>
    <div class="button-row"><button id="manual-save-overlay">Manual Save</button><button id="return-title">Return to Title</button></div>`,
  );
};

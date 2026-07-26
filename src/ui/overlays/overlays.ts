import { ITEMS_BY_ID } from '../../data/items';
import { QUESTS_BY_ID } from '../../data/quests';
import { RECIPES, RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS } from '../../data/rooms';
import { getTraitById } from '../../simulation/traits/traitUtils';
import type { BuiltRoom, InventoryEntry, ItemCategory, ItemId, SaveGame } from '../../types/models';
import { renderIcon } from '../icons/registry';
import type { MenuId } from '../uiState';

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

export const renderOverlay = (
  menu: MenuId,
  state: SaveGame,
  selectedItemId: ItemId | null,
  selectedFilter: 'all' | ItemCategory,
): string => {
  if (menu === 'character') {
    const traits = state.player.traitIds.map((traitId) => getTraitById(traitId));
    return `
      <header class="overlay-header"><h2 id="overlay-title">Character & Bloodline</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns two">
        <section>
          <h3>${state.player.name}</h3>
          <p>Profession: ${state.player.professionId}</p>
          <p>Vitae Capacity: ${state.player.maxVitae} · Hunger: ${state.player.hunger}</p>
          <h4>Attributes</h4>
          <ul>${Object.entries(state.player.attributes).map(([key, value]) => `<li>${key}: base ${value}, item bonus pending, final ${value}</li>`).join('')}</ul>
        </section>
        <section>
          <h4>Traits</h4>
          <ul>${traits.map((trait) => `<li>${trait.name} (${trait.rarity}) — ${trait.description}</li>`).join('')}</ul>
          <h4>Inheritance History</h4>
          <ul>${state.inheritanceHistory.slice(0, 6).map((entry) => `<li>Final traits: ${entry.finalTraits.join(', ') || 'none'}</li>`).join('') || '<li>No inheritance events yet.</li>'}</ul>
        </section>
      </div>
    `;
  }

  if (menu === 'inventory') {
    const entries = flattenInventory(state.inventory).filter((entry) => selectedFilter === 'all' || ITEMS_BY_ID[entry.itemId].category === selectedFilter);
    const selectedEntry = entries.find((entry) => entry.itemId === selectedItemId) ?? entries[0];
    const selectedItem = selectedEntry ? ITEMS_BY_ID[selectedEntry.itemId] : null;
    return `
      <header class="overlay-header"><h2 id="overlay-title">Inventory & Equipment</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns three">
        <section>
          <h3>Filters</h3>
          <div class="button-list">${INVENTORY_FILTERS.map((filter) => `<button class="${selectedFilter === filter.id ? 'selected' : ''}" data-item-filter="${filter.id}">${filter.label}</button>`).join('')}</div>
        </section>
        <section>
          <h3>Items</h3>
          <div class="item-grid">${entries
            .map(
              (entry) => `<button class="item-card ${selectedEntry?.itemId === entry.itemId ? 'selected' : ''}" data-item-id="${entry.itemId}">${renderIcon(ITEMS_BY_ID[entry.itemId].iconId)}<span>${entry.label}</span><span>× ${entry.quantity}</span><span>${entry.quality ?? 'Common'} · ${ITEMS_BY_ID[entry.itemId].rarity}</span></button>`,
            )
            .join('') || '<p>No items in this category.</p>'}</div>
        </section>
        <section>
          <h3>Details</h3>
          ${
            selectedItem && selectedEntry
              ? `<article>
              <h4>${selectedItem.name}</h4>
              <div>${renderIcon(selectedItem.iconId, 'large')}</div>
              <p>${selectedItem.description}</p>
              <p>Category: ${selectedItem.category} · Rarity: ${selectedItem.rarity}</p>
              <p>Quantity: ${selectedEntry.quantity} · Quality: ${selectedEntry.quality ?? 'Common'}</p>
              <p>Modifiers: ${Object.entries(selectedItem.modifiers)
                .map(([key, value]) => `${key} ${value}`)
                .join(', ') || 'None'}</p>
              <div class="button-row compact">
                <button data-equip-item="${selectedItem.id}" ${selectedItem.equipSlot ? '' : 'disabled'}>${selectedItem.equipSlot ? `Equip (${selectedItem.equipSlot})` : 'Not Equippable'}</button>
                <button data-use-item="${selectedItem.id}" ${selectedItem.consumableEffectId === 'heal_player' ? '' : 'disabled'}>${selectedItem.consumableEffectId === 'heal_player' ? 'Use' : 'Not Usable'}</button>
              </div>
            </article>`
              : '<p>Select an item to inspect details.</p>'
          }
          <h4>Equipment</h4>
          <ul>
            <li>Weapon: ${state.player.equipment.Weapon ? ITEMS_BY_ID[state.player.equipment.Weapon].name : 'None'} ${state.player.equipment.Weapon ? `<button data-unequip-slot="Weapon">Unequip</button>` : ''}</li>
            <li>Armor: ${state.player.equipment.Armor ? ITEMS_BY_ID[state.player.equipment.Armor].name : 'None'} ${state.player.equipment.Armor ? `<button data-unequip-slot="Armor">Unequip</button>` : ''}</li>
            <li>Accessory: ${state.player.equipment.Accessory ? ITEMS_BY_ID[state.player.equipment.Accessory].name : 'None'} ${state.player.equipment.Accessory ? `<button data-unequip-slot="Accessory">Unequip</button>` : ''}</li>
          </ul>
        </section>
      </div>
    `;
  }

  if (menu === 'servants') {
    return `
      <header class="overlay-header"><h2 id="overlay-title">Servants</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns three">
        <section>
          <h3>Roster</h3>
          ${
            state.servants.length === 0
              ? '<p>No servants have been recruited yet. Turn a human in the world to create your first vampire servant.</p>'
              : state.servants.map((servant) => `<button class="servant-card" data-servant-row="${servant.id}">${servant.name} · ${servant.type}</button>`).join('')
          }
        </section>
        <section>
          <h3>Overview</h3>
          ${
            state.servants.length === 0
              ? '<p>Once recruited, servants can gather, build, and craft for your stronghold.</p>'
              : state.servants
                  .map(
                    (servant) => `<article><h4>${servant.name}</h4><p>${servant.professionId}</p><p>Health ${servant.health}/${servant.maxHealth} · Morale ${servant.morale} · Loyalty ${servant.loyalty}</p><p>Ambition ${servant.ambition} · Stress ${servant.stress}</p><p>Task: ${servant.currentTask ?? 'none'} — ${servant.taskReason}</p></article>`,
                  )
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
                    (servant) => `<article><h4>${servant.name}</h4>${(['Building', 'Crafting', 'Gathering', 'Guarding', 'Research', 'Hunting'] as const)
                      .map(
                        (jobType) => `<label>${jobType}<select data-servant-id="${servant.id}" data-job-type="${jobType}">${['Disabled', 'Low', 'Normal', 'High', 'Critical']
                          .map((priority) => `<option value="${priority}" ${servant.priorities[jobType] === priority ? 'selected' : ''}>${priority}</option>`)
                          .join('')}</select></label>`,
                      )
                      .join('')}</article>`,
                  )
                  .join('')
          }
        </section>
      </div>
    `;
  }

  if (menu === 'stronghold') {
    return `
      <header class="overlay-header"><h2 id="overlay-title">Stronghold</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns two">
        <section>
          <h3>Room Catalog</h3>
          <div class="button-list">
            ${ROOMS.filter((room) => room.id !== 'coffin_chamber')
              .map(
                (room) => `<button data-room-select="${room.id}">${renderIcon(room.iconId)} ${room.name}<small>${Object.entries(room.constructionCostItems)
                  .map(([itemId, qty]) => `${qty} ${ITEMS_BY_ID[itemId as ItemId].name}`)
                  .join(', ') || 'No item cost'}</small></button>`,
              )
              .join('')}
          </div>
        </section>
        <section>
          <h3>Build Grid</h3>
          <div class="build-grid">${Array.from({ length: 16 }, (_, index) => roomGridCell(state.rooms, index % 4, Math.floor(index / 4))).join('')}</div>
          <h4>Current Rooms</h4>
          <ul>${state.rooms.map((room) => `<li>${room.roomId} at ${room.x},${room.y} · ${room.status} · progress ${room.progress}</li>`).join('')}</ul>
        </section>
      </div>
    `;
  }

  if (menu === 'crafting') {
    return `
      <header class="overlay-header"><h2 id="overlay-title">Crafting</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns three">
        <section><h3>Categories</h3><div class="button-list"><button disabled>Materials</button><button disabled>Equipment</button><button disabled>Alchemy</button></div></section>
        <section>
          <h3>Recipes</h3>
          <div class="button-list">${RECIPES.map((recipe) => `<button data-recipe-id="${recipe.id}">${recipe.name}</button>`).join('')}</div>
        </section>
        <section>
          <h3>Queue</h3>
          <ul>${state.craftingQueue.map((order) => `<li>${RECIPES_BY_ID[order.recipeId].name} · ${order.status}</li>`).join('') || '<li>No crafting orders.</li>'}</ul>
          <p>Crafting requires matching rooms, resources, and capable servants.</p>
        </section>
      </div>
    `;
  }

  if (menu === 'journal') {
    const quest = QUESTS_BY_ID.awakening;
    const questState = state.quests[0];
    return `
      <header class="overlay-header"><h2 id="overlay-title">Journal & Memory Codex</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
      <div class="overlay-body columns two">
        <section>
          <h3>Active Quest</h3>
          <ol>${quest.steps
            .map((step) => {
              const done = questState.completedStepIds.includes(step.id);
              const active = questState.activeStepId === step.id;
              return `<li class="${done ? 'complete' : active ? 'active' : ''}">${step.text}</li>`;
            })
            .join('')}</ol>
          <h3>Completed Steps</h3>
          <ul>${questState.completedStepIds.map((stepId) => `<li>${stepId}</li>`).join('') || '<li>None yet.</li>'}</ul>
        </section>
        <section>
          <h3>Memories</h3>
          <ul>${state.collectibles.filter((entry) => entry.discovered).map((entry) => `<li>${entry.collectibleId}</li>`).join('') || '<li>No memories recovered yet.</li>'}</ul>
          <h3>Recent Events</h3>
          <ul>${state.lastEventLog.slice(0, 10).map((line) => `<li>${line}</li>`).join('')}</ul>
        </section>
      </div>
    `;
  }

  return `
    <header class="overlay-header"><h2 id="overlay-title">Pause & Settings</h2><button data-close-overlay aria-label="Close overlay">${renderIcon('close')}</button></header>
    <div class="overlay-body">
      <p>Use save/export controls from the top bar or resume to continue.</p>
      <div class="button-row"><button id="manual-save-overlay">Manual Save</button><button id="return-title">Return to Title</button></div>
    </div>
  `;
};

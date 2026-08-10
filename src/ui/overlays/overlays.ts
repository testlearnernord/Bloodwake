import { ITEMS_BY_ID } from '../../data/items';
import { PROFESSIONS_BY_ID } from '../../data/professions';
import { QUESTS_BY_ID } from '../../data/quests';
import { RECIPES, RECIPES_BY_ID } from '../../data/recipes';
import { ROOMS, ROOMS_BY_ID } from '../../data/rooms';
import { getTraitById } from '../../simulation/traits/traitUtils';
import { canCraftRecipe } from '../../simulation/crafting/crafting';
import { getItemQuantity, hasItems } from '../../simulation/inventory/inventory';
import { calculatePlayerCombatStats } from '../../simulation/combat/stats';
import { getVitaeCondition } from '../../simulation/blood/vitaeCondition';
import { selectTaskForVassal } from '../../simulation/servants/tasks';
import { getDominionSummary } from '../../simulation/servants/dominion';
import { getHumanHousingCapacity, getThrallControlState, validateReassertThrallControl } from '../../simulation/servants/humanThralls';
import { HUMAN_THRALL_WOUNDED_HEALTH_THRESHOLD, HUMAN_WORK_JOB_TYPES, selectTaskForHumanThrall } from '../../simulation/servants/humanWork';
import { validateElevateThrall } from '../../simulation/servants/thrallElevation';
import { validateBindThrallAsBloodDonor } from '../../simulation/servants/bloodDonors';
import { getBloodDonorCapacity, getBloodStockCapacity } from '../../simulation/blood/bloodStock';
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
  const hasCrafter = [...state.humanServants, ...state.vampireVassals].some(
    (worker) =>
      worker.priorities.Crafting !== 'Disabled'
      && (!recipe.requiredProfessionId || worker.professionId === recipe.requiredProfessionId),
  );
  if (!hasCrafter) {
    return {
      ready: false,
      reason: recipe.requiredProfessionId
        ? `Need a ${PROFESSIONS_BY_ID[recipe.requiredProfessionId].name} with Crafting enabled.`
        : 'Need a human thrall or vampire vassal with Crafting enabled.',
    };
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
          <p>Vitae: ${state.player.vitae}/${state.player.maxVitae} · ${htmlEscape(getVitaeCondition(state.player.vitae, state.player.maxVitae))}</p>
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
    const humanServants = state.humanServants;
    const vassals = state.vampireVassals;
    const housingCapacity = getHumanHousingCapacity(state.rooms);
    const bloodStockCapacity = getBloodStockCapacity(state.rooms);
    const bloodDonorCapacity = getBloodDonorCapacity(state.rooms);
    const dominion = getDominionSummary(state);
    return renderOverlayPanel(
      'Domain Population',
      `<div class="columns three">
        <section>
          <h3>Human Thralls</h3>
          <p>Housing: ${humanServants.length}/${housingCapacity} · Base ruins provide 2 spaces; each Servant Quarters adds 4.</p>
          ${
            humanServants.length === 0
              ? '<p class="hint">No human thralls. Subdue a free human at night and choose Enthrall.</p>'
              : humanServants
                  .map((servant) => {
                    const profession = PROFESSIONS_BY_ID[servant.professionId];
                    const reassert = validateReassertThrallControl(state, servant);
                    const elevation = validateElevateThrall(state, servant);
                    const donorBinding = validateBindThrallAsBloodDonor(state, servant);
                    const predictedTask = selectTaskForHumanThrall(servant, state.rooms, state.craftingQueue, state.inventory);
                    const predictedTaskReason =
                      predictedTask?.reason
                      ?? (servant.health <= HUMAN_THRALL_WOUNDED_HEALTH_THRESHOLD ? 'Too wounded for daytime labor.' : 'No enabled daytime work is available.');
                    return `<article class="servant-card"><h4>${htmlEscape(servant.name)} ${htmlEscape(servant.familyName)}</h4><p>${htmlEscape(profession.name)} · Blood Resonance ${servant.bloodResonance}</p><p>Control ${servant.control}/100 · ${htmlEscape(getThrallControlState(servant.control))}</p><p>Resistance ${servant.resistance}/5 · Stress ${servant.stress}/100 · Fear ${servant.fear}/100</p><p>Last work: ${htmlEscape(servant.currentJob ?? 'Idle')} · ${htmlEscape(servant.currentTask ?? 'none')}</p><p>Next day: ${htmlEscape(predictedTask?.jobType ?? 'Idle')} — ${htmlEscape(predictedTaskReason)}</p><h5>Mortal Work Priorities</h5><div class="priority-grid">${HUMAN_WORK_JOB_TYPES.map((jobType) => `<label>${htmlEscape(jobType)}<select data-human-servant-id="${htmlEscape(servant.id)}" data-job-type="${jobType}">${['Disabled', 'Low', 'Normal', 'High', 'Critical'].map((priority) => `<option value="${priority}" ${servant.priorities[jobType] === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></label>`).join('')}</div><p class="hint">These are mortal daytime jobs. Vampire Vassal orders remain a separate control model.</p><p class="hint">${htmlEscape(servant.taskReason)}</p><div class="button-row compact"><button data-reassert-thrall="${htmlEscape(servant.id)}" ${reassert.ok ? '' : 'disabled'} title="${htmlEscape(reassert.ok ? 'Spend Vitae to reinforce the thrall bond.' : reassert.reason)}">Reassert Control</button><button data-elevate-thrall="${htmlEscape(servant.id)}" ${elevation.ok ? '' : 'disabled'} title="${htmlEscape(elevation.ok ? 'Turn this mortal thrall into a Vampire Vassal.' : elevation.reason)}">Elevate to Vassal</button><button data-bind-blood-donor="${htmlEscape(servant.id)}" ${donorBinding.ok ? '' : 'disabled'} title="${htmlEscape(donorBinding.ok ? 'Permanently remove this Thrall from ordinary work and bind them to a Blood Cellar until death.' : donorBinding.reason)}">Bind as Blood Donor</button></div><p class="hint">${htmlEscape(elevation.ok ? 'Elevation preserves learned profession skills but replaces Control/Resistance with Vampire Vassal politics.' : elevation.reason)}</p></article>`;
                  })
                  .join('')
          }
        </section>
        <section>
          <h3>Blood Cellar</h3>
          <p>Blood Stock: ${state.bloodStock.amount}/${bloodStockCapacity}</p>
          <p>Permanent Donors: ${state.bloodDonors.length}/${bloodDonorCapacity}</p>
          <p class="hint">Blood Stock has no automatic producer yet. Donor extraction becomes a real timed facility task in the continuous simulation.</p>
          ${state.bloodDonors.length === 0
            ? '<p>No bound donors.</p>'
            : state.bloodDonors.map((donor) => {
                const cellar = state.rooms.find((room) => room.id === donor.boundRoomInstanceId);
                return `<article class="servant-card"><h4>${htmlEscape(donor.name)} ${htmlEscape(donor.familyName)}</h4><p>${htmlEscape(PROFESSIONS_BY_ID[donor.professionId].name)} · Blood Resonance ${donor.bloodResonance}</p><p>Health ${donor.health}/${donor.maxHealth} · Stress ${donor.stress}/100</p><p>Bound Day ${donor.boundAtDay} · ${htmlEscape(cellar ? ROOMS_BY_ID[cellar.roomId].name : donor.boundRoomInstanceId)}</p><p class="hint">Permanently removed from normal labor. There is no release action.</p></article>`;
              }).join('')}
        </section>
        <section>
          <h3>Vampire Vassals</h3>
          <p>Dominion: ${dominion.activeCost}/${dominion.capacity}${dominion.strain > 0 ? ` · Strain ${dominion.strain}` : ''} · Active ${dominion.activeVassals} · Torpor ${dominion.torpidVassals}</p>
          <p class="hint">Active Vassals cost 1 Dominion each. Torpid Vassals cost 0 and cannot work or receive orders.</p>
          ${
            vassals.length === 0
              ? '<p>No vampire vassals yet. Turning creates a powerful but autonomous subordinate, not a thrall.</p>'
              : vassals
                  .map((vassal) => {
                    const profession = PROFESSIONS_BY_ID[vassal.professionId];
                    const predictedTask = selectTaskForVassal(vassal, state.rooms, state.craftingQueue, state.inventory, state.time.phase);
                    return `<article><h4>${htmlEscape(vassal.name)}</h4><p>${htmlEscape(profession.name)} · ${htmlEscape(profession.practicalBenefit)}</p><p>State: <strong>${htmlEscape(vassal.state === 'torpor' ? 'Torpor' : 'Active')}</strong> · Dominion ${vassal.state === 'active' ? 1 : 0}</p><p>Health ${vassal.health}/${vassal.maxHealth} · Morale ${vassal.morale} · Loyalty ${vassal.loyalty}</p><p>Ambition ${vassal.ambition} · Stress ${vassal.stress}</p><p>Current task: ${htmlEscape(vassal.currentTask ?? 'none')} — ${htmlEscape(vassal.taskReason)}</p><p>Next likely task: ${htmlEscape(predictedTask?.jobType ?? 'Idle')} — ${htmlEscape(predictedTask?.reason ?? 'No enabled work is available.')}</p><div class="button-row compact"><button data-vassal-torpor="${htmlEscape(vassal.id)}" data-vassal-torpor-action="${vassal.state === 'torpor' ? 'wake' : 'sleep'}">${vassal.state === 'torpor' ? 'Awaken' : 'Enter Torpor'}</button></div></article>`;
                  })
                  .join('')
          }
        </section>
        <section>
          <h3>Vampire Vassal Priorities</h3>
          ${
            vassals.length === 0
              ? '<p>Human Thralls and Vampire Vassals use different control models. Human work assignments arrive on top of the Thrall foundation rather than reusing vassal loyalty.</p>'
              : vassals
                  .map(
                    (vassal) => `<article><h4>${htmlEscape(vassal.name)}</h4>${(['Building', 'Crafting', 'Gathering', 'Guarding', 'Research', 'Hunting'] as const)
                      .map(
                        (jobType) => `<label>${htmlEscape(jobType)}<select data-servant-id="${htmlEscape(vassal.id)}" data-job-type="${jobType}" ${vassal.state === 'torpor' ? 'disabled' : ''}>${['Disabled', 'Low', 'Normal', 'High', 'Critical']
                          .map((priority) => `<option value="${priority}" ${vassal.priorities[jobType] === priority ? 'selected' : ''}>${priority}</option>`)
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
          <ul>${state.craftingQueue.map((order) => `<li>${htmlEscape(RECIPES_BY_ID[order.recipeId].name)} · ${htmlEscape(order.status)} · ${order.progress}/${RECIPES_BY_ID[order.recipeId].workAmount} work</li>`).join('') || '<li>No crafting orders.</li>'}</ul>
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

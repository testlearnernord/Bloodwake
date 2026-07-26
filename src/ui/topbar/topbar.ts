import type { InventoryEntry, ItemId, SaveGame } from '../../types/models';
import { renderIcon } from '../icons/registry';
import type { MenuId } from '../uiState';
import { htmlEscape } from '../../utilities/html';

interface TopBarResourceDefinition {
  id: string;
  iconId: string;
  label: string;
  readAmount: (state: SaveGame) => number;
}

const getItemCount = (inventory: InventoryEntry[], itemId: ItemId): number =>
  inventory.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);

export const TOPBAR_RESOURCES: TopBarResourceDefinition[] = [
  { id: 'bloodEssence', iconId: 'bloodEssence', label: 'Blood Essence', readAmount: (state) => state.strategicResources.bloodEssence },
  { id: 'wood', iconId: 'wood', label: 'Wood', readAmount: (state) => getItemCount(state.inventory, 'wood') },
  { id: 'stone', iconId: 'stone', label: 'Stone', readAmount: (state) => getItemCount(state.inventory, 'stone') },
  { id: 'iron_ore', iconId: 'iron_ore', label: 'Iron Ore', readAmount: (state) => getItemCount(state.inventory, 'iron_ore') },
  { id: 'food', iconId: 'food', label: 'Food', readAmount: (state) => getItemCount(state.inventory, 'food') },
];

const menuButtons: Array<{ id: MenuId; iconId: string; label: string; shortcut: string }> = [
  { id: 'character', iconId: 'character', label: 'Character & Bloodline', shortcut: 'C' },
  { id: 'inventory', iconId: 'inventory', label: 'Inventory & Equipment', shortcut: 'I' },
  { id: 'servants', iconId: 'servants', label: 'Servants', shortcut: 'V' },
  { id: 'stronghold', iconId: 'stronghold', label: 'Stronghold', shortcut: 'B' },
  { id: 'crafting', iconId: 'crafting', label: 'Crafting', shortcut: 'K' },
  { id: 'journal', iconId: 'journal', label: 'Journal & Memories', shortcut: 'J' },
  { id: 'pause', iconId: 'pause', label: 'Pause & Settings', shortcut: 'Esc' },
];

export const renderTopBar = (
  state: SaveGame,
  activeZone: string,
  objective: string,
  activeMenu: MenuId | null,
  pauseVisible: boolean,
  resourceDelta: Record<string, number>,
): string => {
  const worldInfo = htmlEscape(`Day ${state.time.day} · ${state.time.phase.toUpperCase()} · ${activeZone}`);
  const pauseText = pauseVisible ? 'Paused' : 'Live';

  return `
    <div class="topbar-group topbar-left">
      <div class="topbar-line"><strong>${worldInfo}</strong></div>
      <div class="topbar-line">Objective: ${htmlEscape(objective)}</div>
      <div class="topbar-line">State: ${pauseText}</div>
      <div class="button-row compact">
        <button data-global-action="advance-phase" aria-label="Advance day phase">Advance Phase</button>
        <button data-global-action="manual-save" aria-label="Save game">Save</button>
        <button data-global-action="export-save" aria-label="Export save">Export</button>
      </div>
    </div>
    <div class="topbar-group topbar-center">
      ${TOPBAR_RESOURCES.map((resource) => {
        const amount = resource.readAmount(state);
        const delta = resourceDelta[resource.id] ?? 0;
        const deltaClass = delta > 0 ? 'resource-up' : delta < 0 ? 'resource-down' : '';
        const deltaText = delta === 0 ? '' : `<span class="resource-delta">${delta > 0 ? '+' : ''}${delta}</span>`;
        return `<div class="resource-chip ${deltaClass}" data-resource-id="${resource.id}" role="status" aria-label="${resource.label}: ${amount}" data-tooltip="${resource.label}">${renderIcon(resource.iconId)}<span>${amount}</span>${deltaText}</div>`;
      }).join('')}
    </div>
    <div class="topbar-group topbar-right">
      ${menuButtons
        .map(
          (menu) => `<button class="icon-button ${activeMenu === menu.id ? 'selected' : ''}" data-menu-id="${menu.id}" aria-label="${menu.label}" title="${menu.label} (${menu.shortcut})">${renderIcon(menu.iconId)}<span class="badge hidden" data-menu-badge="${menu.id}">0</span></button>`,
        )
        .join('')}
    </div>
  `;
};

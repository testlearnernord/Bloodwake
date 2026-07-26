import { ITEMS_BY_ID } from '../../data/items';
import type { SaveGame } from '../../types/models';
import { renderIcon } from '../icons/registry';

export const renderBottomHud = (state: SaveGame, weaponName: string, dodgeCooldownReady: boolean): string => {
  const healthPct = Math.max(0, Math.min(100, (state.player.health / state.player.maxHealth) * 100));
  const vitaePct = Math.max(0, Math.min(100, (state.player.vitae / state.player.maxVitae) * 100));
  const hungerPct = Math.max(0, Math.min(100, (state.player.hunger / 10) * 100));
  const weapon = state.player.equipment.Weapon ? ITEMS_BY_ID[state.player.equipment.Weapon].name : weaponName;
  return `
    <div class="hud-vitals">
      <div class="hud-bar" aria-label="Health ${state.player.health} of ${state.player.maxHealth}">
        <div class="hud-bar-label">Health ${state.player.health}/${state.player.maxHealth}</div>
        <div class="hud-bar-track"><div class="hud-bar-fill health-fill" style="width:${healthPct}%"></div></div>
      </div>
      <div class="hud-bar" aria-label="Vitae ${state.player.vitae} of ${state.player.maxVitae}">
        <div class="hud-bar-label">Vitae ${state.player.vitae}/${state.player.maxVitae}</div>
        <div class="hud-bar-track"><div class="hud-bar-fill vitae-fill" style="width:${vitaePct}%"></div></div>
      </div>
      <div class="hud-bar" aria-label="Hunger ${state.player.hunger}">
        <div class="hud-bar-label">Hunger ${state.player.hunger}</div>
        <div class="hud-bar-track"><div class="hud-bar-fill hunger-fill" style="width:${hungerPct}%"></div></div>
      </div>
    </div>
    <div class="hud-combat">
      <div class="hud-chip" data-tooltip="Current weapon">${renderIcon('weapon')}<span>${weapon}</span></div>
      <div class="hud-chip" data-tooltip="Ability slots reserved for Milestone 0.3">${renderIcon('crafting')}<span>Abilities: Coming Soon</span></div>
      <div class="hud-chip" data-tooltip="Dodge cooldown">${renderIcon('accessory')}<span>Dodge: ${dodgeCooldownReady ? 'Ready' : 'Recovering'}</span></div>
      <div class="hud-chip" data-tooltip="Active status effects">${renderIcon('bloodEssence')}<span>Status: Stable</span></div>
    </div>
  `;
};

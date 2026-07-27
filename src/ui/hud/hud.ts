import { ITEMS_BY_ID } from '../../data/items';
import type { CombatUiSnapshot } from '../../game/combat/combatTypes';
import type { SaveGame } from '../../types/models';
import { renderIcon } from '../icons/registry';
import { htmlEscape } from '../../utilities/html';

const renderAbilitySlot = (ability: NonNullable<CombatUiSnapshot>['abilities'][number]): string => {
  const safeCooldownMs = Math.max(0, ability.cooldownMs);
  const cooldownPct = safeCooldownMs === 0 ? 0 : Math.max(0, Math.min(100, (ability.cooldownRemainingMs / safeCooldownMs) * 100));
  const disabledReason = ability.disabledReason ? `<span class="ability-reason">${htmlEscape(ability.disabledReason)}</span>` : '';
  return `
    <div class="ability-slot ${ability.active ? 'active' : ''} ${ability.disabledReason ? 'disabled' : ''}" data-tooltip="${htmlEscape(`${ability.label} (${ability.shortcut})`)}">
      <div class="ability-icon">${renderIcon(ability.iconId)}</div>
      <div class="ability-meta">
        <strong>${htmlEscape(ability.label)}</strong>
        <span>${htmlEscape(ability.shortcut)} · Vitae ${ability.vitaeCost}</span>
        ${disabledReason}
      </div>
      <div class="ability-cooldown" style="height:${cooldownPct}%"></div>
    </div>
  `;
};

export const renderBottomHud = (
  state: SaveGame,
  weaponName: string,
  dodgeCooldownReady: boolean,
  combatUi: CombatUiSnapshot | null,
): string => {
  const healthPct = Math.max(0, Math.min(100, (state.player.health / state.player.maxHealth) * 100));
  const delayedHealthPct = combatUi ? Math.max(0, Math.min(100, (combatUi.playerHealthPreview / state.player.maxHealth) * 100)) : healthPct;
  const vitaePct = Math.max(0, Math.min(100, (state.player.vitae / state.player.maxVitae) * 100));
  const hungerPct = Math.max(0, Math.min(100, (state.player.hunger / 10) * 100));
  const weapon = state.player.equipment.Weapon ? ITEMS_BY_ID[state.player.equipment.Weapon].name : weaponName;
  const target = combatUi?.lockedTarget ?? null;
  const abilities = combatUi?.abilities ?? [];
  return `
    <div class="hud-vitals">
      <div class="hud-bar" aria-label="Health ${state.player.health} of ${state.player.maxHealth}">
        <div class="hud-bar-label">Health ${state.player.health}/${state.player.maxHealth}</div>
        <div class="hud-bar-track">
          <div class="hud-bar-fill delayed-fill" style="width:${delayedHealthPct}%"></div>
          <div class="hud-bar-fill health-fill" style="width:${healthPct}%"></div>
        </div>
      </div>
      <div class="hud-bar" aria-label="Vitae ${state.player.vitae} of ${state.player.maxVitae}">
        <div class="hud-bar-label">Vitae ${state.player.vitae}/${state.player.maxVitae}</div>
        <div class="hud-bar-track"><div class="hud-bar-fill vitae-fill" style="width:${vitaePct}%"></div></div>
      </div>
      <div class="hud-bar" aria-label="Hunger ${state.player.hunger}">
        <div class="hud-bar-label">Hunger ${state.player.hunger}</div>
        <div class="hud-bar-track"><div class="hud-bar-fill hunger-fill" style="width:${hungerPct}%"></div></div>
      </div>
      <div class="hud-chip-row">
        <div class="hud-chip" data-tooltip="Current weapon">${renderIcon('weapon')}<span>${htmlEscape(weapon)}</span></div>
        <div class="hud-chip" data-tooltip="Player state">${renderIcon('status')}<span>${htmlEscape(combatUi?.playerState ?? 'idle')}</span></div>
        <div class="hud-chip" data-tooltip="Dodge cooldown">${renderIcon('dodge')}<span>Dodge: ${dodgeCooldownReady ? 'Ready' : 'Recovering'}</span></div>
      </div>
    </div>
    <div class="hud-combat">
      <div class="ability-grid">${abilities.map(renderAbilitySlot).join('')}</div>
      <div class="target-panel ${target ? '' : 'hidden'}">
        ${
          target
           ? `<div class="target-header"><strong>Locked: ${htmlEscape(target.name)}</strong><span>${target.elite ? 'Elite' : target.typeLabel}</span></div>
               <div class="hud-bar compact-target" aria-label="Target ${target.health} of ${target.maxHealth}">
                 <div class="hud-bar-track"><div class="hud-bar-fill target-fill" style="width:${Math.max(0, Math.min(100, (target.health / target.maxHealth) * 100))}%"></div></div>
                 <div class="hud-bar-label">${target.health}/${target.maxHealth}</div>
               </div>
               <p class="target-status">${htmlEscape(target.statusText)}</p>`
            : ''
        }
      </div>
    </div>
  `;
};

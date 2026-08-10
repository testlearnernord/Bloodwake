import Phaser from 'phaser';
import { ENTHRALL_VITAE_COST, TURN_COST_VITAE } from '../config/balancing';
import { COLLECTIBLES_BY_ID } from '../data/collectibles';
import { PROFESSIONS_BY_ID } from '../data/professions';
import { ITEMS_BY_ID } from '../data/items';
import { createNewGameState, deriveCharacterSeed, getActiveQuestStepText, getHumanById } from './state';
import { queueCraftingOrder } from '../simulation/crafting/crafting';
import { queueRoomConstruction } from '../simulation/building/building';
import { completeQuestStep } from '../simulation/quests/quests';
import { advanceWorldPhase } from '../simulation/time/phaseAdvance';
import { loadSettings, saveSettings } from '../persistence/settings';
import { deleteSlot, exportSaveGame, importSaveGame, listSaveSlots, loadFromSlot, saveToSlot } from '../persistence/saveStore';
import type { ItemCategory, ItemId, JobPriority, RoomId, SaveGame, SaveSlot, VampireVassal, VassalOperationalOrderType } from '../types/models';
import { createDefaultSeed } from '../utilities/rng';
import type { GameBridge } from '../game/bridge';
import { WorldScene } from '../game/scenes/WorldScene';
import type { CombatUiSnapshot, HumanActionMode, WorldSceneApi } from '../game/combat/combatTypes';
import { getTraitById } from '../simulation/traits/traitUtils';
import { addItem, canEquipItem, equipItem, mergeCompatibleStacks, unequipItem } from '../simulation/inventory/inventory';
import { calculatePlayerCombatStats, useHealingDraught } from '../simulation/combat/stats';
import { applyHumanAction, validateHumanAction } from '../simulation/combat/bite';
import { getBloodChoicePreview } from '../simulation/blood/bloodChoices';
import { getBloodResonanceLabel } from '../simulation/blood/bloodResonance';
import { reassertThrallControl } from '../simulation/servants/humanThralls';
import { elevateThrallToVassal } from '../simulation/servants/thrallElevation';
import { bindThrallAsBloodDonor, validateBindThrallAsBloodDonor } from '../simulation/servants/bloodDonors';
import { setVassalTorpor } from '../simulation/servants/dominion';
import { issueVassalOperationalOrder } from '../simulation/servants/vassalOrders';
import { BLOOD_DONOR_HOLD_MS, renderBloodDonorConfirmation } from '../ui/confirmations/bloodDonorConfirmation';
import { renderBottomHud } from '../ui/hud/hud';
import { renderOverlay, getRoomReadiness, getRecipeReadiness } from '../ui/overlays/overlays';
import { ToastManager } from '../ui/notifications/toasts';
import { renderGameShell, renderTitleScreen as renderTitleLayout } from '../ui/shell/layout';
import { TOPBAR_RESOURCES, renderTopBar } from '../ui/topbar/topbar';
import { TooltipManager } from '../ui/tooltips/tooltips';
import { isTypingTarget, shouldCaptureGameplayKey, type MenuId } from '../ui/uiState';
import { htmlEscape } from '../utilities/html';

const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'];
const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25] as const;

export class BloodwakeApp {
  private readonly root: HTMLElement;
  private state: SaveGame | null = null;
  private phaserGame: Phaser.Game | null = null;
  private focusedHumanId: string | null = null;
  private selectedRoomId: RoomId = 'workshop';
  private activeZone = 'Ruined Stronghold';
  private activeMenu: MenuId | null = null;
  private selectedItemId: ItemId | null = null;
  private selectedFilter: 'all' | ItemCategory = 'all';
  private toastManager: ToastManager | null = null;
  private tooltipManager: TooltipManager | null = null;
  private previousResourceSnapshot: Record<string, number> | null = null;
  private sceneApi: WorldSceneApi | null = null;
  private combatUi: CombatUiSnapshot | null = null;
  private hudInterval: number | null = null;
  private pendingBloodDonorId: string | null = null;
  private bloodDonorHoldTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    await this.renderTitleScreen();
  }

  private async renderTitleScreen(): Promise<void> {
    this.tooltipManager?.dispose();
    this.tooltipManager = null;
    this.toastManager = null;
    this.activeMenu = null;
    this.pendingBloodDonorId = null;
    this.cancelBloodDonorHold();
    this.sceneApi = null;
    this.combatUi = null;
    if (this.hudInterval !== null) {
      window.clearInterval(this.hudInterval);
      this.hudInterval = null;
    }

    let worldSeed = createDefaultSeed();
    let characterRoll = 0;
    const renderPreview = (): void => {
      const preview = createNewGameState({ seed: worldSeed, characterRoll, playerName: nameInput.value });
      characterRollInput.value = String(characterRoll);
      seedInput.value = worldSeed;
      previewPanel.replaceChildren(this.createPreviewContent(preview));
    };

    const slots = await listSaveSlots();
    this.root.innerHTML = renderTitleLayout(worldSeed, characterRoll, this.renderSaveSlots(slots));

    const nameInput = this.query<HTMLInputElement>('#player-name');
    const seedInput = this.query<HTMLInputElement>('#world-seed');
    const characterRollInput = this.query<HTMLInputElement>('#character-roll');
    const previewPanel = this.query<HTMLDivElement>('#preview-panel');

    renderPreview();

    this.query<HTMLButtonElement>('#randomize-seed').onclick = () => {
      worldSeed = createDefaultSeed();
      characterRoll = 0;
      renderPreview();
    };

    this.query<HTMLButtonElement>('#reroll-vampire').onclick = () => {
      characterRoll += 1;
      renderPreview();
    };

    seedInput.onchange = () => {
      worldSeed = seedInput.value.trim() || createDefaultSeed();
      renderPreview();
    };

    characterRollInput.onchange = () => {
      characterRoll = Math.max(0, Number.parseInt(characterRollInput.value, 10) || 0);
      renderPreview();
    };

    nameInput.onchange = renderPreview;

    this.query<HTMLButtonElement>('#start-game').onclick = async () => {
      this.state = createNewGameState({ playerName: nameInput.value, seed: worldSeed, characterRoll });
      await this.startGameShell();
    };

    for (const slot of slots) {
      const loadButton = this.root.querySelector<HTMLButtonElement>(`[data-load-slot="${slot.id}"]`);
      if (loadButton) {
        loadButton.onclick = async () => {
          this.state = await loadFromSlot(slot.id);
          if (this.state) {
            await this.startGameShell();
          }
        };
      }
      const deleteButton = this.root.querySelector<HTMLButtonElement>(`[data-delete-slot="${slot.id}"]`);
      if (deleteButton) {
        deleteButton.onclick = async () => {
          await deleteSlot(slot.id);
          await this.renderTitleScreen();
        };
      }
    }

    this.query<HTMLButtonElement>('#import-save').onclick = async () => {
      try {
        const raw = this.query<HTMLTextAreaElement>('#import-json').value;
        const imported = importSaveGame(raw);
        await saveToSlot(SLOT_IDS[0], imported);
        await this.renderTitleScreen();
      } catch (error) {
        this.showError(error, 'Failed to import save.');
      }
    };
  }

  private async startGameShell(): Promise<void> {
    if (!this.state) {
      return;
    }
    this.state.settings = { ...this.state.settings, ...loadSettings() };
    this.applyUiScale();
    this.root.innerHTML = renderGameShell();
    this.toastManager = new ToastManager(this.query('#toast-root'));
    this.tooltipManager = new TooltipManager(this.root);
    this.tooltipManager.install();
    this.installGlobalShortcuts();
    this.installGameplayGuards();
    this.mountPhaser();
    this.previousResourceSnapshot = null;
    this.renderGame();
    this.hudInterval = window.setInterval(() => this.renderCombatHud(), 100);
    await this.autoSave('slot-1');
    this.notify('Save completed.');
  }

  private mountPhaser(): void {
    if (this.phaserGame) {
      this.phaserGame.destroy(true);
    }
    const bridge: GameBridge = {
      getState: () => {
        if (!this.state) {
          throw new Error('Game state is unavailable.');
        }
        return this.state;
      },
      getCombatStats: () => {
        if (!this.state) {
          throw new Error('Game state is unavailable.');
        }
        return calculatePlayerCombatStats(this.state.player);
      },
      isInputBlocked: () => this.activeMenu !== null || this.pendingBloodDonorId !== null,
      isGameplayInputBlocked: () =>
        this.activeMenu !== null || this.pendingBloodDonorId !== null || !document.hasFocus() || isTypingTarget(document.activeElement),
      getReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      registerWorldSceneApi: (api) => {
        this.sceneApi = api;
      },
      onCombatUiStateChanged: (snapshot) => {
        this.combatUi = snapshot;
        this.renderCombatHud();
      },
      commitHumanAction: (humanId, mode) => {
        if (!this.state) {
          return { ok: false, message: 'Game state is unavailable.' };
        }
        const result = applyHumanAction(this.state, humanId, mode);
        if (result.state === this.state) {
          return { ok: false, message: result.message };
        }
        this.state = result.state;
        this.focusedHumanId = null;
        void this.autoSave('slot-1');
        this.notify(result.message);
        if (result.inheritanceSummary) {
          this.notify(result.inheritanceSummary);
        }
        this.renderGame();
        return { ok: true, message: result.message, inheritanceSummary: result.inheritanceSummary };
      },
      onHumanFocused: (humanId) => {
        this.focusedHumanId = humanId;
        this.renderContextPanel();
        this.bindGameActions();
      },
      onFeedShortcut: (humanId) => {
        this.sceneApi?.startHumanActionSequence(humanId, 'feed');
      },
      onCollectItem: (nodeId, itemId, amount) => {
        if (!this.state) return;
        // Record node as collected this cycle (prevents duplicate rewards)
        if (this.state.worldCycle.collectedResourceNodeIds.includes(nodeId)) return;
        this.state.worldCycle = {
          ...this.state.worldCycle,
          collectedResourceNodeIds: [...this.state.worldCycle.collectedResourceNodeIds, nodeId],
        };
        this.state.inventory = addItem(this.state.inventory, itemId, amount);
        this.state.lastEventLog.unshift(`Collected ${amount} ${ITEMS_BY_ID[itemId].name} in ${this.activeZone}.`);
        this.completeStepForEvent('travel');
        this.notify(`Collected ${amount} ${ITEMS_BY_ID[itemId].name}.`);
        this.renderGame();
      },
      onCollectMemory: (collectibleId) => {
        if (!this.state) return;
        const collectible = COLLECTIBLES_BY_ID[collectibleId];
        this.state.collectibles = this.state.collectibles.map((entry) =>
          entry.collectibleId === collectibleId ? { ...entry, discovered: true } : entry,
        );
        for (const [attributeKey, amount] of Object.entries(collectible.reward)) {
          this.state.player.attributes[attributeKey as keyof typeof this.state.player.attributes] += amount ?? 0;
        }
        this.state.lastEventLog.unshift(`Recovered ${collectible.name}.`);
        this.completeStepForEvent('memory');
        void this.autoSave('slot-1');
        this.notify('Memory recovered.');
        this.renderGame();
      },
      onEnemyDefeated: (instanceId, enemyType) => {
        if (!this.state) return;
        // Record enemy as defeated this cycle (prevents duplicate rewards)
        if (!this.state.worldCycle.defeatedEnemyIds.includes(instanceId)) {
          this.state.worldCycle = {
            ...this.state.worldCycle,
            defeatedEnemyIds: [...this.state.worldCycle.defeatedEnemyIds, instanceId],
          };
          this.state.strategicResources.bloodEssence += 1;
          this.state.lastEventLog.unshift(`Defeated ${enemyType.replace('_', ' ')} (${instanceId}) and harvested Blood Essence.`);
          this.notify('Blood Essence increased.');
          this.renderGame();
        }
      },
      onZoneChanged: (zone) => {
        this.activeZone = zone;
        if (zone === 'Ruined Stronghold') {
          this.completeStepForEvent('return');
        } else if (zone === 'Forest Road') {
          this.completeStepForEvent('travel');
        }
        this.renderGame();
      },
      onPlayerVitalsChanged: (nextHealth, nextVitae) => {
        if (!this.state) return;
        if (nextHealth < this.state.player.health) {
          this.notify('You were hit.');
        }
        this.state.player.health = nextHealth;
        this.state.player.vitae = nextVitae;
        this.renderCombatHud();
      },
      onVassalVitalsChanged: (vassalId, nextHealth, nextVitae) => {
        if (!this.state) return;
        this.state.vampireVassals = this.state.vampireVassals.map((vassal) =>
          vassal.id === vassalId
            ? { ...vassal, health: Math.max(0, Math.min(vassal.maxHealth, nextHealth)), vitae: Math.max(0, Math.min(vassal.maxVitae, nextVitae)) }
            : vassal,
        );
      },
      onVassalIncapacitated: (vassalId) => {
        if (!this.state) return;
        const victim = this.state.vampireVassals.find((vassal) => vassal.id === vassalId);
        if (!victim || victim.state === 'torpor') return;
        this.state.vampireVassals = this.state.vampireVassals.map((vassal) =>
          vassal.id === vassalId
            ? {
                ...vassal,
                health: 1,
                state: 'torpor',
                torporSinceDay: this.state!.time.day,
                operationalOrder: { type: 'none', issuedDay: null },
                currentJob: null,
                currentTask: null,
                taskReason: 'Driven into Torpor by combat injuries.',
              }
            : vassal,
        );
        this.state.lastEventLog.unshift(`[Combat] ${victim.name} was driven into Torpor.`);
        this.notify(`${victim.name} was driven into Torpor.`);
        void this.autoSave('slot-1');
        this.renderGame();
      },
      onRespawn: () => {
        if (!this.state) return;
        this.state.player.health = this.state.player.maxHealth;
        this.state.lastEventLog.unshift('You collapse and reform beside the coffin.');
        this.notify('You reformed at the coffin.');
        this.renderGame();
      },
      onPauseRequested: () => {
        this.openOrCloseMenu(this.activeMenu === 'pause' ? null : 'pause');
      },
      notifyWorldCycleChanged: () => {
        // WorldScene polls worldCycle.cycle directly — no additional action needed here.
      },
    };
    this.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-root',
      width: 1280,
      height: 720,
      scene: [new WorldScene(bridge)],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          debug: false,
          gravity: { x: 0, y: 0 },
        },
      },
      backgroundColor: '#0b0f13',
    });
  }

  private renderGame(): void {
    if (!this.state) {
      return;
    }
    const objective = getActiveQuestStepText(this.state);
    const resourceSnapshot = Object.fromEntries(TOPBAR_RESOURCES.map((resource) => [resource.id, resource.readAmount(this.state!)]));
    const delta = this.previousResourceSnapshot
      ? Object.fromEntries(Object.entries(resourceSnapshot).map(([id, amount]) => [id, amount - (this.previousResourceSnapshot?.[id] ?? 0)]))
      : {};
    this.previousResourceSnapshot = resourceSnapshot;

    this.query('#topbar').innerHTML = renderTopBar(this.state, this.activeZone, objective, this.activeMenu, this.activeMenu === 'pause', delta);
    this.renderCombatHud();
    this.renderContextPanel();

    const overlayRoot = this.query('#overlay-root');
    if (this.activeMenu) {
      overlayRoot.classList.remove('hidden');
      overlayRoot.innerHTML = renderOverlay(this.activeMenu, this.state, this.selectedItemId, this.selectedFilter, this.selectedRoomId);
      const closeButton = overlayRoot.querySelector<HTMLButtonElement>('[data-close-overlay]');
      closeButton?.focus();
    } else {
      overlayRoot.classList.add('hidden');
      overlayRoot.innerHTML = '';
    }

    this.bindGameActions();
    this.renderBloodDonorConfirmationRoot();
    if (this.activeMenu || this.pendingBloodDonorId) {
      this.phaserGame?.scene.pause('world');
    } else {
      this.phaserGame?.scene.resume('world');
    }
  }

  private createPreviewContent(state: SaveGame): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const grid = document.createElement('div');
    grid.className = 'preview-grid';

    const summary = document.createElement('div');
    const summaryTitle = document.createElement('h3');
    summaryTitle.textContent = state.player.name;
    const summarySeed = document.createElement('p');
    summarySeed.textContent = `World Seed: ${state.seed}`;
    const summaryCharacterRoll = document.createElement('p');
    summaryCharacterRoll.textContent = `Vampire Roll: ${state.characterRoll} (${deriveCharacterSeed(state.seed, state.characterRoll)})`;
    summary.append(summaryTitle, summarySeed, summaryCharacterRoll);

    const attributes = document.createElement('div');
    const attributesTitle = document.createElement('h3');
    attributesTitle.textContent = 'Attributes';
    const attributesList = document.createElement('ul');
    for (const [key, value] of Object.entries(state.player.attributes)) {
      const item = document.createElement('li');
      item.textContent = `${key}: ${value}`;
      attributesList.append(item);
    }
    attributes.append(attributesTitle, attributesList);

    const traits = document.createElement('div');
    const traitsTitle = document.createElement('h3');
    traitsTitle.textContent = 'Traits';
    const traitsList = document.createElement('ul');
    const previewTraits = state.player.traitIds.length > 0 ? state.player.traitIds : ['None'];
    for (const traitId of previewTraits) {
      const item = document.createElement('li');
      if (traitId === 'None') {
        item.textContent = 'None';
      } else {
        const trait = getTraitById(traitId);
        item.textContent = `${trait.name} (${trait.rarity}) — ${trait.description}`;
      }
      traitsList.append(item);
    }
    traits.append(traitsTitle, traitsList);

    grid.append(summary, attributes, traits);
    fragment.append(grid);
    return fragment;
  }

  private renderSaveSlots(slots: SaveSlot[]): string {
    if (slots.length === 0) {
      return '<p>No save slots yet.</p>';
    }
    return slots
      .map(
        (slot) => `
          <article class="slot-card">
            <div><strong>${slot.id}</strong></div>
            <div>${new Date(slot.updatedAt).toLocaleString()}</div>
            <div class="button-row compact">
              <button data-load-slot="${slot.id}">Load</button>
              <button data-delete-slot="${slot.id}">Delete</button>
            </div>
          </article>
        `,
      )
      .join('');
  }

  private renderCombatHud(): void {
    if (!this.state) {
      return;
    }
    const combatUi = this.combatUi;
    this.query('#bottom-hud').innerHTML = renderBottomHud(
      this.state,
      'Unarmed',
      (combatUi?.abilities.find((ability) => ability.id === 'dodge')?.cooldownRemainingMs ?? 0) <= 0,
      combatUi,
    );
  }

  private renderContextPanel(): void {
    if (!this.state) {
      return;
    }
    const contextPanel = this.query('#context-panel');
    const human = this.focusedHumanId ? getHumanById(this.state, this.focusedHumanId) : null;
    if (!human) {
      contextPanel.classList.add('hidden');
      contextPanel.innerHTML = '';
      return;
    }
    contextPanel.classList.remove('hidden');
    const humanActions = (['feed', 'drain', 'enthrall', 'turn'] as const).map((mode) => ({
      mode,
      validation: validateHumanAction(this.state!, human, mode),
      preview: mode === 'feed' || mode === 'drain' ? getBloodChoicePreview(this.state!, human, mode) : null,
    }));
    const profession = PROFESSIONS_BY_ID[human.professionId];
    const traitNames = human.traitIds.map((traitId) => getTraitById(traitId).name);
    const turnValidation = humanActions.find((action) => action.mode === 'turn')?.validation;
    const turnStatus = turnValidation?.ok ? 'Eligible for turning now.' : turnValidation?.reason ?? 'Not eligible for turning.';
    contextPanel.innerHTML = `
      <h3>${htmlEscape(human.name)} ${htmlEscape(human.familyName)}</h3>
      <p>${htmlEscape(profession.name)} · Blood Resonance: ${htmlEscape(getBloodResonanceLabel(human.bloodResonance))} (${human.bloodResonance})</p>
      <p>${htmlEscape(profession.practicalBenefit)}</p>
      <p>Traits: ${traitNames.map(htmlEscape).join(', ') || 'none'}</p>
      <p class="hint">${htmlEscape(turnStatus)}</p>
      <div class="button-row compact">
        ${humanActions
          .map(
            ({ mode, validation }) => `<button data-human-action="${mode}" ${validation.ok ? '' : 'disabled'}>${mode === 'turn' ? `Turn into Vassal (${TURN_COST_VITAE} Vitae)` : mode === 'enthrall' ? `Enthrall as Thrall (${ENTHRALL_VITAE_COST} Vitae)` : mode[0].toUpperCase() + mode.slice(1)}</button>`,
          )
          .join('')}
      </div>
      <ul class="context-reasons">
        ${humanActions
          .map(
            ({ mode, validation, preview }) =>
              `<li>${mode === 'turn' ? 'Turn' : mode === 'enthrall' ? 'Enthrall' : mode[0].toUpperCase() + mode.slice(1)}: ${htmlEscape(validation.ok ? (preview ?? 'Ready.') : validation.reason)}</li>`,
          )
          .join('')}
      </ul>
      <p class="hint">F feeds nearby humans. Tab cycles targets, Shift+Tab cycles back, middle mouse locks near cursor.</p>
    `;
  }

  private bindGameActions(): void {

    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-global-action]")) {
      button.onclick = async () => {
        const action = button.dataset.globalAction;
        if (action === 'advance-phase') {
          await this.advancePhase();
        } else if (action === 'manual-save') {
          await this.autoSave('slot-1');
          this.notify('Save completed.');
        } else if (action === 'export-save' && this.state) {
          const exported = exportSaveGame(this.state);
          await navigator.clipboard.writeText(exported).catch(() => undefined);
          this.notify('Save exported to clipboard.');
        }
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-menu-id]')) {
      button.onclick = () => {
        this.openOrCloseMenu(button.dataset.menuId as MenuId);
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-human-action]')) {
      button.onclick = async () => {
        if (this.focusedHumanId) {
          this.sceneApi?.startHumanActionSequence(this.focusedHumanId, button.dataset.humanAction as HumanActionMode);
        }
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-reassert-thrall]')) {
      button.onclick = async () => {
        if (!this.state) return;
        const result = reassertThrallControl(this.state, button.dataset.reassertThrall ?? '');
        if (result.state === this.state) {
          this.notify(result.message);
          return;
        }
        this.state = result.state;
        this.notify(result.message);
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-bind-blood-donor]')) {
      button.onclick = () => {
        if (!this.state) return;
        const servantId = button.dataset.bindBloodDonor ?? '';
        const servant = this.state.humanServants.find((candidate) => candidate.id === servantId);
        const validation = validateBindThrallAsBloodDonor(this.state, servant);
        if (!validation.ok || !servant) {
          this.notify(validation.ok ? 'Human Thrall is not available.' : validation.reason);
          return;
        }
        this.pendingBloodDonorId = servantId;
        this.renderBloodDonorConfirmationRoot();
        this.phaserGame?.scene.pause('world');
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-elevate-thrall]')) {
      button.onclick = async () => {
        if (!this.state) return;
        const result = elevateThrallToVassal(this.state, button.dataset.elevateThrall ?? '');
        if (result.state === this.state) {
          this.notify(result.message);
          return;
        }
        this.state = result.state;
        this.notify(result.message);
        if (result.inheritanceSummary) this.notify(result.inheritanceSummary);
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }

    for (const select of this.root.querySelectorAll<HTMLSelectElement>('select[data-human-servant-id]')) {
      select.onchange = async () => {
        if (!this.state) return;
        const servantId = select.dataset.humanServantId;
        const jobType = select.dataset.jobType as keyof SaveGame['humanServants'][number]['priorities'];
        this.state.humanServants = this.state.humanServants.map((servant) =>
          servant.id === servantId
            ? { ...servant, priorities: { ...servant.priorities, [jobType]: select.value as JobPriority } }
            : servant,
        );
        this.notify('Human Thrall work priorities updated.');
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }

    for (const select of this.root.querySelectorAll<HTMLSelectElement>('select[data-vassal-order-id]')) {
      select.onchange = async () => {
        if (!this.state) return;
        const vassalId = select.dataset.vassalOrderId ?? '';
        const type = select.value as VassalOperationalOrderType;
        const result = issueVassalOperationalOrder(this.state, vassalId, type);
        this.notify(result.message);
        if (result.state !== this.state) {
          this.state = result.state;
          this.completeStepForEvent('assign');
          await this.autoSave('slot-1');
        }
        // Always rerender so a refused order snaps the select back to the authoritative order.
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-vassal-torpor]')) {
      button.onclick = async () => {
        if (!this.state) return;
        const vassalId = button.dataset.vassalTorpor ?? '';
        const torpor = button.dataset.vassalTorporAction === 'sleep';
        const result = setVassalTorpor(this.state, vassalId, torpor);
        if (result.state === this.state) {
          this.notify(result.message);
          return;
        }
        this.state = result.state;
        this.notify(result.message);
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }

    for (const select of this.root.querySelectorAll<HTMLSelectElement>('select[data-servant-id]')) {
      select.onchange = () => {
        if (!this.state) return;
        const vassalId = select.dataset.servantId;
        const jobType = select.dataset.jobType as keyof VampireVassal['priorities'];
        this.state.vampireVassals = this.state.vampireVassals.map((vassal) =>
          vassal.id === vassalId
            ? { ...vassal, priorities: { ...vassal.priorities, [jobType]: select.value as JobPriority } }
            : vassal,
        );
        this.completeStepForEvent('assign');
        this.notify('Vampire vassal priorities updated.');
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-room-select]')) {
      button.onclick = () => {
        this.selectedRoomId = button.dataset.roomSelect as RoomId;
        this.notify(`Selected ${this.selectedRoomId.replaceAll('_', ' ')}.`);
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-build-x]')) {
      button.onclick = async () => {
        if (!this.state) return;
        const state = this.state;
        try {
          const { ready, reason } = getRoomReadiness(state, this.selectedRoomId);
          if (!ready) {
            this.notify(reason);
            return;
          }
          const result = queueRoomConstruction(
            state.rooms,
            state.inventory,
            state.strategicResources,
            this.selectedRoomId,
            Number(button.dataset.buildX),
            Number(button.dataset.buildY),
          );
          this.state.rooms = result.updatedRooms;
          this.state.inventory = result.updatedInventory;
          this.state.strategicResources = result.updatedStrategicResources;
          this.state.lastEventLog.unshift(`Construction starts on ${this.selectedRoomId}.`);
          this.completeStepForEvent('build');
          this.notify('Construction queued.');
          await this.autoSave('slot-1');
          this.renderGame();
        } catch (error) {
          this.showError(error, 'Failed to place room.');
        }
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-recipe-id]')) {
      button.onclick = async () => {
        if (!this.state) return;
        const state = this.state;
        const recipeId = button.dataset.recipeId ?? '';
        const { ready, reason } = getRecipeReadiness(state, recipeId);
        if (!ready) {
          this.notify(reason);
          return;
        }
        this.state.craftingQueue = queueCraftingOrder(this.state.craftingQueue, recipeId);
        this.state.lastEventLog.unshift(`Queued ${button.textContent?.trim() ?? 'recipe'}.`);
        this.notify('Crafting queued.');
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-item-id]')) {
      button.onclick = () => {
        this.selectedItemId = button.dataset.itemId as ItemId;
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-item-filter]')) {
      button.onclick = () => {
        this.selectedFilter = button.dataset.itemFilter as 'all' | ItemCategory;
        this.renderGame();
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-equip-item]')) {
      button.onclick = () => {
        if (!this.state) return;
        const itemId = button.dataset.equipItem as ItemId;
        const check = canEquipItem(itemId);
        if (!check.ok) {
          this.notify(check.reason ?? 'Cannot equip item.');
          return;
        }
        try {
          const equipped = equipItem(this.state.player, this.state.inventory, itemId);
          this.state.player = equipped.player;
          this.state.inventory = equipped.inventory;
          this.notify(`${ITEMS_BY_ID[itemId].name} equipped.`);
          this.renderGame();
        } catch (error) {
          this.showError(error, 'Failed to equip item.');
        }
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-unequip-slot]')) {
      button.onclick = () => {
        if (!this.state) return;
        try {
          const result = unequipItem(this.state.player, this.state.inventory, button.dataset.unequipSlot as 'Weapon' | 'Armor' | 'Accessory');
          this.state.player = result.player;
          this.state.inventory = result.inventory;
          this.notify('Item unequipped.');
          this.renderGame();
        } catch (error) {
          this.showError(error, 'Failed to unequip item.');
        }
      };
    }

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-use-item]')) {
      button.onclick = () => {
        if (!this.state) return;
        const itemId = button.dataset.useItem as ItemId;
        if (itemId !== 'healing_draught') {
          this.notify('That item cannot be used directly.');
          return;
        }
        try {
          const result = useHealingDraught(this.state.player, this.state.inventory);
          this.state.player = result.player;
          this.state.inventory = mergeCompatibleStacks(result.inventory);
          this.notify(`Healing Draught used (+${result.healed} health).`);
          this.renderGame();
        } catch (error) {
          this.showError(error, 'Unable to use item.');
        }
      };
    }

    const closeOverlay = this.root.querySelector<HTMLButtonElement>('[data-close-overlay]');
    if (closeOverlay) {
      closeOverlay.onclick = () => this.openOrCloseMenu(null);
    }

    const returnTitleButton = this.root.querySelector<HTMLButtonElement>('#return-title');
    if (returnTitleButton) {
      returnTitleButton.onclick = async () => {
        this.openOrCloseMenu(null);
        await this.renderTitleScreen();
      };
    }

    const saveOverlayButton = this.root.querySelector<HTMLButtonElement>('#manual-save-overlay');
    if (saveOverlayButton) {
      saveOverlayButton.onclick = async () => {
        await this.autoSave('slot-1');
        this.notify('Save completed.');
      };
    }

    const uiScaleSelect = this.root.querySelector<HTMLSelectElement>('[data-setting-ui-scale]');
    if (uiScaleSelect) {
      uiScaleSelect.onchange = () => {
        if (!this.state) return;
        const nextScale = Number(uiScaleSelect.value);
        if (!UI_SCALE_OPTIONS.includes(nextScale as (typeof UI_SCALE_OPTIONS)[number])) {
          return;
        }
        this.state.settings = { ...this.state.settings, uiScale: nextScale };
        saveSettings(this.state.settings);
        this.applyUiScale();
        this.renderGame();
      };
    }
  }

  private cancelBloodDonorHold(): void {
    if (this.bloodDonorHoldTimer !== null) {
      window.clearTimeout(this.bloodDonorHoldTimer);
      this.bloodDonorHoldTimer = null;
    }
    const button = this.root.querySelector<HTMLButtonElement>('[data-confirm-blood-donor-hold]');
    button?.classList.remove('holding');
    button?.setAttribute('aria-pressed', 'false');
  }

  private renderBloodDonorConfirmationRoot(): void {
    const confirmationRoot = this.root.querySelector<HTMLElement>('#confirmation-root');
    if (!confirmationRoot) return;
    const servant = this.state && this.pendingBloodDonorId
      ? this.state.humanServants.find((candidate) => candidate.id === this.pendingBloodDonorId)
      : null;
    if (!servant) {
      this.pendingBloodDonorId = null;
      this.cancelBloodDonorHold();
      confirmationRoot.classList.add('hidden');
      confirmationRoot.innerHTML = '';
      return;
    }

    confirmationRoot.classList.remove('hidden');
    confirmationRoot.innerHTML = renderBloodDonorConfirmation(servant);
    const cancelButton = confirmationRoot.querySelector<HTMLButtonElement>('[data-cancel-blood-donor]');
    const holdButton = confirmationRoot.querySelector<HTMLButtonElement>('[data-confirm-blood-donor-hold]');

    cancelButton?.addEventListener('click', () => {
      this.pendingBloodDonorId = null;
      this.cancelBloodDonorHold();
      this.renderBloodDonorConfirmationRoot();
    });

    if (holdButton) {
      const startHold = (): void => {
        if (this.bloodDonorHoldTimer !== null || !this.pendingBloodDonorId) return;
        holdButton.classList.add('holding');
        holdButton.setAttribute('aria-pressed', 'true');
        this.bloodDonorHoldTimer = window.setTimeout(() => {
          this.bloodDonorHoldTimer = null;
          void this.commitBloodDonorBinding();
        }, BLOOD_DONOR_HOLD_MS);
      };
      const stopHold = (): void => this.cancelBloodDonorHold();
      holdButton.onpointerdown = (event) => {
        event.preventDefault();
        startHold();
      };
      holdButton.onpointerup = stopHold;
      holdButton.onpointerleave = stopHold;
      holdButton.onpointercancel = stopHold;
      holdButton.onkeydown = (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          startHold();
        }
      };
      holdButton.onkeyup = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          stopHold();
        }
      };
      holdButton.onclick = (event) => event.preventDefault();
    }

    cancelButton?.focus();
  }

  private async commitBloodDonorBinding(): Promise<void> {
    if (!this.state || !this.pendingBloodDonorId) return;
    const servantId = this.pendingBloodDonorId;
    this.pendingBloodDonorId = null;
    this.cancelBloodDonorHold();
    const result = bindThrallAsBloodDonor(this.state, servantId);
    this.renderBloodDonorConfirmationRoot();
    if (result.state === this.state) {
      this.notify(result.message);
      return;
    }
    this.state = result.state;
    this.notify(result.message);
    await this.autoSave('slot-1');
    this.renderGame();
  }

  private installGlobalShortcuts(): void {
    window.onkeydown = (event: KeyboardEvent) => {
      const gameplayFocused = Boolean(this.state) && this.root.querySelector('.game-app') !== null && !this.activeMenu && !this.pendingBloodDonorId;
      if (shouldCaptureGameplayKey(event, gameplayFocused)) {
        event.preventDefault();
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const map: Partial<Record<string, MenuId>> = {
        c: 'character',
        i: 'inventory',
        v: 'servants',
        b: 'stronghold',
        k: 'crafting',
        j: 'journal',
      };
      if (event.key === 'Escape') {
        event.preventDefault();
        if (this.pendingBloodDonorId) {
          this.pendingBloodDonorId = null;
          this.cancelBloodDonorHold();
          this.renderBloodDonorConfirmationRoot();
          return;
        }
        if (this.activeMenu) {
          this.openOrCloseMenu(null);
        } else {
          this.openOrCloseMenu('pause');
        }
        return;
      }
      const menu = map[key];
      if (menu) {
        event.preventDefault();
        this.openOrCloseMenu(this.activeMenu === menu ? null : menu);
      }
    };
  }

  private installGameplayGuards(): void {
    const gameplayRoot = this.root.querySelector<HTMLElement>('#phaser-root');
    if (!gameplayRoot) {
      return;
    }
    gameplayRoot.oncontextmenu = (event) => {
      event.preventDefault();
    };
    gameplayRoot.onwheel = (event) => {
      if (!this.activeMenu && !isTypingTarget(document.activeElement)) {
        event.preventDefault();
      }
    };
  }

  private applyUiScale(): void {
    const scale = this.state ? this.state.settings.uiScale : 1;
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }

  private openOrCloseMenu(menu: MenuId | null): void {
    this.activeMenu = menu;
    this.renderGame();
  }

  private async advancePhase(): Promise<void> {
    if (!this.state) {
      return;
    }
    const wasQueuedSimpleSword = this.state.craftingQueue.some((order) => order.recipeId === 'simple_sword' && order.status === 'queued');

    const result = advanceWorldPhase(this.state);
    this.state = result.state;

    for (const event of result.events) {
      if (event.includes('Dawn deepens your thirst') || event.includes('Daylight weakens you') || event.includes('breaks the thrall bond and escapes the stronghold')) {
        this.notify(event.replace('[Phase] ', ''));
      }
    }

    if (result.worldCycleChanged) {
      this.notify(`Night ${this.state.time.day} begins.`);
    }

    if (result.state.vampireVassals.some((vassal) => vassal.currentJob && vassal.currentTask)) {
      this.completeStepForEvent('assign');
    }
    if (wasQueuedSimpleSword && this.state.craftingQueue.some((order) => order.recipeId === 'simple_sword' && order.status === 'complete')) {
      this.completeStepForEvent('craft');
      this.notify('Your vampire vassals completed a Simple Sword.');
    }
    saveSettings(this.state.settings);
    await this.autoSave('slot-1');
    this.renderGame();
  }

  private completeStepForEvent(stepId: string): void {
    if (!this.state) {
      return;
    }
    this.state.quests = completeQuestStep(this.state.quests, 'awakening', stepId);
  }

  private async autoSave(slotId: string): Promise<void> {
    if (!this.state) {
      return;
    }
    await saveToSlot(slotId, this.state);
  }

  private notify(message: string): void {
    this.toastManager?.show(message);
  }

  private showError(error: unknown, fallback: string): void {
    const message = error instanceof Error ? error.message : fallback;
    this.notify(message || fallback);
    console.error(error);
  }

  private query<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element: ${selector}`);
    }
    return element;
  }
}

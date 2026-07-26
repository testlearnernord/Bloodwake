import Phaser from 'phaser';
import { DRAIN_ESSENCE_GAIN, FEED_VITAE_GAIN, TURN_COST_VITAE } from '../config/balancing';
import { COLLECTIBLES_BY_ID } from '../data/collectibles';
import { ITEMS_BY_ID } from '../data/items';
import { createNewGameState, deriveCharacterSeed, getActiveQuestStepText, getHumanById } from './state';
import { queueCraftingOrder } from '../simulation/crafting/crafting';
import { inheritVampire } from '../simulation/bloodlines/inheritance';
import { queueRoomConstruction } from '../simulation/building/building';
import { completeQuestStep } from '../simulation/quests/quests';
import { applyDayRestriction, togglePhase } from '../simulation/time/dayNight';
import { runWorkShift } from '../simulation/servants/production';
import { saveSettings } from '../persistence/settings';
import { deleteSlot, exportSaveGame, importSaveGame, listSaveSlots, loadFromSlot, saveToSlot } from '../persistence/saveStore';
import type { ItemCategory, ItemId, JobPriority, RoomId, SaveGame, SaveSlot, Servant } from '../types/models';
import { createDefaultSeed } from '../utilities/rng';
import type { GameBridge } from '../game/bridge';
import { WorldScene } from '../game/scenes/WorldScene';
import { getTraitById } from '../simulation/traits/traitUtils';
import { addItem, canEquipItem, equipItem, mergeCompatibleStacks, unequipItem } from '../simulation/inventory/inventory';
import { calculatePlayerCombatStats, useHealingDraught } from '../simulation/combat/stats';
import { renderBottomHud } from '../ui/hud/hud';
import { renderOverlay } from '../ui/overlays/overlays';
import { ToastManager } from '../ui/notifications/toasts';
import { renderGameShell, renderTitleScreen as renderTitleLayout } from '../ui/shell/layout';
import { TOPBAR_RESOURCES, renderTopBar } from '../ui/topbar/topbar';
import { TooltipManager } from '../ui/tooltips/tooltips';
import { isTypingTarget, type MenuId } from '../ui/uiState';

const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'];

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
  private dodgeReadyAt = 0;
  private toastManager: ToastManager | null = null;
  private tooltipManager: TooltipManager | null = null;
  private previousResourceSnapshot: Record<string, number> | null = null;

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
    this.root.innerHTML = renderGameShell();
    this.toastManager = new ToastManager(this.query('#toast-root'));
    this.tooltipManager = new TooltipManager(this.root);
    this.tooltipManager.install();
    this.installGlobalShortcuts();
    this.mountPhaser();
    this.previousResourceSnapshot = null;
    this.renderGame();
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
      isInputBlocked: () => this.activeMenu !== null,
      onHumanFocused: (humanId) => {
        this.focusedHumanId = humanId;
        this.renderGame();
      },
      onFeedShortcut: (humanId) => {
        void this.feedHuman(humanId, 'feed');
      },
      onCollectItem: (itemId, amount) => {
        if (!this.state) return;
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
        this.state.player.memoryFragments.push(collectibleId);
        this.state.lastEventLog.unshift(`Recovered ${collectible.name}.`);
        this.completeStepForEvent('memory');
        void this.autoSave('slot-1');
        this.notify('Memory recovered.');
        this.renderGame();
      },
      onEnemyDefeated: (enemyId) => {
        if (!this.state) return;
        this.state.strategicResources.bloodEssence += 1;
        this.state.lastEventLog.unshift(`Defeated a ${enemyId} and harvested Blood Essence.`);
        this.notify('Blood Essence increased.');
        this.renderGame();
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
        this.renderGame();
      },
      onRespawn: () => {
        if (!this.state) return;
        this.state.player.health = this.state.player.maxHealth;
        this.state.player.vitae = Math.max(2, this.state.player.vitae);
        this.state.lastEventLog.unshift('You collapse and reform beside the coffin.');
        this.notify('You reformed at the coffin.');
        this.renderGame();
      },
      onPauseRequested: () => {
        this.openOrCloseMenu(this.activeMenu === 'pause' ? null : 'pause');
      },
      onDodgeUsed: (nextReadyAt) => {
        this.dodgeReadyAt = nextReadyAt;
        this.renderGame();
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
    this.query('#bottom-hud').innerHTML = renderBottomHud(this.state, 'Unarmed', this.dodgeReadyAt <= Date.now());

    const contextPanel = this.query('#context-panel');
    const human = this.focusedHumanId ? getHumanById(this.state, this.focusedHumanId) : null;
    if (human) {
      contextPanel.classList.remove('hidden');
      contextPanel.innerHTML = `
        <h3>${human.name} ${human.familyName}</h3>
        <p>${human.professionId} · blood quality ${human.bloodQuality}</p>
        <p>Traits: ${human.traitIds.join(', ') || 'none'}</p>
        <div class="button-row compact">
          <button data-human-action="feed">Feed</button>
          <button data-human-action="drain">Drain</button>
          <button data-human-action="turn">Turn</button>
        </div>
        <p class="hint">F to feed, open overlays with C I V B K J.</p>
      `;
    } else {
      contextPanel.classList.add('hidden');
      contextPanel.innerHTML = '';
    }

    const overlayRoot = this.query('#overlay-root');
    if (this.activeMenu) {
      overlayRoot.classList.remove('hidden');
      overlayRoot.innerHTML = renderOverlay(this.activeMenu, this.state, this.selectedItemId, this.selectedFilter);
      this.phaserGame?.scene.pause('world');
      const closeButton = overlayRoot.querySelector<HTMLButtonElement>('[data-close-overlay]');
      closeButton?.focus();
    } else {
      overlayRoot.classList.add('hidden');
      overlayRoot.innerHTML = '';
      this.phaserGame?.scene.resume('world');
    }

    this.bindGameActions();
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
          await this.feedHuman(this.focusedHumanId, button.dataset.humanAction as 'feed' | 'drain' | 'turn');
        }
      };
    }

    for (const select of this.root.querySelectorAll<HTMLSelectElement>('select[data-servant-id]')) {
      select.onchange = () => {
        if (!this.state) return;
        const servantId = select.dataset.servantId;
        const jobType = select.dataset.jobType as keyof Servant['priorities'];
        this.state.servants = this.state.servants.map((servant) =>
          servant.id === servantId
            ? { ...servant, priorities: { ...servant.priorities, [jobType]: select.value as JobPriority } }
            : servant,
        );
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
        try {
          const result = queueRoomConstruction(
            this.state.rooms,
            this.state.inventory,
            this.state.strategicResources,
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
        this.state.craftingQueue = queueCraftingOrder(this.state.craftingQueue, button.dataset.recipeId ?? '');
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
  }

  private installGlobalShortcuts(): void {
    window.onkeydown = (event: KeyboardEvent) => {
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

  private openOrCloseMenu(menu: MenuId | null): void {
    this.activeMenu = menu;
    this.renderGame();
  }

  private async advancePhase(): Promise<void> {
    if (!this.state) {
      return;
    }
    const nextPhase = togglePhase(this.state.time.phase);
    if (nextPhase === 'day') {
      this.state.player = applyDayRestriction(this.state.player, nextPhase);
    }
    this.state.time = {
      day: nextPhase === 'night' ? this.state.time.day + 1 : this.state.time.day,
      phase: nextPhase,
    };
    const shift = runWorkShift(
      this.state.servants,
      this.state.rooms,
      this.state.craftingQueue,
      this.state.strategicResources,
      this.state.inventory,
      nextPhase,
      this.state.seed,
    );
    this.state.servants = shift.servants;
    this.state.rooms = shift.rooms;
    this.state.strategicResources = shift.strategicResources;
    this.state.inventory = shift.inventory;
    this.state.craftingQueue = shift.craftingQueue;
    this.state.lastEventLog = [...shift.log.reverse(), ...this.state.lastEventLog].slice(0, 12);
    saveSettings(this.state.settings);
    await this.autoSave('slot-1');
    this.renderGame();
  }

  private async feedHuman(humanId: string, mode: 'feed' | 'drain' | 'turn'): Promise<void> {
    if (!this.state) {
      return;
    }
    const human = getHumanById(this.state, humanId);
    if (!human) {
      return;
    }
    if (mode === 'turn' && this.state.player.vitae < TURN_COST_VITAE) {
      this.notify('Turning requires more Vitae.');
      return;
    }
    if (mode === 'feed') {
      this.state.player.vitae = Math.min(this.state.player.maxVitae, this.state.player.vitae + FEED_VITAE_GAIN);
      this.state.npcs = this.state.npcs.map((npc) => (npc.id === humanId ? { ...npc, status: 'fed' } : npc));
      this.completeStepForEvent('feed');
      this.state.lastEventLog.unshift(`Fed on ${human.name} and left them alive.`);
      this.notify('Vitae restored by feeding.');
    }
    if (mode === 'drain') {
      this.state.player.vitae = Math.min(this.state.player.maxVitae, this.state.player.vitae + FEED_VITAE_GAIN);
      this.state.strategicResources.bloodEssence += DRAIN_ESSENCE_GAIN;
      this.state.npcs = this.state.npcs.map((npc) => (npc.id === humanId ? { ...npc, status: 'drained' } : npc));
      this.state.lastEventLog.unshift(`Drained ${human.name} for Blood Essence.`);
      this.notify('Blood Essence increased.');
    }
    if (mode === 'turn') {
      const result = inheritVampire(this.state.player, human, `${this.state.seed}-${this.state.characterRoll}`);
      this.state.player.vitae -= TURN_COST_VITAE;
      this.state.npcs = this.state.npcs.map((npc) => (npc.id === humanId ? { ...npc, status: 'turned' } : npc));
      const servant: Servant = {
        ...result.vampire,
        type: 'vampire',
        priorities: {
          Building: 'Normal',
          Crafting: 'High',
          Gathering: 'Low',
          Guarding: 'Normal',
          Research: 'Low',
          Hunting: 'Low',
        },
        currentJob: null,
        currentTask: null,
        taskReason: 'Newly turned and awaiting direction.',
        hunger: result.vampire.hunger,
        equipped: {},
      };
      this.state.servants = [...this.state.servants, servant];
      this.state.inheritanceHistory = [result.report, ...this.state.inheritanceHistory];
      this.completeStepForEvent('turn');
      this.state.lastEventLog.unshift(`Turned ${human.name} into a fledgling vampire.`);
      this.notify('A new vampire servant has joined your bloodline.');
    }
    this.focusedHumanId = null;
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

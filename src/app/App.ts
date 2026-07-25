import Phaser from 'phaser';
import { DRAIN_ESSENCE_GAIN, FEED_VITAE_GAIN, TURN_COST_VITAE } from '../config/balancing';
import { GAME_TITLE } from '../config/game';
import { COLLECTIBLES_BY_ID } from '../data/collectibles';
import { ITEMS_BY_ID } from '../data/items';
import { QUESTS_BY_ID } from '../data/quests';
import { RECIPES, RECIPES_BY_ID } from '../data/recipes';
import { ROOMS } from '../data/rooms';
import { createNewGameState, getActiveQuestStepText, getHumanById } from './state';
import { queueCraftingOrder } from '../simulation/crafting/crafting';
import { inheritVampire } from '../simulation/bloodlines/inheritance';
import { queueRoomConstruction } from '../simulation/building/building';
import { completeQuestStep } from '../simulation/quests/quests';
import { applyDayRestriction, togglePhase } from '../simulation/time/dayNight';
import { runWorkShift } from '../simulation/servants/production';
import { saveSettings } from '../persistence/settings';
import { deleteSlot, exportSaveGame, importSaveGame, listSaveSlots, loadFromSlot, saveToSlot } from '../persistence/saveStore';
import type { JobPriority, RoomId, SaveGame, SaveSlot, Servant } from '../types/models';
import { createDefaultSeed } from '../utilities/rng';
import type { GameBridge } from '../game/bridge';
import { WorldScene } from '../game/scenes/WorldScene';
import { getTraitById } from '../simulation/traits/traitUtils';

const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'];
const PRIORITIES: JobPriority[] = ['Disabled', 'Low', 'Normal', 'High', 'Critical'];

export class BloodwakeApp {
  private readonly root: HTMLElement;
  private state: SaveGame | null = null;
  private phaserGame: Phaser.Game | null = null;
  private focusedHumanId: string | null = null;
  private selectedRoomId: RoomId = 'workshop';
  private activeZone = 'Ruined Stronghold';
  private pauseVisible = false;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    await this.renderTitleScreen();
  }

  private async renderTitleScreen(): Promise<void> {
    const previewSeed = createDefaultSeed();
    const preview = createNewGameState({ seed: previewSeed });
    const slots = await listSaveSlots();
    this.root.innerHTML = `
      <main class="title-screen">
        <section class="panel hero-panel">
          <h1>${GAME_TITLE}</h1>
          <p class="subtitle">A free, static browser-based vampire action RPG vertical slice built for GitHub Pages.</p>
          <div class="control-list">
            <span>Controls: WASD move, mouse attacks, Space dodge, E interact, F feed, Tab menu, Escape pause</span>
          </div>
        </section>
        <section class="panel generator-panel">
          <h2>New Game Generation</h2>
          <label>Player name <input id="player-name" type="text" placeholder="The Forgotten Lord" /></label>
          <label>World seed <input id="world-seed" type="text" value="${preview.seed}" /></label>
          <div class="button-row">
            <button id="randomize-seed">Randomize</button>
            <button id="reroll-vampire">Reroll</button>
            <button id="start-game">Start Game</button>
          </div>
          <div id="preview-panel"></div>
        </section>
        <section class="panel saves-panel">
          <h2>Save Slots</h2>
          <div id="save-slot-list">${this.renderSaveSlots(slots)}</div>
          <label>Import save JSON<textarea id="import-json" rows="6" placeholder="Paste exported save JSON here"></textarea></label>
          <button id="import-save">Import Save Into Slot 1</button>
        </section>
      </main>
    `;
    const nameInput = this.query<HTMLInputElement>('#player-name');
    const seedInput = this.query<HTMLInputElement>('#world-seed');
    const previewPanel = this.query<HTMLDivElement>('#preview-panel');
    previewPanel.replaceChildren(this.createPreviewContent(preview));
    const refreshPreview = (): void => {
      const state = createNewGameState({ playerName: nameInput.value, seed: seedInput.value || createDefaultSeed() });
      previewPanel.replaceChildren(this.createPreviewContent(state));
    };
    this.query<HTMLButtonElement>('#randomize-seed').onclick = () => {
      seedInput.value = createDefaultSeed();
      refreshPreview();
    };
    this.query<HTMLButtonElement>('#reroll-vampire').onclick = () => {
      refreshPreview();
    };
    seedInput.onchange = refreshPreview;
    nameInput.onchange = refreshPreview;
    this.query<HTMLButtonElement>('#start-game').onclick = async () => {
      this.state = createNewGameState({ playerName: nameInput.value, seed: seedInput.value });
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
      const raw = this.query<HTMLTextAreaElement>('#import-json').value;
      const imported = importSaveGame(raw);
      await saveToSlot(SLOT_IDS[0], imported);
      await this.renderTitleScreen();
    };
  }

  private async startGameShell(): Promise<void> {
    if (!this.state) {
      return;
    }
    this.root.innerHTML = `
      <main class="game-shell">
        <section class="hud panel">
          <div class="hud-row">
            <div><strong>${GAME_TITLE}</strong></div>
            <div id="phase-indicator"></div>
            <div id="zone-indicator"></div>
          </div>
          <div id="vitals"></div>
          <div id="quest-step"></div>
          <div class="button-row compact">
            <button id="advance-phase">Advance Phase</button>
            <button id="manual-save">Manual Save</button>
            <button id="toggle-pause">Pause</button>
            <button id="export-save">Export Save</button>
          </div>
          <textarea id="export-output" rows="4" readonly></textarea>
        </section>
        <section class="play-area">
          <div id="phaser-root"></div>
        </section>
        <aside class="sidebar">
          <section class="panel" id="action-panel"></section>
          <section class="panel" id="character-panel"></section>
          <section class="panel" id="inventory-panel"></section>
          <section class="panel" id="servant-panel"></section>
          <section class="panel" id="building-panel"></section>
          <section class="panel" id="crafting-panel"></section>
          <section class="panel" id="quest-panel"></section>
          <section class="panel" id="memory-panel"></section>
          <section class="panel pause-panel hidden" id="pause-panel"></section>
        </aside>
      </main>
    `;
    this.installGlobalShortcuts();
    this.mountPhaser();
    this.renderGame();
    await this.autoSave('slot-1');
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
      onHumanFocused: (humanId) => {
        this.focusedHumanId = humanId;
        this.renderGame();
      },
      onFeedShortcut: (humanId) => {
        void this.feedHuman(humanId, 'feed');
      },
      onCollectResource: (resourceId, amount) => {
        if (!this.state) {
          return;
        }
        this.state.resources[resourceId] = (this.state.resources[resourceId] ?? 0) + amount;
        this.state.lastEventLog.unshift(`Collected ${amount} ${resourceId} in ${this.activeZone}.`);
        this.completeStepForEvent('travel');
        this.renderGame();
      },
      onCollectMemory: (collectibleId) => {
        if (!this.state) {
          return;
        }
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
        this.renderGame();
      },
      onEnemyDefeated: (enemyId) => {
        if (!this.state) {
          return;
        }
        this.state.resources['Blood Essence'] = (this.state.resources['Blood Essence'] ?? 0) + 1;
        this.state.lastEventLog.unshift(`Defeated a ${enemyId} and harvested Blood Essence.`);
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
        if (!this.state) {
          return;
        }
        this.state.player.health = nextHealth;
        this.state.player.vitae = nextVitae;
        this.renderGame();
      },
      onRespawn: () => {
        if (!this.state) {
          return;
        }
        this.state.player.health = this.state.player.maxHealth;
        this.state.player.vitae = Math.max(2, this.state.player.vitae);
        this.state.lastEventLog.unshift('You collapse and reform beside the coffin.');
        this.renderGame();
      },
      onPauseRequested: () => {
        this.pauseVisible = !this.pauseVisible;
        this.renderGame();
      },
    };
    this.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'phaser-root',
      width: 1280,
      height: 720,
      scene: [new WorldScene(bridge)],
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
    this.query('#phase-indicator').textContent = `Day ${this.state.time.day} · ${this.state.time.phase.toUpperCase()}`;
    this.query('#zone-indicator').textContent = this.activeZone;
    this.query('#vitals').innerHTML = `Health ${this.state.player.health}/${this.state.player.maxHealth} · Vitae ${this.state.player.vitae}/${this.state.player.maxVitae} · Blood Essence ${this.state.resources['Blood Essence'] ?? 0} · Hunger ${this.state.player.hunger}`;
    this.query('#quest-step').textContent = `Current objective: ${getActiveQuestStepText(this.state)}`;
    this.query('#action-panel').innerHTML = this.renderActionPanel();
    this.query('#character-panel').innerHTML = this.renderCharacterPanel();
    this.query('#inventory-panel').innerHTML = this.renderInventoryPanel();
    this.query('#servant-panel').innerHTML = this.renderServantPanel();
    this.query('#building-panel').innerHTML = this.renderBuildingPanel();
    this.query('#crafting-panel').innerHTML = this.renderCraftingPanel();
    this.query('#quest-panel').innerHTML = this.renderQuestPanel();
    this.query('#memory-panel').innerHTML = this.renderMemoryPanel();
    const pausePanel = this.query('#pause-panel');
    pausePanel.classList.toggle('hidden', !this.pauseVisible);
    pausePanel.innerHTML = this.renderPausePanel();
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
    summarySeed.textContent = `Seed: ${state.seed}`;
    const summaryProfession = document.createElement('p');
    summaryProfession.textContent = `Starting profession: ${state.player.professionId}`;
    summary.append(summaryTitle, summarySeed, summaryProfession);

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

  private renderActionPanel(): string {
    const human = this.focusedHumanId ? getHumanById(this.state!, this.focusedHumanId) : null;
    const actions = human
      ? `
        <p>Focused human: <strong>${human.name} ${human.familyName}</strong> (${human.professionId})</p>
        <p>Blood quality ${human.bloodQuality} · Traits: ${human.traitIds.join(', ') || 'none'}</p>
        <div class="button-row compact">
          <button data-human-action="feed">Feed and leave alive</button>
          <button data-human-action="drain">Drain completely</button>
          <button data-human-action="turn">Turn into vampire</button>
        </div>
      `
      : '<p>Approach a human in the village and press F or use these commands once one is in range.</p>';
    return `<h2>Action Panel</h2>${actions}`;
  }

  private renderCharacterPanel(): string {
    const traits = this.state!.player.traitIds
      .map((traitId) => {
        const trait = getTraitById(traitId);
        return `<li><strong>${trait.name}</strong> (${trait.rarity}) — ${trait.description}</li>`;
      })
      .join('');
    return `
      <h2>Character Sheet</h2>
      <p>${this.state!.player.name} · Vitae ${this.state!.player.vitae}/${this.state!.player.maxVitae} · Hunger ${this.state!.player.hunger}</p>
      <ul>${Object.entries(this.state!.player.attributes).map(([key, value]) => `<li>${key}: ${value}</li>`).join('')}</ul>
      <details open>
        <summary>Trait Details</summary>
        <ul>${traits || '<li>No traits</li>'}</ul>
      </details>
    `;
  }

  private renderInventoryPanel(): string {
    const equipment = this.state!.player.memoryFragments.length > 0 ? 'Memory codex unlocked' : 'No codex bonuses yet';
    return `
      <h2>Inventory & Equipment</h2>
      <p>${equipment}</p>
      <ul>${this.state!.inventory
        .map((entry) => `<li>${ITEMS_BY_ID[entry.itemId]?.name ?? entry.itemId} × ${entry.quantity}${entry.quality ? ` (${entry.quality})` : ''}</li>`)
        .join('')}</ul>
    `;
  }

  private renderServantPanel(): string {
    const servants = this.state!.servants
      .map(
        (servant) => `
          <article class="servant-card">
            <h3>${servant.name} (${servant.type})</h3>
            <p>${servant.professionId} · morale ${servant.morale} · loyalty ${servant.loyalty} · ambition ${servant.ambition}</p>
            <p>Current task: ${servant.currentTask ?? 'none'} — ${servant.taskReason}</p>
            <div class="priority-grid">
              ${(['Building', 'Crafting', 'Gathering', 'Guarding', 'Research', 'Hunting'] as const)
                .map(
                  (jobType) => `
                    <label>${jobType}
                      <select data-servant-id="${servant.id}" data-job-type="${jobType}">
                        ${PRIORITIES.map((priority) => `<option value="${priority}" ${servant.priorities[jobType] === priority ? 'selected' : ''}>${priority}</option>`).join('')}
                      </select>
                    </label>
                  `,
                )
                .join('')}
            </div>
          </article>
        `,
      )
      .join('');
    return `<h2>Servant Management</h2>${servants}`;
  }

  private renderBuildingPanel(): string {
    const roomCards = ROOMS.filter((room) => room.id !== 'coffin_chamber')
      .map(
        (room) => `
          <button data-room-select="${room.id}" class="${this.selectedRoomId === room.id ? 'selected' : ''}">
            ${room.name} (${Object.entries(room.constructionCost)
              .map(([resourceId, amount]) => `${amount} ${resourceId}`)
              .join(', ')})
          </button>
        `,
      )
      .join('');
    const cells = Array.from({ length: 16 }, (_, index) => {
      const x = index % 4;
      const y = Math.floor(index / 4);
      const room = this.state!.rooms.find((entry) => entry.x === x && entry.y === y);
      return `<button class="grid-cell ${room ? room.status : 'empty'}" data-build-x="${x}" data-build-y="${y}">${room ? room.roomId.replaceAll('_', ' ') : '+'}</button>`;
    }).join('');
    return `
      <h2>Base Building</h2>
      <p>Select a room, then click a grid cell. Invalid placements are rejected.</p>
      <div class="button-list">${roomCards}</div>
      <div class="build-grid">${cells}</div>
      <ul>${this.state!.rooms.map((room) => `<li>${room.roomId} at ${room.x},${room.y} — ${room.status} (${room.progress})</li>`).join('')}</ul>
    `;
  }

  private renderCraftingPanel(): string {
    const queue = this.state!.craftingQueue.map((order) => `<li>${RECIPES_BY_ID[order.recipeId].name} — ${order.status}</li>`).join('');
    return `
      <h2>Crafting</h2>
      <div class="button-list">
        ${RECIPES.map((recipe) => `<button data-recipe-id="${recipe.id}">${recipe.name}</button>`).join('')}
      </div>
      <p>Queue crafting orders once the required room exists. Work resolves when phases advance.</p>
      <ul>${queue || '<li>No crafting orders yet.</li>'}</ul>
    `;
  }

  private renderQuestPanel(): string {
    const quest = QUESTS_BY_ID.awakening;
    const questState = this.state!.quests[0];
    return `
      <h2>Quest Log</h2>
      <ol>
        ${quest.steps
          .map((step) => {
            const done = questState.completedStepIds.includes(step.id);
            const active = questState.activeStepId === step.id;
            return `<li class="${done ? 'complete' : active ? 'active' : ''}">${step.text}</li>`;
          })
          .join('')}
      </ol>
    `;
  }

  private renderMemoryPanel(): string {
    const entries = this.state!.collectibles
      .filter((entry) => entry.discovered)
      .map((entry) => {
        const collectible = COLLECTIBLES_BY_ID[entry.collectibleId];
        return `<li><strong>${collectible.name}</strong> — ${collectible.lore}</li>`;
      })
      .join('');
    return `<h2>Memory Codex</h2><ul>${entries || '<li>No fragments recovered yet.</li>'}</ul><h3>Recent Log</h3><ul>${this.state!.lastEventLog.slice(0, 6).map((line) => `<li>${line}</li>`).join('')}</ul>`;
  }

  private renderPausePanel(): string {
    return `
      <h2>Pause Menu</h2>
      <p>Use manual save, export, or return to the title screen.</p>
      <div class="button-row compact">
        <button id="resume-game">Resume</button>
        <button id="return-title">Return to Title</button>
      </div>
      <p>Save slots are preserved in IndexedDB. Refreshing the page should allow the game to be loaded again.</p>
    `;
  }

  private bindGameActions(): void {
    this.query<HTMLButtonElement>('#advance-phase').onclick = async () => {
      await this.advancePhase();
    };
    this.query<HTMLButtonElement>('#manual-save').onclick = async () => {
      await this.autoSave('slot-1');
    };
    this.query<HTMLButtonElement>('#toggle-pause').onclick = () => {
      this.pauseVisible = !this.pauseVisible;
      this.renderGame();
    };
    this.query<HTMLButtonElement>('#export-save').onclick = () => {
      this.query<HTMLTextAreaElement>('#export-output').value = exportSaveGame(this.state!);
    };
    const resumeButton = this.root.querySelector<HTMLButtonElement>('#resume-game');
    if (resumeButton) {
      resumeButton.onclick = () => {
        this.pauseVisible = false;
        this.renderGame();
      };
    }
    const returnTitleButton = this.root.querySelector<HTMLButtonElement>('#return-title');
    if (returnTitleButton) {
      returnTitleButton.onclick = async () => {
        this.pauseVisible = false;
        await this.renderTitleScreen();
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
        if (!this.state) {
          return;
        }
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
        this.renderGame();
      };
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-build-x]')) {
      button.onclick = async () => {
        if (!this.state) {
          return;
        }
        try {
          const result = queueRoomConstruction(
            this.state.rooms,
            this.state.resources,
            this.selectedRoomId,
            Number(button.dataset.buildX),
            Number(button.dataset.buildY),
          );
          this.state.rooms = result.updatedRooms;
          this.state.resources = result.updatedResources;
          this.state.lastEventLog.unshift(`Construction starts on ${this.selectedRoomId}.`);
          this.completeStepForEvent('build');
          await this.autoSave('slot-1');
          this.renderGame();
        } catch (error) {
          alert(error instanceof Error ? error.message : 'Failed to place room.');
        }
      };
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-recipe-id]')) {
      button.onclick = async () => {
        if (!this.state) {
          return;
        }
        this.state.craftingQueue = queueCraftingOrder(this.state.craftingQueue, button.dataset.recipeId ?? '');
        this.state.lastEventLog.unshift(`Queued ${button.textContent?.trim() ?? 'recipe'}.`);
        await this.autoSave('slot-1');
        this.renderGame();
      };
    }
  }

  private installGlobalShortcuts(): void {
    window.onkeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        this.pauseVisible = !this.pauseVisible;
        this.renderGame();
      }
    };
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
      this.state.resources,
      this.state.inventory,
      nextPhase,
      this.state.seed,
    );
    this.state.servants = shift.servants;
    this.state.rooms = shift.rooms;
    this.state.resources = shift.resources;
    this.state.inventory = shift.inventory;
    this.state.craftingQueue = shift.craftingQueue;
    this.state.lastEventLog = [...shift.log.reverse(), ...this.state.lastEventLog].slice(0, 12);
    if (shift.rooms.some((room) => room.roomId === 'workshop' && room.status === 'built')) {
      this.completeStepForEvent('build');
    }
    if (shift.servants.some((servant) => servant.currentTask && servant.currentTask !== 'idle')) {
      this.completeStepForEvent('assign');
    }
    if (shift.craftingQueue.some((order) => order.recipeId === 'simple_sword' && order.status === 'complete')) {
      this.completeStepForEvent('craft');
    }
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
      alert('Turning requires more Vitae.');
      return;
    }
    if (mode === 'feed') {
      this.state.player.vitae = Math.min(this.state.player.maxVitae, this.state.player.vitae + FEED_VITAE_GAIN);
      this.state.npcs = this.state.npcs.map((npc) => (npc.id === humanId ? { ...npc, status: 'fed' } : npc));
      this.completeStepForEvent('feed');
      this.state.lastEventLog.unshift(`Fed on ${human.name} and left them alive.`);
    }
    if (mode === 'drain') {
      this.state.player.vitae = Math.min(this.state.player.maxVitae, this.state.player.vitae + FEED_VITAE_GAIN);
      this.state.resources['Blood Essence'] = (this.state.resources['Blood Essence'] ?? 0) + DRAIN_ESSENCE_GAIN;
      this.state.npcs = this.state.npcs.map((npc) => (npc.id === humanId ? { ...npc, status: 'drained' } : npc));
      this.state.lastEventLog.unshift(`Drained ${human.name} for Blood Essence.`);
    }
    if (mode === 'turn') {
      const result = inheritVampire(this.state.player, human, this.state.seed);
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
      alert(this.renderInheritanceSummary(result.report));
      this.state.lastEventLog.unshift(`Turned ${human.name} into a fledgling vampire.`);
    }
    this.focusedHumanId = null;
    await this.autoSave('slot-1');
    this.renderGame();
  }

  private renderInheritanceSummary(report: SaveGame['inheritanceHistory'][number]): string {
    return [
      'Inheritance Result',
      `Human traits: ${report.originalHumanTraits.join(', ') || 'none'}`,
      `Sire traits: ${report.sireTraits.join(', ') || 'none'}`,
      `Final traits: ${report.finalTraits.join(', ') || 'none'}`,
      `Inherited: ${report.inheritedTraits.join(', ') || 'none'}`,
      `Retained: ${report.retainedTraits.join(', ') || 'none'}`,
      `Mutations: ${report.mutations.join(', ') || 'none'}`,
      `Removed incompatibilities: ${report.removedIncompatibleTraits.join(', ') || 'none'}`,
    ].join('\n');
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

  private query<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element: ${selector}`);
    }
    return element;
  }
}

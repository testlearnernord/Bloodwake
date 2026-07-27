import { GAME_TITLE } from '../../config/game';

export const renderTitleScreen = (seed: string, characterRoll: number, saveSlotsHtml: string): string => `
  <main class="title-screen app-shell">
    <section class="panel hero-panel">
      <h1>${GAME_TITLE}</h1>
      <p class="subtitle">A browser-only gothic strategy-action RPG with deterministic simulation and static GitHub Pages deployment.</p>
      <p class="hint">No backend, no telemetry, no paid services. Everything runs locally in your browser.</p>
      <h2>Controls</h2>
      <ul>
        <li>WASD move, mouse aim, Ctrl lock-on, mouse wheel cycle targets</li>
        <li>Left Mouse light attack, Right Mouse heavy attack, Q Blood Lance, Space dodge</li>
        <li>E interact, F bite/feed, Escape pause or close overlays, C I V B K J management shortcuts</li>
      </ul>
    </section>
    <section class="panel generator-panel">
      <h2>New Game</h2>
      <label>Player Name <input id="player-name" type="text" placeholder="The Forgotten Lord" /></label>
      <label>World Seed <input id="world-seed" type="text" value="${seed}" /></label>
      <label>Vampire Roll <input id="character-roll" type="number" min="0" step="1" value="${characterRoll}" /></label>
      <div class="button-row">
        <button id="randomize-seed">Randomize World Seed</button>
        <button id="reroll-vampire">Reroll Vampire</button>
        <button id="start-game">Start Game</button>
      </div>
      <div id="preview-panel"></div>
    </section>
    <section class="panel saves-panel">
      <h2>Save Slots</h2>
      <div id="save-slot-list">${saveSlotsHtml}</div>
      <label>Import Save JSON<textarea id="import-json" rows="6" placeholder="Paste exported save JSON here"></textarea></label>
      <button id="import-save">Import Save Into Slot 1</button>
    </section>
  </main>
`;

export const renderGameShell = (): string => `
  <main class="game-app" aria-label="Bloodwake game interface">
    <header id="topbar" class="topbar"></header>
    <section class="game-center">
      <div id="phaser-root" class="phaser-frame" aria-label="Game world"></div>
      <aside id="context-panel" class="context-panel hidden" aria-live="polite"></aside>
    </section>
    <footer id="bottom-hud" class="bottom-hud"></footer>
    <div id="overlay-root" class="overlay-root hidden" role="dialog" aria-modal="true" aria-labelledby="overlay-title"></div>
    <section id="toast-root" class="toast-root" aria-live="polite" aria-atomic="true"></section>
  </main>
`;

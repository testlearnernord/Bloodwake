import './style.css';
import { GAME_TITLE } from './config/game';
import { BloodwakeApp } from './app/App';

const renderFatalError = (message: string): void => {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  root.innerHTML = `
    <main class="fatal-error-screen" role="alert" aria-live="assertive">
      <section class="fatal-error-panel">
        <h1>${GAME_TITLE} failed to start</h1>
        <p>${message}</p>
        <p>Try reloading the page. If this continues, clear browser cache and verify the site build finished correctly.</p>
        <button id="fatal-reload">Reload</button>
      </section>
    </main>
  `;
  const button = root.querySelector<HTMLButtonElement>('#fatal-reload');
  button?.addEventListener('click', () => window.location.reload());
};

const bootstrap = async (): Promise<void> => {
  try {
    const root = document.querySelector<HTMLDivElement>('#app');
    if (!root) {
      throw new Error(`Missing app root for ${GAME_TITLE}.`);
    }
    const app = new BloodwakeApp(root);
    await app.start();
  } catch (error) {
    console.error('Application startup error', error);
    renderFatalError('The game encountered a startup problem before rendering the main interface.');
  }
};

void bootstrap();

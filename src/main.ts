import './style.css';
import { GAME_TITLE } from './config/game';
import { BloodwakeApp } from './app/App';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error(`Missing app root for ${GAME_TITLE}.`);
}

const app = new BloodwakeApp(root);
void app.start();

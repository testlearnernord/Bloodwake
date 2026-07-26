import { DEFAULT_SETTINGS } from '../config/balancing';
import { STORAGE_KEY_SETTINGS } from '../config/game';
import type { SaveGame } from '../types/models';

export type LocalSettings = SaveGame['settings'];

export const loadSettings = (): LocalSettings => {
  const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_SETTINGS.volume,
      uiScale: typeof parsed.uiScale === 'number' ? parsed.uiScale : DEFAULT_SETTINGS.uiScale,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: LocalSettings): void => {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
};

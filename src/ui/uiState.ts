export type MenuId = 'character' | 'inventory' | 'servants' | 'stronghold' | 'crafting' | 'journal' | 'pause';

export const MENU_SHORTCUTS: Record<MenuId, string> = {
  character: 'C',
  inventory: 'I',
  servants: 'V',
  stronghold: 'B',
  crafting: 'K',
  journal: 'J',
  pause: 'Escape',
};

export const MENU_LABELS: Record<MenuId, string> = {
  character: 'Character & Bloodline',
  inventory: 'Inventory & Equipment',
  servants: 'Servants',
  stronghold: 'Stronghold',
  crafting: 'Crafting',
  journal: 'Journal & Memories',
  pause: 'Pause & Settings',
};

export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') return false;
  const candidate = target as { tagName?: string; isContentEditable?: boolean };
  const tag = candidate.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || candidate.isContentEditable === true;
};

export const shouldCaptureGameplayKey = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'target'>,
  gameplayFocused: boolean,
): boolean => {
  if (!gameplayFocused || isTypingTarget(event.target)) {
    return false;
  }
  const key = event.key.toLowerCase();
  if (key === 'tab') {
    return true;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }
  return key === 's' || key === 'p';
};

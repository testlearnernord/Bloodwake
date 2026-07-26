import { describe, expect, it } from 'vitest';
import { isTypingTarget } from '../ui/uiState';

describe('menu shortcut input guards', () => {
  it('detects interactive typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });
});

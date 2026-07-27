import { describe, expect, it } from 'vitest';
import { isTypingTarget, shouldCaptureGameplayKey } from '../ui/uiState';

describe('menu shortcut input guards', () => {
  it('detects interactive typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });

  it('captures browser-conflicting gameplay shortcuts only while gameplay is focused', () => {
    expect(shouldCaptureGameplayKey({ key: 's', ctrlKey: true, metaKey: false, target: { tagName: 'DIV' } as unknown as EventTarget }, true)).toBe(true);
    expect(shouldCaptureGameplayKey({ key: 'p', ctrlKey: false, metaKey: true, target: { tagName: 'DIV' } as unknown as EventTarget }, true)).toBe(true);
    expect(shouldCaptureGameplayKey({ key: 'Tab', ctrlKey: false, metaKey: false, target: { tagName: 'DIV' } as unknown as EventTarget }, true)).toBe(true);
    expect(shouldCaptureGameplayKey({ key: 'Tab', ctrlKey: false, metaKey: false, target: { tagName: 'INPUT' } as unknown as EventTarget }, true)).toBe(false);
    expect(shouldCaptureGameplayKey({ key: 's', ctrlKey: true, metaKey: false, target: { tagName: 'DIV' } as unknown as EventTarget }, false)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { renderOverlay } from '../ui/overlays/overlays';

describe('overlay rendering safety', () => {
  it('escapes dynamic text in overlays', () => {
    const state = createNewGameState({ seed: 'overlay-xss', playerName: '<img src=x onerror=alert(1)>' });
    state.lastEventLog = ['<script>alert(1)</script>'];
    const html = renderOverlay('character', state, null, 'all', 'workshop');
    const journal = renderOverlay('journal', state, null, 'all', 'workshop');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(journal).not.toContain('<script>alert(1)</script>');
    expect(journal).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

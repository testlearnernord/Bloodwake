import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../app/state';
import { applyHumanAction } from '../simulation/combat/bite';
import { BLOOD_DONOR_HOLD_MS, renderBloodDonorConfirmation } from '../ui/confirmations/bloodDonorConfirmation';
import { renderGameShell } from '../ui/shell/layout';

describe('blood donor commitment UI', () => {
  it('renders an in-game irreversible hold confirmation with escaped identity data', () => {
    const state = createNewGameState({ seed: 'donor-confirmation' });
    state.player.vitae = 10;
    const human = state.npcs[0];
    human.name = '<script>alert(1)</script>';
    const enthralled = applyHumanAction(state, human.id, 'enthrall').state;
    const servant = enthralled.humanServants[0];
    const html = renderBloodDonorConfirmation(servant);

    expect(BLOOD_DONOR_HOLD_MS).toBe(900);
    expect(html).toContain('Irreversible commitment');
    expect(html).toContain('Hold to bind permanently');
    expect(html).toContain('This cannot be reversed');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('mounts a dedicated confirmation layer above the normal management overlay', () => {
    const shell = renderGameShell();
    expect(shell).toContain('id="overlay-root"');
    expect(shell).toContain('id="confirmation-root"');
  });
});

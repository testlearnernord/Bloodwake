import { PROFESSIONS_BY_ID } from '../../data/professions';
import { getBloodResonanceLabel } from '../../simulation/blood/bloodResonance';
import type { HumanServant } from '../../types/models';
import { htmlEscape } from '../../utilities/html';

export const BLOOD_DONOR_HOLD_MS = 900;

export const renderBloodDonorConfirmation = (servant: HumanServant): string => {
  const fullName = `${servant.name} ${servant.familyName}`;
  const profession = PROFESSIONS_BY_ID[servant.professionId];
  return `
    <section class="confirmation-card blood-donor-confirmation" aria-labelledby="blood-donor-confirmation-title" aria-describedby="blood-donor-confirmation-warning">
      <div class="confirmation-kicker">Irreversible commitment</div>
      <h2 id="blood-donor-confirmation-title">Bind ${htmlEscape(fullName)} as a Blood Donor?</h2>
      <p id="blood-donor-confirmation-warning" class="confirmation-warning">
        <strong>This cannot be reversed.</strong>
        ${htmlEscape(servant.name)} will leave ordinary labor permanently and remain bound to the Blood Cellar until death.
      </p>
      <dl class="confirmation-facts">
        <div><dt>Profession</dt><dd>${htmlEscape(profession.name)}</dd></div>
        <div><dt>Blood Resonance</dt><dd>${htmlEscape(getBloodResonanceLabel(servant.bloodResonance))} (${servant.bloodResonance})</dd></div>
        <div><dt>Health</dt><dd>${servant.health}/${servant.maxHealth}</dd></div>
      </dl>
      <p class="hint confirmation-consequence">They can never be released, reassigned, elevated, or returned to ordinary work.</p>
      <div class="confirmation-actions">
        <button type="button" data-cancel-blood-donor>Cancel</button>
        <button type="button" class="danger-hold-button" data-confirm-blood-donor-hold aria-pressed="false">
          <span>Hold to bind permanently</span>
          <small>Hold for 1 second</small>
        </button>
      </div>
    </section>
  `;
};

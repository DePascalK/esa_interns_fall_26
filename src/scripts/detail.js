/** Behaviour of the per-internship page. */
import { applyStatuses, statusOf } from './status.js';
import { bindShortlistButtons } from './shortlist.js';
import { readNationality } from './prefs.js';

export function initDetail() {
  applyStatuses(document);
  bindShortlistButtons(document);

  // Return to the list with its filters intact when we came from it.
  const back = document.getElementById('back-link');
  if (back) {
    back.addEventListener('click', (e) => {
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        const listPath = new URL(back.href, location.href).pathname;
        if (ref && ref.origin === location.origin && ref.pathname === listPath && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      } catch {
        /* fall back to the plain link */
      }
    });
  }

  // Personal eligibility hint, if a nationality was chosen on the list page.
  const check = document.getElementById('eligibility-check');
  const nat = readNationality();
  if (check && nat && check.dataset.nat) {
    const ok = check.dataset.nat.split(' ').includes(nat.code);
    check.hidden = false;
    check.dataset.ok = String(ok);
    check.textContent = ok ? `Open to applicants from ${nat.name}.` : `Not open to applicants from ${nat.name}.`;
  }

  // A closed posting keeps its link, but not the prominent "Apply" button.
  const apply = document.querySelector('[data-apply]');
  if (apply && statusOf(apply.dataset.closes).state === 'closed') {
    apply.classList.remove('btn-primary');
    apply.textContent = 'Application closed — view on ESA careers ↗';
  }
}

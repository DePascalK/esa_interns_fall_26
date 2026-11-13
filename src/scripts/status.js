/**
 * Deadline status, computed in the browser when the page is viewed (a static
 * build that said "closes in 5 days" would be wrong the next day).
 */

export const SOON_DAYS = 7;
const DAY = 86400000;

/**
 * @param {string} iso  closing time (UTC ISO string), may be empty
 * @returns {{ state: 'open'|'soon'|'closed'|'unknown', label: string }}
 */
export function statusOf(iso, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return { state: 'unknown', label: '' };
  const ms = t - now;
  if (ms < 0) return { state: 'closed', label: 'Closed' };
  const hours = ms / 3600000;
  if (hours < 24) return { state: 'soon', label: hours < 1 ? 'closes within the hour' : `${Math.floor(hours)} h left` };
  const days = Math.floor(ms / DAY);
  const label = days === 1 ? '1 day left' : `${days} days left`;
  return { state: days < SOON_DAYS ? 'soon' : 'open', label };
}

/** Fill every `.js-status[data-closes]` element under `root`. */
export function applyStatuses(root = document, now = Date.now()) {
  for (const el of root.querySelectorAll('.js-status[data-closes]')) {
    const s = statusOf(el.dataset.closes, now);
    el.dataset.state = s.state;
    const rel = el.querySelector('.status-rel');
    if (rel) rel.textContent = s.label ? ` · ${s.label}` : '';
  }
}

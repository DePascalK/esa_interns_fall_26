/**
 * Shortlist kept in this browser only (localStorage). Every access is
 * wrapped: storage can be unavailable (private mode, blocked cookies), and
 * the shortlist then simply lasts for the page view.
 */

const KEY = 'esa-explorer:shortlist';
const listeners = new Set();
let ids = read();

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch {
    return new Set();
  }
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

function emit() {
  listeners.forEach((fn) => fn(ids));
}

try {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      ids = read();
      emit();
    }
  });
} catch {
  /* not in a browser */
}

export const shortlist = {
  has: (id) => ids.has(String(id)),
  all: () => [...ids],
  get size() {
    return ids.size;
  },
  toggle(id) {
    const k = String(id);
    if (ids.has(k)) ids.delete(k);
    else ids.add(k);
    write();
    emit();
  },
  onChange(fn) {
    listeners.add(fn);
  },
};

function syncButton(btn) {
  const on = shortlist.has(btn.dataset.shortlistToggle);
  btn.setAttribute('aria-pressed', String(on));
  const name = btn.dataset.shortlistName ? `“${btn.dataset.shortlistName}” ` : '';
  btn.setAttribute('aria-label', on ? `Remove ${name}from shortlist` : `Add ${name}to shortlist`);
  btn.title = on ? 'Remove from shortlist' : 'Add to shortlist';
  const text = btn.querySelector('.star-text');
  if (text) text.textContent = on ? 'Shortlisted' : 'Shortlist';
}

/** Wire all `[data-shortlist-toggle]` buttons under `root`. */
export function bindShortlistButtons(root = document) {
  const buttons = [...root.querySelectorAll('[data-shortlist-toggle]')];
  buttons.forEach((btn) => {
    syncButton(btn);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      shortlist.toggle(btn.dataset.shortlistToggle);
    });
  });
  shortlist.onChange(() => buttons.forEach(syncButton));
}

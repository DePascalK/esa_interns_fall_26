/** Per-device preferences (nationality). Storage may be unavailable, so every access is guarded. */

const NAT_KEY = 'esa-explorer:nationality';

/** @returns {{ code: string, name: string } | null} */
export function readNationality() {
  try {
    const v = JSON.parse(localStorage.getItem(NAT_KEY) || 'null');
    return v && typeof v.code === 'string' && v.code ? v : null;
  } catch {
    return null;
  }
}

export function writeNationality(code, name) {
  try {
    if (code) localStorage.setItem(NAT_KEY, JSON.stringify({ code, name: name || code }));
    else localStorage.removeItem(NAT_KEY);
  } catch {
    /* storage unavailable */
  }
}

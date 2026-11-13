/** Escaping and highlighting for text inserted by client scripts. */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex matching whole words that start with one of the (index) terms. */
export function termRegex(terms) {
  const parts = [...new Set((terms || []).map((t) => String(t).toLowerCase()))]
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe);
  if (!parts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})[\\p{L}\\p{N}]*`, 'giu');
}

/** Escape `text` and wrap matches of `re` in <mark>. */
export function highlight(text, re) {
  const s = String(text ?? '');
  if (!re) return escapeHtml(s);
  let out = '';
  let last = 0;
  for (const m of s.matchAll(re)) {
    out += escapeHtml(s.slice(last, m.index)) + `<mark>${escapeHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(s.slice(last));
}

/** A highlighted window of `text` around the first match, or '' when nothing matches. */
export function snippet(text, re, radius = 90) {
  const s = String(text ?? '');
  if (!re) return '';
  re.lastIndex = 0;
  const m = re.exec(s);
  re.lastIndex = 0;
  if (!m) return '';
  let start = Math.max(0, m.index - radius);
  let end = Math.min(s.length, m.index + m[0].length + radius);
  if (start > 0) {
    const space = s.indexOf(' ', start);
    if (space > 0 && space < m.index) start = space + 1;
  }
  if (end < s.length) {
    const space = s.lastIndexOf(' ', end);
    if (space > m.index + m[0].length) end = space;
  }
  return `${start > 0 ? '… ' : ''}${highlight(s.slice(start, end), re)}${end < s.length ? ' …' : ''}`;
}

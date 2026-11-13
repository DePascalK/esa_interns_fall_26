/**
 * Client-side search over the prebuilt MiniSearch index. The index is
 * fetched on first use only, so the list page loads without it.
 */
import MiniSearch from 'minisearch';
import { MINISEARCH_OPTIONS, SEARCH_OPTIONS, FIELD_LABELS, buildQuery } from '../lib/searchConfig.js';
import { escapeHtml, snippet, termRegex } from './format.js';

let indexPromise = null;

export function loadIndex(url) {
  if (!indexPromise) {
    indexPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((json) => MiniSearch.loadJSON(json, { ...MINISEARCH_OPTIONS, searchOptions: SEARCH_OPTIONS }))
      .catch((e) => {
        indexPromise = null; // allow a retry
        throw e;
      });
  }
  return indexPromise;
}

/**
 * @returns {Promise<Map<string, {score:number, terms:string[], fields:Set<string>, tasks:string, requirements:string}> | null>}
 *   null when the query has no searchable words
 */
export async function runSearch(url, q) {
  const query = buildQuery(q);
  if (!query) return null;
  const ms = await loadIndex(url);
  const out = new Map();
  for (const r of ms.search(query)) {
    out.set(String(r.id), {
      score: r.score,
      terms: r.terms,
      fields: new Set(Object.values(r.match).flat()),
      tasks: r.tasks || '',
      requirements: r.requirements || '',
    });
  }
  return out;
}

/** "Where it matched" snippet (escaped HTML) for one result, or null. */
export function snippetHtml(result) {
  if (!result) return null;
  const re = termRegex(result.terms);
  for (const f of ['tasks', 'requirements']) {
    if (result.fields.has(f) && result[f]) {
      const html = snippet(result[f], re);
      if (html) return `<span class="snippet-label">${FIELD_LABELS[f]}:</span> ${html}`;
    }
  }
  const others = [...result.fields].filter((f) => f !== 'title' && f !== 'topic');
  if (others.length) {
    return `<span class="snippet-label">Matched in:</span> ${escapeHtml(others.map((f) => FIELD_LABELS[f] || f).join(', '))}`;
  }
  return null;
}

/** Fallback when the index cannot be loaded: every word must occur in the card text. */
export function textMatch(cardText, q) {
  const hay = cardText.toLowerCase();
  return String(q)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/**
 * Search configuration shared by the build (index creation) and the browser
 * (index loading and querying). Both sides must use identical options.
 * No Node-only imports here: this file is bundled into the client.
 */

export const SEARCH_FIELDS = ['title', 'topic', 'skills', 'disciplines', 'tasks', 'requirements', 'org'];

/** Stored so the browser can show "where it matched" snippets. */
export const STORE_FIELDS = ['tasks', 'requirements'];

export const BOOST = { title: 3, topic: 3, skills: 2, disciplines: 2, tasks: 1, requirements: 1, org: 0.5 };

export const FIELD_LABELS = {
  title: 'Title',
  topic: 'Topic',
  skills: 'Skills',
  disciplines: 'Field',
  tasks: 'Tasks',
  requirements: 'Requirements',
  org: 'Organisation',
};

/** Abbreviation -> expansions. Searching either side finds both. */
export const SYNONYMS = {
  ml: ['machine learning'],
  ai: ['artificial intelligence', 'machine learning'],
  dl: ['deep learning'],
  cv: ['computer vision'],
  llm: ['large language model'],
  nlp: ['natural language processing'],
  rf: ['radio frequency', 'microwave', 'antenna'],
  telecom: ['telecommunication', 'communication system'],
  satcom: ['satellite communication'],
  gnc: ['guidance navigation control', 'attitude control'],
  aocs: ['attitude control', 'gnc'],
  gnss: ['satellite navigation', 'galileo'],
  pnt: ['positioning navigation timing'],
  eo: ['earth observation', 'remote sensing'],
  sar: ['synthetic aperture radar'],
  fpga: ['field programmable gate array', 'vhdl'],
  asic: ['integrated circuit'],
  cad: ['computer aided design'],
  fem: ['finite element'],
  fea: ['finite element'],
  cfd: ['computational fluid dynamics'],
  pa: ['product assurance'],
  qa: ['quality assurance'],
  hr: ['human resources'],
  it: ['information technology', 'software'],
  iod: ['in orbit demonstration'],
  mbse: ['model based systems engineering'],
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'of', 'on', 'or',
  'the', 'this', 'that', 'to', 'will', 'with', 'you', 'your', 'our', 'we', 'within', 'their',
]);

/** Lowercase, drop stop words and possessives, unify -isation/-ization. */
export function processTerm(term) {
  const t = term.toLowerCase().replace(/[’']s$/, '').replace(/isation/g, 'ization');
  if (!t || STOP_WORDS.has(t)) return null;
  return t;
}

export const MINISEARCH_OPTIONS = {
  idField: 'id',
  fields: SEARCH_FIELDS,
  storeFields: STORE_FIELDS,
  processTerm,
};

export const SEARCH_OPTIONS = {
  boost: BOOST,
  combineWith: 'AND',
  prefix: (term) => term.length >= 3,
  fuzzy: (term) => (term.length >= 6 ? 0.15 : false),
};

/**
 * Build a MiniSearch query tree: every word must match (AND); a word with
 * synonyms matches the word OR any of its expansions (each expansion as a
 * phrase-like AND of its words).
 */
export function buildQuery(input) {
  const words = String(input || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);
  const queries = [];
  for (const w of words) {
    if (processTerm(w) === null) continue;
    const syn = SYNONYMS[w];
    if (syn) {
      queries.push({
        combineWith: 'OR',
        queries: [w, ...syn.map((phrase) => ({ combineWith: 'AND', queries: [phrase], prefix: false, fuzzy: false }))],
      });
    } else {
      queries.push(w);
    }
  }
  if (!queries.length) return null;
  return { combineWith: 'AND', queries };
}

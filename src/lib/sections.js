/**
 * Turns a posting's description into structured sections:
 *   [{ heading, kind, blocks: [{ type: 'p', lines: [...] } | { type: 'list', ordered, items: [...] }] }]
 *
 * Primary source is description_html (present in every CSV generation);
 * the `sections` dict column and description_text are fallbacks.
 * Heading detection mirrors the scraper: <h1>-<h6>, plus standalone bold
 * lines that are not inside a headed block (Location, Nationality, ...).
 */
import { parse, NodeType } from 'node-html-parser';
import { SITES, COUNTRIES, countryCode } from './reference.js';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCK_TAGS = new Set([
  'p', 'div', 'table', 'tr', 'td', 'th', 'section', 'article', 'blockquote',
  'dl', 'dt', 'dd', 'hr', 'header', 'footer',
]);
const LIST_TAGS = new Set(['ul', 'ol']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript']);

/** Collapse all whitespace (incl. NBSP) to single spaces. */
export const clean = (s) => String(s ?? '').replace(/[\s ​]+/g, ' ').trim();

const tag = (el) => (el.rawTagName || '').toLowerCase();

/** Text of a node, leaving out nested lists (they are emitted separately). */
function textWithoutLists(node) {
  if (node.nodeType === NodeType.TEXT_NODE) return node.text;
  if (node.nodeType !== NodeType.ELEMENT_NODE) return '';
  const t = tag(node);
  if (LIST_TAGS.has(t) || SKIP_TAGS.has(t)) return ' ';
  if (t === 'br') return ' ';
  const inner = node.childNodes.map(textWithoutLists).join('');
  return BLOCK_TAGS.has(t) || t === 'li' ? ` ${inner} ` : inner;
}

function insideHeadedBlock(el, root) {
  for (let p = el.parentNode; p && p !== root; p = p.parentNode) {
    if (tag(p) === 'div' && p.querySelector('h1, h2, h3, h4, h5, h6')) return true;
  }
  return false;
}

function tokenize(root) {
  const tokens = [];
  const walk = (node) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === NodeType.TEXT_NODE) {
        tokens.push({ k: 'text', text: ch.text });
        continue;
      }
      if (ch.nodeType !== NodeType.ELEMENT_NODE) continue;
      const t = tag(ch);
      if (SKIP_TAGS.has(t)) continue;
      if (HEADING_TAGS.has(t)) {
        tokens.push({ k: 'heading', text: clean(ch.text) });
      } else if (t === 'strong' || t === 'b') {
        tokens.push({ k: insideHeadedBlock(ch, root) ? 'text' : 'bold', text: ch.text });
      } else if (t === 'br') {
        tokens.push({ k: 'br' });
      } else if (LIST_TAGS.has(t)) {
        tokens.push({ k: 'block' });
        for (const li of ch.childNodes) {
          if (li.nodeType !== NodeType.ELEMENT_NODE) continue;
          if (tag(li) !== 'li') {
            walk(li);
            continue;
          }
          tokens.push({ k: 'li', text: clean(textWithoutLists(li)), ordered: t === 'ol' });
          for (const sub of li.querySelectorAll('ul, ol')) {
            // only lists directly nested in this li (not deeper ones, which recurse)
            if (sub.parentNode && sub.parentNode.closest && sub.parentNode.closest('ul, ol') !== ch) continue;
            walk({ childNodes: [sub] });
          }
        }
        tokens.push({ k: 'listend' });
        tokens.push({ k: 'block' });
      } else if (BLOCK_TAGS.has(t) || t === 'li') {
        tokens.push({ k: 'block' });
        walk(ch);
        tokens.push({ k: 'block' });
      } else {
        walk(ch);
      }
    }
  };
  walk(root);
  return tokens;
}

const isBoundary = (tok) => tok.k === 'block' || tok.k === 'br' || tok.k === 'heading' || tok.k === 'li' || tok.k === 'listend';

function standsAlone(tokens, idx, dir) {
  for (let i = idx + dir; i >= 0 && i < tokens.length; i += dir) {
    const tok = tokens[i];
    if (isBoundary(tok)) return true;
    if (clean(tok.text)) return false;
  }
  return true;
}

/** Build blocks from a token run. */
function buildBlocks(tokens) {
  const blocks = [];
  let lines = [];
  let line = '';
  let list = null;

  const endLine = () => {
    const l = clean(line);
    if (l) lines.push(l);
    line = '';
  };
  const endPara = () => {
    endLine();
    if (lines.length) blocks.push({ type: 'p', lines });
    lines = [];
  };

  for (const tok of tokens) {
    switch (tok.k) {
      case 'text':
      case 'bold':
        if (list && clean(tok.text)) list = null;
        line += tok.text;
        break;
      case 'br':
        endLine();
        break;
      case 'block':
        endPara();
        break;
      case 'li':
        endPara();
        if (!tok.text) break;
        if (!list) {
          list = { type: 'list', ordered: !!tok.ordered, items: [] };
          blocks.push(list);
        }
        list.items.push(tok.text);
        break;
      case 'listend':
        endPara();
        list = null;
        break;
      default:
        break;
    }
  }
  endPara();
  return blocks;
}

/**
 * Parse description_html into ordered sections.
 * @returns {{ heading: string, blocks: any[] }[]}
 */
export function parseHtmlSections(html) {
  if (!html || !html.trim()) return [];
  const doc = parse(html, { comment: false });
  const root = doc.querySelector('.jobdescription') || doc;
  const tokens = tokenize(root);

  const sections = [];
  let current = { heading: '', tokens: [] };
  const flush = () => {
    const blocks = buildBlocks(current.tokens);
    if (blocks.length || current.heading) sections.push({ heading: current.heading, blocks });
  };

  tokens.forEach((tok, idx) => {
    const text = tok.text !== undefined ? clean(tok.text) : '';
    const isHeading =
      (tok.k === 'heading' && text) ||
      (tok.k === 'bold' && text && text.length <= 80 && standsAlone(tokens, idx, -1) && standsAlone(tokens, idx, +1));
    if (isHeading) {
      flush();
      current = { heading: text.replace(/:\s*$/, '').trim(), tokens: [] };
    } else {
      current.tokens.push(tok);
    }
  });
  flush();

  // Unnamed leading content, and de-duplicated headings, as the scraper does.
  const seen = new Map();
  return sections
    .map((s) => ({ ...s, heading: s.heading || 'Intro' }))
    .filter((s) => !(s.heading === 'Intro' && s.blocks.length === 0))
    .map((s) => {
      const n = seen.get(s.heading) || 0;
      seen.set(s.heading, n + 1);
      return n ? { ...s, heading: `${s.heading} (${n + 1})` } : s;
    });
}

/**
 * Fallback when there is no HTML: the `sections` dict column (one flat string
 * per heading). List items are recovered from the bullets column where they
 * occur verbatim in a section.
 */
export function sectionsFromDict(dict, bullets = []) {
  return Object.entries(dict || {}).map(([heading, body]) => {
    let text = clean(body);
    const items = bullets.map(clean).filter((b) => b && text.includes(b));
    const blocks = [];
    if (items.length) {
      const firstPos = text.indexOf(items[0]);
      const lead = clean(text.slice(0, firstPos));
      if (lead) blocks.push({ type: 'p', lines: [lead] });
      blocks.push({ type: 'list', ordered: false, items });
      const last = items[items.length - 1];
      const tail = clean(text.slice(text.lastIndexOf(last) + last.length));
      if (tail) blocks.push({ type: 'p', lines: [tail] });
    } else if (text) {
      blocks.push({ type: 'p', lines: [text] });
    }
    return { heading: clean(heading), blocks };
  });
}

/** Flatten blocks to one string (same shape as the `sections` column). */
export function flattenBlocks(blocks) {
  return clean(
    (blocks || [])
      .map((b) => (b.type === 'list' ? b.items.join(' ') : b.lines.join(' ')))
      .join(' '),
  );
}

/** Section kinds, matched on the heading. Order matters. */
const KIND_RULES = [
  ['location', /^location\b/i],
  ['team', /team and mission|our team|^the team|^about (the|us)/i],
  ['field', /field\(?s?\)? of activit|fields? of activit|^tasks|^the internship|^topic/i],
  ['competencies', /competenc/i],
  ['education', /^education|^qualification/i],
  ['requirements', /requirement|^skills|profile|^you should/i],
  ['diversity', /diversity|equity|inclusiv/i],
  ['disclaimer', /important information|disclaimer/i],
  ['nationality', /nationalit|eligib/i],
];

export function sectionKind(heading) {
  const hit = KIND_RULES.find(([, re]) => re.test(heading || ''));
  return hit ? hit[0] : 'other';
}

/**
 * "Intern in the Science Operations Department - Topic" ->
 *   { department: 'Science Operations Department', rest: 'Topic' }
 * 2025 titles use ", " instead of " - ".
 */
export function splitTitle(title) {
  const t = clean(title);
  const body = t.replace(/^(?:intern(?:ship)?|trainee(?:ship)?)\s+(?:in|at|for|with)\s+(?:the\s+)?/i, '');
  const m = /^(.+?)(?:\s+[-–—]\s+|,\s+)(.+)$/.exec(body);
  if (!m) return { department: body !== t ? body : '', rest: '' };
  return { department: m[1].trim(), rest: m[2].trim() };
}

const TOPIC_RE = /^(?:the\s+)?topic(?:s)?\s+of\s+(?:the\s+|this\s+)?internship\s*(?:is)?\s*[:\-–]\s*(.+)$/i;

/**
 * Pull "Topic of the internship: X" out of the field-of-activity blocks.
 * Returns { topic, blocks } with the topic line removed from the blocks.
 */
export function extractTopic(blocks) {
  const out = [];
  let topic = '';
  for (const b of blocks || []) {
    if (!topic && b.type === 'p') {
      const idx = b.lines.findIndex((l) => TOPIC_RE.test(l));
      if (idx >= 0) {
        topic = TOPIC_RE.exec(b.lines[idx])[1].replace(/[.\s]+$/, '').trim();
        const lines = b.lines.filter((_, i) => i !== idx);
        if (lines.length) out.push({ ...b, lines });
        continue;
      }
    }
    out.push(b);
  }
  return { topic, blocks: out };
}

/** First sentence(s) of the blocks, cut at a word boundary. */
export function summarize(blocks, max = 260) {
  const first = (blocks || []).find((b) => b.type === 'p');
  const text = first ? first.lines.join(' ') : flattenBlocks(blocks);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf('. ');
  if (sentenceEnd > max * 0.55) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/**
 * Site from the Location section ("ESTEC, Noordwijk, Netherlands") or the
 * Workplace column ("Noordwijk, NL").
 */
export function extractSite(locationBlocks, workplace) {
  const lines = (locationBlocks || []).flatMap((b) => (b.type === 'p' ? b.lines : b.items));
  const locationLine = lines[0] || '';
  const note = clean(lines.slice(1).join(' '));
  const hay = [locationLine, workplace || ''];
  for (const text of hay) {
    const site = SITES.find((s) => s.match.some((re) => re.test(text)));
    if (site) return { ...siteInfo(site), locationLine, note };
  }
  const wp = clean(workplace);
  const [city = wp, country = ''] = wp.split(/,\s*/);
  return {
    id: city ? city.toUpperCase().replace(/[^A-Z0-9]+/g, '-') : 'UNKNOWN',
    name: city || 'Unknown',
    city: city || '',
    country,
    label: wp || 'Unknown location',
    locationLine,
    note,
  };
}

function siteInfo(site) {
  return {
    id: site.id,
    name: site.name,
    city: site.city,
    country: site.country,
    label: site.name === site.city ? `${site.city}, ${site.country}` : `${site.name} · ${site.city}, ${site.country}`,
  };
}

/**
 * Eligible states from the Nationality section text, as ISO codes in
 * document order. Port of the scraper's parse_nationalities.
 */
export function parseNationalities(text) {
  const t = clean(text);
  if (!t) return [];
  const codes = [];
  const add = (code) => {
    if (code && !codes.includes(code)) codes.push(code);
  };
  let rest = t;
  const m = /following\s+(?:member\s+)?states?\s*:\s*(.+?)(?:\.\s|\.$|$)/i.exec(t);
  if (m) {
    for (const part of m[1].split(/,|\band\b/)) add(countryCode(part.replace(/^\s*the\s+/i, '').replace(/[.;\s]+$/, '')));
    rest = t.slice(m.index + m[0].length);
  }
  const hits = [];
  for (const c of COUNTRIES) {
    const mm = c.pattern.exec(rest);
    if (mm && !codes.includes(c.code)) hits.push([mm.index, c.code]);
  }
  hits.sort((a, b) => a[0] - b[0]).forEach(([, code]) => add(code));
  return codes;
}

/** Normalised form of a sentence or list item, for boilerplate comparison. */
export const normUnit = (s) => clean(s).toLowerCase().replace(/[“”"'’]/g, '').replace(/[\s.;:,!]+$/, '');

/** Split a paragraph line into sentences (keeps abbreviations like "e.g." intact). */
export function sentences(line) {
  return clean(line)
    .split(/(?<=[.!?])\s+(?=[A-Z(“"])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

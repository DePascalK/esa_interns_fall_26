/**
 * Applies taxonomy.js to a normalised job. Every tag records the keywords
 * that triggered it, so the site can show why a posting was tagged.
 */
import {
  DISCIPLINES, SKILLS, FIELD_WEIGHTS, ASSIGN_THRESHOLD, MAX_HITS_PER_FIELD, OTHER_DISCIPLINE,
} from './taxonomy.js';

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compile a taxonomy keyword into a RegExp (see the rules in taxonomy.js). */
export function keywordRegex(kw) {
  if (kw instanceof RegExp) return kw;
  const stem = kw.endsWith('*');
  const word = stem ? kw.slice(0, -1) : kw;
  const acronym = /^[A-Z0-9+\-/ ]+$/.test(word) && /[A-Z]{2,}/.test(word);
  let body = escapeRe(word).replace(/ /g, '[\\s\\-]+');
  if (!stem && !acronym && /[a-z]$/i.test(word)) body += '(?:e?s)?';
  const start = /^\w/.test(word) ? '\\b' : '(?<![\\w])';
  let end = '';
  if (!stem) end = /\w$/.test(word) ? '\\b' : '(?![\\w])';
  return new RegExp(start + body + end, acronym ? '' : 'i');
}

const COMPILED = DISCIPLINES.map((d) => ({
  ...d,
  res: d.keywords.map((kw) => ({ kw: kw instanceof RegExp ? kw.source : kw, re: keywordRegex(kw) })),
}));

/**
 * @param {{ title: string, topic: string, tasks: string, requirements: string, directorate: string }} text
 * @returns {{ disciplines: {id,label,technical,score,keywords}[], focus: string, techScore: number, skills: string[] }}
 */
export function classify(text) {
  const scored = COMPILED.map((d) => {
    let score = 0;
    const keywords = new Set();
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      const hay = text[field] || '';
      if (!hay) continue;
      const hits = d.res.filter(({ re }) => re.test(hay));
      hits.forEach(({ kw }) => keywords.add(kw));
      score += weight * Math.min(MAX_HITS_PER_FIELD, hits.length);
    }
    if (score > 0 && d.directorates.some((re) => re.test(text.directorate || ''))) score += 1;
    return { id: d.id, label: d.label, technical: d.technical, score, keywords: [...keywords] };
  });

  let disciplines = scored.filter((d) => d.score >= ASSIGN_THRESHOLD).sort((a, b) => b.score - a.score);
  if (!disciplines.length) {
    const best = scored.filter((d) => d.score > 0).sort((a, b) => b.score - a.score)[0];
    disciplines = best ? [best] : [{ ...OTHER_DISCIPLINE, score: 0, keywords: [] }];
  }

  const techScore = disciplines.filter((d) => d.technical).reduce((s, d) => s + d.score, 0);
  const nonScore = disciplines.filter((d) => !d.technical).reduce((s, d) => s + d.score, 0);
  let focus;
  if (techScore === 0) focus = 'non-technical';
  else if (nonScore === 0) focus = 'technical';
  else {
    const share = techScore / (techScore + nonScore);
    focus = share >= 0.65 ? 'technical' : share <= 0.35 ? 'non-technical' : 'mixed';
  }

  const skillText = [text.topic, text.tasks, text.requirements].join(' \n ');
  const skills = SKILLS.filter((s) => s.match.some((re) => re.test(skillText))).map((s) => s.label);

  return { disciplines, focus, techScore, skills };
}

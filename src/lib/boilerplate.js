/**
 * Separates text that is common to (nearly) all postings from what is
 * specific to one posting. Works across the whole dataset: a sentence or
 * list item that appears in many postings is boilerplate; known standard
 * sentences are also caught when the dataset is too small for statistics.
 */
import { clean, flattenBlocks, normUnit, sentences } from './sections.js';

/** Standard sentences of the "Additional requirements" section. */
const KNOWN_REQUIREMENT_BOILERPLATE = [
  /working languages of the agency are english and french/i,
  /good knowledge of one of these is required/i,
  /knowledge of another (esa )?member state language is an asset/i,
  /during the interview,? your motivation/i,
  /motivation for applying to this role will be explored/i,
];

/** Standard sentences of the "Important information and disclaimer" section. */
const KNOWN_DISCLAIMER_BOILERPLATE = [
  /may request applicants to undergo selection tests/i,
  /information published on esa.?s careers website/i,
  /correct at the time of publication/i,
  /not intended to be exhaustive/i,
];

/** Job-specific conditions that must never be hidden as boilerplate, however often they occur. */
const NEVER_BOILERPLATE = /export control|sanction|security clearance|driving licen[cs]e/i;

/** Minimum dataset size before frequency-based detection is trusted. */
const MIN_JOBS_FOR_STATS = 8;
const BOILERPLATE_SHARE = 0.4;

/** Units (list items and sentences) of a block list, with their origin. */
function units(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (b.type === 'list') b.items.forEach((t) => out.push(t));
    else b.lines.forEach((l) => sentences(l).forEach((s) => out.push(s)));
  }
  return out;
}

/** Remove units for which `drop(unit)` is true; keeps block structure. */
function filterBlocks(blocks, drop) {
  const out = [];
  for (const b of blocks || []) {
    if (b.type === 'list') {
      const items = b.items.filter((t) => !drop(t));
      if (items.length) out.push({ ...b, items });
    } else {
      const lines = b.lines
        .map((l) => sentences(l).filter((s) => !drop(s)).join(' '))
        .filter((l) => clean(l));
      if (lines.length) out.push({ ...b, lines });
    }
  }
  // A lead-in such as "You should also have:" is useless without its list.
  if (out.length && out[out.length - 1].type === 'p') {
    const last = out[out.length - 1];
    const lastLine = last.lines[last.lines.length - 1];
    if (/:\s*$/.test(lastLine)) {
      last.lines = last.lines.slice(0, -1);
      if (!last.lines.length) out.pop();
    }
  }
  return out;
}

function mode(values) {
  const counts = new Map();
  let best = null;
  let bestCount = 0;
  for (const v of values) {
    if (!v) continue;
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return { value: best, count: bestCount };
}

/** Counts in how many jobs each normalised unit occurs. */
function unitFrequency(blockLists) {
  const freq = new Map();
  const original = new Map();
  for (const blocks of blockLists) {
    const seen = new Set();
    for (const u of units(blocks)) {
      const key = normUnit(u);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      freq.set(key, (freq.get(key) || 0) + 1);
      if (!original.has(key)) original.set(key, u);
    }
  }
  return { freq, original };
}

/**
 * Dataset-wide analysis.
 * @param {Array} jobs  objects with `sec` (kind -> blocks), `competencyList`, `nationalities`, `contactEmails`
 */
export function analyzeCommon(jobs) {
  const n = jobs.length;
  const useStats = n >= MIN_JOBS_FOR_STATS;
  const isFrequent = (freq) => useStats && freq / n >= BOILERPLATE_SHARE;
  const eligible = ([key]) => !NEVER_BOILERPLATE.test(key);

  const req = unitFrequency(jobs.map((j) => j.sec.requirements));
  const requirementBoilerplate = new Set(
    [...req.freq.entries()]
      .filter(eligible)
      .filter(([key, f]) => isFrequent(f) || KNOWN_REQUIREMENT_BOILERPLATE.some((re) => re.test(key)))
      .map(([key]) => key),
  );

  const disc = unitFrequency(jobs.map((j) => j.sec.disclaimer));
  const disclaimerBoilerplate = new Set(
    [...disc.freq.entries()]
      .filter(eligible)
      .filter(([key, f]) => isFrequent(f) || KNOWN_DISCLAIMER_BOILERPLATE.some((re) => re.test(key)))
      .map(([key]) => key),
  );

  const education = mode(jobs.map((j) => normUnit(flattenBlocks(j.sec.education))));
  const educationText = jobs.find((j) => normUnit(flattenBlocks(j.sec.education)) === education.value);

  const comp = mode(jobs.map((j) => j.competencyList.join('|')));
  const nat = mode(jobs.map((j) => [...j.nationalities].sort().join(',')));
  const natOrder = jobs.find((j) => [...j.nationalities].sort().join(',') === nat.value);
  const email = mode(jobs.flatMap((j) => j.contactEmails));
  const diversity = mode(jobs.map((j) => normUnit(flattenBlocks(j.sec.diversity))));
  const diversityJob = jobs.find((j) => normUnit(flattenBlocks(j.sec.diversity)) === diversity.value);

  const pickOriginals = (freqInfo, set) =>
    [...set]
      .map((key) => ({ key, text: freqInfo.original.get(key), count: freqInfo.freq.get(key) || 0 }))
      .filter((u) => u.text)
      .sort((a, b) => b.count - a.count)
      .map((u) => u.text);

  return {
    jobCount: n,
    requirementBoilerplate,
    disclaimerBoilerplate,
    educationKey: education.value,
    common: {
      requirements: pickOriginals(req, requirementBoilerplate),
      disclaimer: pickOriginals(disc, disclaimerBoilerplate),
      education: educationText ? educationText.sec.education : [],
      competencies: comp.value ? comp.value.split('|') : [],
      nationalities: natOrder ? natOrder.nationalities : [],
      contactEmail: email.value || '',
      diversity: diversityJob ? diversityJob.sec.diversity : [],
    },
  };
}

/**
 * Per-job view after removing boilerplate.
 * @returns {{ requirements, educationDeviates, disclaimerNotes, competenciesDeviate, nationality }}
 */
export function applyCommon(job, analysis) {
  const requirements = filterBlocks(job.sec.requirements, (u) => analysis.requirementBoilerplate.has(normUnit(u)));
  const disclaimerNotes = units(job.sec.disclaimer).filter((u) => !analysis.disclaimerBoilerplate.has(normUnit(u)));
  const eduKey = normUnit(flattenBlocks(job.sec.education));
  const educationDeviates = !!eduKey && eduKey !== analysis.educationKey;
  const competenciesDeviate =
    job.competencyList.length > 0 && job.competencyList.join('|') !== analysis.common.competencies.join('|');

  const standard = analysis.common.nationalities;
  const codes = job.nationalities;
  const nationality = {
    known: codes.length > 0,
    added: codes.filter((c) => !standard.includes(c)),
    removed: codes.length ? standard.filter((c) => !codes.includes(c)) : [],
  };
  nationality.isStandard = nationality.known && !nationality.added.length && !nationality.removed.length;

  return { requirements, educationDeviates, disclaimerNotes, competenciesDeviate, nationality };
}

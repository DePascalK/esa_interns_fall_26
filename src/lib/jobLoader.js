import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

import { parseListCell, parseDictCell } from './pyLiteral.js';
import { parseSchemaDate, parseHumanDate, parseTimestamp, toIso, formatDay } from './dates.js';
import {
  clean, parseHtmlSections, sectionsFromDict, sectionKind, splitTitle, extractTopic,
  summarize, extractSite, parseNationalities, flattenBlocks,
} from './sections.js';
import { analyzeCommon, applyCommon } from './boilerplate.js';
import { classify } from './classify.js';
import { countryCode, COUNTRY_BY_CODE } from './reference.js';
import { DISCIPLINES, FOCUS, OTHER_DISCIPLINE } from './taxonomy.js';
import {
  checkColumns, createReport, checkParseErrors, formatReport, LIST_COLUMNS, DICT_COLUMNS,
} from './csvSchema.js';

export const DEFAULT_CSV = path.join('data', 'ESA_intern_jobs_full_enriched.csv');
const ESA_ORIGIN = 'https://jobs.esa.int';

/**
 * Build-time pipeline: parse -> normalise -> enrich -> emit.
 *
 * The CSV is read as-is; every derived value is computed here. Pages and
 * components only ever see the normalised job objects returned below.
 *
 * @param {{ csvPath?: string, quiet?: boolean }} [options]
 * @returns {Promise<{ jobs: object[], meta: object }>}
 */
export async function loadDataset(options = {}) {
  const csvPath = options.csvPath || process.env.JOBS_CSV || DEFAULT_CSV;
  const abs = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  const content = fs.readFileSync(abs, 'utf-8').replace(/^﻿/, '');

  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
  checkColumns(parsed.meta.fields || [], csvPath);

  const report = createReport();
  report.rows = parsed.data.length;
  report.csvErrors = parsed.errors.map((e) => `row ${e.row}: ${e.message}`);
  if (!report.rows) throw new Error(`CSV ${csvPath} contains no data rows.`);

  const base = parsed.data.map((row, index) => normalizeRow(row, index, report));
  checkParseErrors(report);
  ensureUniqueIds(base);

  const analysis = analyzeCommon(base);
  const jobs = base.map((b) => enrich(b, analysis, report));
  jobs.sort(defaultOrder);

  const meta = buildMeta(jobs, analysis, base);
  if (!options.quiet) console.log(formatReport(report, jobs));
  return { jobs, meta, report };
}

let cached = null;

/** Cached loader: the CSV is parsed once per build, however many pages use it. */
export function loadJobs() {
  if (!cached) cached = loadDataset();
  return cached;
}

/* ------------------------------------------------------------------ normalise */

function literal(row, col, index, report) {
  const fn = DICT_COLUMNS.includes(col) ? parseDictCell : parseListCell;
  const { value, error } = fn(row[col]);
  if (error) report.parseErrors[col].push({ row: index, error });
  return value;
}

function jobIdFrom(row, index) {
  const fromScript = clean(row.script_jobid);
  if (/^\d+$/.test(fromScript)) return fromScript;
  const m = /\/(\d{5,})\/?(?:[?#].*)?$/.exec(row.Link || '');
  if (m) return m[1];
  const req = clean(row.requisition_id);
  if (req) return `req-${req.replace(/[^\w-]+/g, '')}`;
  return `job-${index}`;
}

function normalizeRow(row, index, report) {
  const lists = Object.fromEntries(LIST_COLUMNS.map((c) => [c, literal(row, c, index, report)]));
  const dicts = Object.fromEntries(DICT_COLUMNS.map((c) => [c, literal(row, c, index, report)]));

  let raw = parseHtmlSections(row.description_html);
  if (raw.length) report.sectionSource.html++;
  else if (Object.keys(dicts.sections).length) {
    raw = sectionsFromDict(dicts.sections, lists.bullets);
    report.sectionSource.dict++;
  } else if (clean(row.description_text)) {
    raw = [{ heading: 'Description', blocks: [{ type: 'p', lines: [clean(row.description_text)] }] }];
    report.sectionSource.text++;
  }

  // Group sections by kind; unknown headings are kept in order under "other".
  const sec = {
    location: [], team: [], field: [], competencies: [], education: [], requirements: [],
    diversity: [], disclaimer: [], nationality: [],
  };
  const other = [];
  for (const s of raw) {
    const kind = sectionKind(s.heading);
    if (kind === 'other') other.push(s);
    else sec[kind].push(...s.blocks);
  }

  const competencyList = lists.competencies.length
    ? lists.competencies.map(clean).filter(Boolean)
    : sec.competencies
        .flatMap((b) => (b.type === 'list' ? b.items : b.lines))
        .map((l) => clean(l).replace(/[.;]+$/, ''))
        .filter((l) => l && !/for more information|please refer/i.test(l));

  const natFromColumn = lists.nationality_restrictions.map(countryCode).filter(Boolean);
  const nationalities = natFromColumn.length
    ? [...new Set(natFromColumn)]
    : parseNationalities(flattenBlocks(sec.nationality));

  const schema = dicts.schema_org;
  const closingHuman = parseHumanDate(row['Closing Date']);
  const closingSchema = parseSchemaDate(row.closing_date) || parseSchemaDate(schema.validThrough);
  // The earlier of the two: the page's 23:59 CET deadline is an hour before schema.org's 23:00 UTC.
  const closes = [closingHuman, closingSchema].filter(Boolean).sort((a, b) => a - b)[0] || null;
  const posted = parseSchemaDate(row.date_posted) || parseSchemaDate(schema.datePosted) || parseHumanDate(row.date_posted_text);

  const title = clean(row.Title) || 'Untitled internship';
  const { department, rest } = splitTitle(title);

  return {
    index,
    id: jobIdFrom(row, index),
    title,
    department,
    titleRest: rest,
    url: clean(row.Link),
    applyUrl: absolutize(clean(row.apply_url)) || clean(row.Link),
    requisitionId: clean(row.requisition_id),
    vacancyType: clean(row['Vacancy Type']),
    directorate: clean(row.directorate) || 'Unspecified directorate',
    workplace: clean(row.Workplace) || clean(schema.streetAddress),
    closes,
    closesLabel: clean(row['Closing Date']),
    posted,
    scraped: parseTimestamp(row.date_scraped),
    sec,
    other,
    competencyList,
    nationalities,
    contactEmails: lists.contact_emails.map(clean).filter(Boolean),
    descriptionText: clean(row.description_text),
  };
}

function absolutize(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return ESA_ORIGIN + u;
  return '';
}

function ensureUniqueIds(jobs) {
  const seen = new Map();
  for (const j of jobs) {
    const n = seen.get(j.id) || 0;
    seen.set(j.id, n + 1);
    if (n) j.id = `${j.id}-${n + 1}`;
  }
}

/* --------------------------------------------------------------------- enrich */

function enrich(b, analysis, report) {
  const { topic, blocks: tasks } = extractTopic(b.sec.field);
  const common = applyCommon(b, analysis);
  const site = extractSite(b.sec.location, b.workplace);

  const headline = topic || b.titleRest || b.department || b.title;
  const unit = topic ? unitFrom(b.titleRest, topic) : '';

  const tasksText = flattenBlocks(tasks);
  const requirementsText = flattenBlocks(common.requirements);
  const allText = [b.descriptionText, ...Object.values(b.sec).map(flattenBlocks)].join(' ');
  const exportControl = /export control/i.test(allText);

  const cls = classify({
    title: b.title,
    topic,
    tasks: tasksText,
    requirements: requirementsText,
    directorate: b.directorate,
  });

  const notes = [];
  if (site.note) notes.push(site.note);
  notes.push(...common.disclaimerNotes);

  const missing = report.missing;
  if (!topic) missing.topic.push(b.index);
  if (!tasks.length) missing.tasks.push(b.index);
  if (!common.requirements.length) missing.requirements.push(b.index);
  if (!b.closes) missing.closesAt.push(b.index);
  if (!b.nationalities.length) missing.nationalities.push(b.index);
  if (!b.workplace && !site.locationLine) missing.site.push(b.index);

  return {
    id: b.id,
    index: b.index,
    title: b.title,
    headline,
    topic,
    department: b.department,
    unit,
    directorate: b.directorate,
    site,
    workplace: b.workplace,
    url: b.url,
    applyUrl: b.applyUrl,
    requisitionId: b.requisitionId,
    vacancyType: b.vacancyType,
    closesAt: toIso(b.closes),
    closesLabel: b.closesLabel || (b.closes ? formatDay(b.closes) : ''),
    closesDay: formatDay(b.closes),
    postedAt: toIso(b.posted),
    postedDay: formatDay(b.posted),
    summary: summarize(tasks.length ? tasks : b.sec.team),
    sections: {
      tasks,
      requirements: common.requirements,
      education: b.sec.education,
      team: b.sec.team,
      other: b.other,
    },
    educationDeviates: common.educationDeviates,
    competencies: common.competenciesDeviate ? b.competencyList : [],
    notes,
    exportControl,
    nationality: { codes: b.nationalities, ...common.nationality },
    disciplines: cls.disciplines,
    focus: cls.focus,
    techScore: cls.techScore,
    skills: cls.skills,
    search: {
      tasks: tasksText,
      requirements: requirementsText,
    },
  };
}

/**
 * The part of the title after the department is sometimes an organisational
 * unit ("Industrial Return and Analytics Office") and sometimes a short form
 * of the topic. Keep it only when it is a unit or adds words the topic lacks.
 */
function unitFrom(rest, topic) {
  if (!rest || rest === topic) return '';
  if (/\b(office|section|division|unit|department|team|centre|center|service|services|programme)\b/i.test(rest)) return rest;
  const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const topicWords = new Set(words(topic));
  const restWords = words(rest);
  const shared = restWords.filter((w) => topicWords.has(w)).length;
  return restWords.length && shared / restWords.length >= 0.5 ? '' : rest;
}

function defaultOrder(a, b) {
  const f = FOCUS[a.focus].rank - FOCUS[b.focus].rank;
  if (f) return f;
  const ca = a.closesAt || '9999';
  const cb = b.closesAt || '9999';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return a.headline.localeCompare(b.headline);
}

/* ----------------------------------------------------------------------- meta */

function countBy(items) {
  const m = new Map();
  for (const it of items) m.set(it, (m.get(it) || 0) + 1);
  return m;
}

function buildMeta(jobs, analysis, base) {
  const scraped = base.map((b) => b.scraped).filter(Boolean).sort((a, b) => b - a)[0] || null;

  const discCounts = countBy(jobs.flatMap((j) => j.disciplines.map((d) => d.id)));
  const disciplines = [...DISCIPLINES, OTHER_DISCIPLINE]
    .filter((d) => discCounts.has(d.id))
    .map((d) => ({ id: d.id, label: d.label, technical: d.technical, count: discCounts.get(d.id) }));

  const siteMap = new Map();
  for (const j of jobs) {
    const s = siteMap.get(j.site.id) || { id: j.site.id, label: j.site.label, name: j.site.name, city: j.site.city, count: 0 };
    s.count++;
    siteMap.set(j.site.id, s);
  }
  const sites = [...siteMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const dirCounts = countBy(jobs.map((j) => j.directorate));
  const directorates = [...dirCounts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const natCodes = new Set([...analysis.common.nationalities, ...jobs.flatMap((j) => j.nationality.codes)]);
  const countries = [...natCodes]
    .map((code) => ({ code, name: COUNTRY_BY_CODE[code]?.name || code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const focusCounts = countBy(jobs.map((j) => j.focus));
  const focus = Object.entries(FOCUS).map(([id, f]) => ({ id, label: f.label, count: focusCounts.get(id) || 0 }));

  return {
    count: jobs.length,
    dataAsOf: toIso(scraped),
    dataAsOfDay: formatDay(scraped),
    disciplines,
    sites,
    directorates,
    countries,
    focus,
    exportControlCount: jobs.filter((j) => j.exportControl).length,
    common: {
      ...analysis.common,
      nationalityNames: analysis.common.nationalities.map((c) => COUNTRY_BY_CODE[c]?.name || c),
    },
  };
}

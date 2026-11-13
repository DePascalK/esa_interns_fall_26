/**
 * The data contract with the scraper (esa_jobs_scraper.py): required columns,
 * which of them hold Python literals, and a build-time coverage report.
 * Extra columns (e.g. the scraper's --extra ones) are allowed and ignored.
 */

export const REQUIRED_COLUMNS = [
  'Title', 'Link', 'Vacancy Type', 'Closing Date', 'Workplace', 'apply_url',
  'requisition_id', 'date_posted', 'closing_date', 'publication', 'contract_type',
  'directorate', 'hiring_organization', 'description_html', 'description_text',
  'sections', 'bullets', 'competencies', 'nationality_restrictions',
  'contact_emails', 'schema_org', 'script_jobid', 'meta_image', 'date_scraped',
  'source_index',
];

/** Columns written as Python literals (read with pyLiteral.js). */
export const LIST_COLUMNS = ['bullets', 'competencies', 'nationality_restrictions', 'contact_emails'];
export const DICT_COLUMNS = ['sections', 'schema_org'];

/** Share of rows allowed to fail parsing in one literal column before the build stops. */
export const MAX_PARSE_FAILURE_SHARE = 0.1;

export class DataContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataContractError';
  }
}

/** Throws when required columns are missing. */
export function checkColumns(fields, csvPath) {
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length) {
    throw new DataContractError(
      `CSV ${csvPath} is missing required column(s): ${missing.join(', ')}.\n` +
        `Found columns: ${fields.join(', ')}`,
    );
  }
}

export function createReport() {
  return {
    rows: 0,
    parseErrors: Object.fromEntries([...LIST_COLUMNS, ...DICT_COLUMNS].map((c) => [c, []])),
    csvErrors: [],
    missing: { topic: [], tasks: [], requirements: [], closesAt: [], nationalities: [], site: [] },
    sectionSource: { html: 0, dict: 0, text: 0 },
  };
}

/** Throws when too many cells of one column failed to parse. */
export function checkParseErrors(report) {
  for (const [col, errs] of Object.entries(report.parseErrors)) {
    if (report.rows && errs.length / report.rows > MAX_PARSE_FAILURE_SHARE) {
      const sample = errs.slice(0, 3).map((e) => `row ${e.row}: ${e.error}`).join('; ');
      throw new DataContractError(
        `Column "${col}" could not be parsed in ${errs.length} of ${report.rows} rows (${sample}). ` +
          'Has the scraper changed how it writes list/dict cells?',
      );
    }
  }
}

/** Human-readable coverage report, printed once per build. */
export function formatReport(report, jobs) {
  const lines = [];
  const pct = (n) => `${n}/${report.rows}`;
  lines.push(`[jobs] ${report.rows} rows loaded`);
  lines.push(
    `[jobs] sections from: html ${report.sectionSource.html}, sections column ${report.sectionSource.dict}, plain text ${report.sectionSource.text}`,
  );
  const errs = Object.entries(report.parseErrors).filter(([, e]) => e.length);
  if (errs.length) lines.push(`[jobs] literal parse failures: ${errs.map(([c, e]) => `${c} ${e.length}`).join(', ')}`);
  if (report.csvErrors.length) lines.push(`[jobs] CSV warnings: ${report.csvErrors.length} (first: ${report.csvErrors[0]})`);
  const miss = Object.entries(report.missing).filter(([, rows]) => rows.length);
  if (miss.length) {
    lines.push(`[jobs] missing per field: ${miss.map(([k, rows]) => `${k} ${pct(rows.length)}`).join(', ')}`);
  }
  const focus = {};
  const disc = {};
  for (const j of jobs) {
    focus[j.focus] = (focus[j.focus] || 0) + 1;
    for (const d of j.disciplines) disc[d.label] = (disc[d.label] || 0) + 1;
  }
  lines.push(`[jobs] focus: ${Object.entries(focus).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  lines.push(
    `[jobs] disciplines: ${Object.entries(disc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  );
  return lines.join('\n');
}

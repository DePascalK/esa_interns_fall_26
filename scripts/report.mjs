#!/usr/bin/env node
/**
 * Prints how every posting is classified, for reviewing taxonomy.js.
 *
 *   npm run report                    # data/ESA_intern_jobs_full_enriched.csv
 *   npm run report -- path/to/file.csv
 *   npm run report -- --focus non-technical
 *   npm run report -- --csv > report.csv
 */
import { loadDataset } from '../src/lib/jobLoader.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const asCsv = args.includes('--csv') ? (args.splice(args.indexOf('--csv'), 1), true) : false;
const focusFilter = flag('--focus');
const csvPath = args[0];

const { jobs, meta } = await loadDataset({ csvPath, quiet: asCsv });
const rows = jobs.filter((j) => !focusFilter || j.focus === focusFilter);

if (asCsv) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  console.log(['id', 'focus', 'headline', 'site', 'directorate', 'disciplines', 'keywords', 'skills', 'export_control'].join(','));
  for (const j of rows) {
    console.log([
      j.id, j.focus, j.headline, j.site.id, j.directorate,
      j.disciplines.map((d) => `${d.id}:${d.score}`).join(' '),
      j.disciplines.map((d) => `${d.id}=${d.keywords.join('|')}`).join(' '),
      j.skills.join('|'), j.exportControl ? 'yes' : '',
    ].map(q).join(','));
  }
} else {
  console.log(`\n${rows.length} of ${meta.count} postings${focusFilter ? ` (focus: ${focusFilter})` : ''}\n`);
  for (const j of rows) {
    console.log(`[${j.focus}] ${j.headline}`);
    console.log(`   ${j.site.label} · ${j.directorate} · id ${j.id}`);
    for (const d of j.disciplines) console.log(`   ${String(d.score).padStart(2)}  ${d.label}: ${d.keywords.join(', ') || '-'}`);
    if (j.skills.length) console.log(`   skills: ${j.skills.join(', ')}`);
    console.log('');
  }
}

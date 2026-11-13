# ESA Internship Explorer

A static site for exploring ESA internship opportunities, with technical, engineering and science internships listed first.

- **List** — every internship as a card: topic, department, site, deadline, field and skill tags. Filter by status, focus (technical / mixed / non-technical), field, site, directorate, nationality and export control; search topics, skills and tools; sort; shortlist.
- **Overview** — a field × site grid and a directorate breakdown; every number is a link into the filtered list.
- **One page per internship** — what you'll do, what you need, eligibility, deadline countdown, apply link. Text that is identical across postings (education, languages, competencies, disclaimers) is shown once under "Applies to all ESA internships".
- Filters and search live in the URL, so any view can be bookmarked or shared.

## Tech stack

- [Astro](https://astro.build/) 5 — static site generation
- [PapaParse](https://www.papaparse.com/) — CSV parsing at build time
- [node-html-parser](https://github.com/taoqf/node-html-parser) — splits each posting's HTML into sections at build time
- [MiniSearch](https://lucaong.github.io/minisearch/) — client-side search over a prebuilt index
- [Vitest](https://vitest.dev/) — tests for the data pipeline

No backend: all data processing happens during `npm run build`.

## Data contract

The site reads `data/ESA_intern_jobs_full_enriched.csv` exactly as the scraper (`esa_jobs_scraper.py`) writes it. The CSV is never modified.

| Column(s) | Format | How it is used |
|---|---|---|
| `description_html` | HTML | Primary source for all sections (works for 2025 files, where `sections` is `{}`) |
| `sections`, `schema_org` | Python dict literal | Fallback sections; schema.org dates |
| `bullets`, `competencies`, `nationality_restrictions`, `contact_emails` | Python list literal | Parsed with `src/lib/pyLiteral.js` (not JSON) |
| `closing_date`, `date_posted` | `Mon Nov 30 23:00:00 UTC 2026` | Deadline / posting date |
| `Closing Date` | `30 November 2026 23:59 CET/CEST` | Shown to users; the earlier of the two closing times is used |
| `date_scraped` | `2026-11-03 13:44:14.986851+00:00` | "Data from …" in the header |
| `apply_url` | relative path | Prefixed with `https://jobs.esa.int` |

All 25 columns must be present (the build fails with a clear message otherwise); extra columns, such as the scraper's `--extra` ones, are ignored. Each build prints a coverage report:

```
[jobs] 112 rows loaded
[jobs] sections from: html 112, sections column 0, plain text 0
[jobs] focus: technical 71, mixed 9, non-technical 32
[jobs] disciplines: Software & IT 30, ...
```

## Classification

Field tags ("disciplines"), the technical/mixed/non-technical focus and the skill chips come from keyword rules in **`src/lib/taxonomy.js`** — plain data, meant to be edited. Every tag records the keywords that triggered it, and each internship page shows them under "Why these tags?".

To review the result after editing the rules:

```bash
npm run report                       # every posting with its tags and keywords
npm run report -- --focus mixed      # only one focus group
npm run report -- --csv > tags.csv   # as a spreadsheet
```

Sites and the eligible-country list are in `src/lib/reference.js`; search synonyms (ML ↔ machine learning, RF, GNC, EO, …) in `src/lib/searchConfig.js`.

## Project structure

```
data/ESA_intern_jobs_full_enriched.csv   source data (unchanged)
scripts/report.mjs                       classification report (npm run report)
src/
  lib/            build time (Node)
    jobLoader.js      pipeline: parse -> normalise -> enrich -> emit (cached per build)
    csvSchema.js      required columns, validation, coverage report
    pyLiteral.js      Python-literal parser for list/dict cells
    dates.js          date parsing (regex-based, CET/CEST aware)
    sections.js       HTML -> sections, title split, topic, site, nationalities
    boilerplate.js    text common to all postings vs. per-posting specifics
    taxonomy.js       classification rules (edit me)
    classify.js       applies taxonomy.js
    reference.js      ESA sites, countries
    searchConfig.js   search options + synonyms (shared with the browser)
    searchIndex.js    builds the search index
    paths.js          base-path-aware links
  layouts/BaseLayout.astro
  pages/
    index.astro            list + overview
    job/[id].astro         one page per internship
    search-index.json.js   static search index endpoint
  components/       SearchBar, Facets, JobList, JobCard, JobDetail, Blocks, CommonInfo, Overview
  scripts/          browser code: state (filters/URL), search, status, shortlist, overview, detail, prefs, format
  styles/global.css
tests/              Vitest tests + fixtures/sample.csv (one 2026-format and one 2025-format row)
```

## Development

```bash
npm install
npm test          # data pipeline tests
npm run dev       # local dev server
npm run build     # static build into dist/
npm run preview   # serve dist/
```

To build against another CSV without replacing the data file: `JOBS_CSV=path/to/file.csv npm run build` (also works with `npm run dev`).

## Disclaimer

This website is an independent, personal project and is not affiliated with, endorsed by, or in any way officially connected with the European Space Agency (ESA) or ETH Zürich.

All information (including internship listings, descriptions, and locations) is sourced from publicly available data on the official ESA Career Portal. While efforts are made to ensure the information is accurate and up-to-date, no guarantees are made regarding the completeness, accuracy, reliability, or timeliness of the data presented. Field tags, summaries and eligibility hints are generated automatically and may be wrong.

This site is provided "as-is" and "as-available" without any warranties, express or implied. The creator of this site assumes no liability for any errors, omissions, or for any actions taken or decisions made based on the information provided herein.

Users are strongly advised to verify all information directly on the official ESA Career Portal before making any decisions or applications.

All trademarks, service marks, and logos (e.g., "ESA") are the property of their respective owners.

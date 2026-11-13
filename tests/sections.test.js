import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, it, expect } from 'vitest';
import {
  parseHtmlSections, flattenBlocks, splitTitle, extractTopic, extractSite, parseNationalities,
  sectionsFromDict, sectionKind,
} from '../src/lib/sections.js';
import { parseDictCell, parseListCell } from '../src/lib/pyLiteral.js';

const csv = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.csv'), 'utf-8');
const [row2026, row2025] = Papa.parse(csv, { header: true, skipEmptyLines: true }).data;

describe('parseHtmlSections', () => {
  const sections = parseHtmlSections(row2026.description_html);

  it('finds the same headings as the scraper', () => {
    const scraper = parseDictCell(row2026.sections).value;
    expect(sections.map((s) => s.heading)).toEqual(Object.keys(scraper));
  });

  it('produces the same section text as the scraper', () => {
    const scraper = parseDictCell(row2026.sections).value;
    for (const s of sections) expect(flattenBlocks(s.blocks)).toBe(scraper[s.heading]);
  });

  it('keeps lists as lists and <br>-separated lines as lines', () => {
    const req = sections.find((s) => s.heading === 'Additional requirements');
    const list = req.blocks.find((b) => b.type === 'list');
    expect(list.items).toHaveLength(4);
    expect(list.items[0]).toBe('strong Python programming skills;');
    const comp = sections.find((s) => s.heading === 'Behavioural competencies');
    expect(comp.blocks[0].lines).toEqual([
      'Result Orientation', 'Operational Efficiency', 'Fostering Cooperation',
      'Relationship Management', 'Continuous Improvement', 'Forward Thinking',
    ]);
  });

  it('works on 2025-format rows whose sections column is empty', () => {
    expect(parseDictCell(row2025.sections).value).toEqual({});
    const s = parseHtmlSections(row2025.description_html);
    expect(s.map((x) => sectionKind(x.heading))).toEqual([
      'location', 'team', 'field', 'competencies', 'education', 'requirements', 'diversity', 'disclaimer', 'nationality',
    ]);
  });
});

describe('sectionsFromDict fallback', () => {
  it('recovers list items from the bullets column', () => {
    const dict = parseDictCell(row2026.sections).value;
    const bullets = parseListCell(row2026.bullets).value;
    const req = sectionsFromDict(dict, bullets).find((s) => s.heading === 'Additional requirements');
    expect(req.blocks.find((b) => b.type === 'list').items).toContain('experience with PyTorch or a similar deep-learning framework;');
  });
});

describe('title, topic, site, nationality', () => {
  it('splits 2026 and 2025 title styles', () => {
    expect(splitTitle(row2026.Title)).toEqual({
      department: 'Science Operations Department',
      rest: 'Discovering Astronomical Anomalies with AnomalyMatch',
    });
    expect(splitTitle('Intern in the External Relations Department, International Relations')).toEqual({
      department: 'External Relations Department',
      rest: 'International Relations',
    });
  });

  it('extracts the topic line and removes it from the tasks', () => {
    const field = parseHtmlSections(row2026.description_html).find((s) => sectionKind(s.heading) === 'field');
    const { topic, blocks } = extractTopic(field.blocks);
    expect(topic).toBe('Beyond Images: Discovering Astronomical Anomalies in Light Curves and Spectra with AnomalyMatch');
    expect(flattenBlocks(blocks)).not.toMatch(/Topic of the internship/);
  });

  it('maps locations to ESA sites', () => {
    expect(extractSite([{ type: 'p', lines: ['ESAC, Villanueva de la Cañada, Spain'] }], 'Villanueva de la Cañada, ES').id).toBe('ESAC');
    expect(extractSite([], 'Noordwijk, NL').id).toBe('ESTEC');
    const redu = extractSite([{ type: 'p', lines: ['ESEC - Galaxia - Transinne, Belgium', 'A driving licence is recommended.'] }], 'Redu, BE');
    expect(redu.id).toBe('ESEC');
    expect(redu.note).toBe('A driving licence is recommended.');
    expect(extractSite([], 'Atlantis, XX')).toMatchObject({ id: 'ATLANTIS', label: 'Atlantis, XX' });
  });

  it('parses nationality statements, including cooperating states', () => {
    const codes = parseNationalities(
      'Please note that applications are only considered from nationals of one of the following States: Austria, ' +
        'Czechia, the Netherlands, Switzerland, and the United Kingdom. Applicants from Canada as a Cooperating State ' +
        'can apply as well as those from Bulgaria, Croatia and Malta as European Cooperating States (ECS).',
    );
    expect(codes).toEqual(['AT', 'CZ', 'NL', 'CH', 'GB', 'CA', 'BG', 'HR', 'MT']);
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { loadDataset } from '../src/lib/jobLoader.js';
import { classify } from '../src/lib/classify.js';
import { buildSearchIndex } from '../src/lib/searchIndex.js';

const fixture = path.join(__dirname, 'fixtures', 'sample.csv');

describe('loadDataset on the sample CSV', () => {
  let data;
  beforeAll(async () => {
    data = await loadDataset({ csvPath: fixture, quiet: true });
  });

  const byId = (id) => data.jobs.find((j) => j.id === id);

  it('loads every row with a stable id', () => {
    expect(data.jobs.map((j) => j.id).sort()).toEqual(['1452872533', '1452874433']);
    expect(data.meta.count).toBe(2);
  });

  it('builds the headline from the topic line', () => {
    const j = byId('1452874433');
    expect(j.headline).toBe('Beyond Images: Discovering Astronomical Anomalies in Light Curves and Spectra with AnomalyMatch');
    expect(j.department).toBe('Science Operations Department');
    expect(j.summary).toMatch(/^Astronomical archives contain/);
  });

  it('removes standard requirement sentences but keeps the specific ones', () => {
    const j = byId('1452874433');
    const text = JSON.stringify(j.sections.requirements);
    expect(text).not.toMatch(/working languages/);
    expect(text).toMatch(/PyTorch/);
  });

  it('parses dates and makes the apply link absolute', () => {
    const j = byId('1452874433');
    expect(j.closesAt).toBe('2026-11-30T22:59:00.000Z');
    expect(j.closesLabel).toBe('30 November 2026 23:59 CET/CEST');
    expect(j.applyUrl).toBe('https://jobs.esa.int/talentcommunity/apply/1452874433/?locale=en_GB');
    expect(data.meta.dataAsOf).toBe('2026-11-03T13:44:14.987Z');
  });

  it('flags export control and keeps it as a note', () => {
    const j = byId('1452872533');
    expect(j.exportControl).toBe(true);
    expect(j.notes.some((n) => /export control/.test(n))).toBe(true);
    expect(j.notes.some((n) => /time of publication/.test(n))).toBe(false);
    expect(byId('1452874433').exportControl).toBe(false);
  });

  it('derives nationalities from the text when the column is empty (2025 format)', () => {
    const j = byId('1452872533');
    expect(j.nationality.codes).toContain('CH');
    expect(j.nationality.codes).not.toContain('CA');
    expect(byId('1452874433').nationality.codes).toContain('CA');
  });

  it('tags the AnomalyMatch internship as technical data science / astronomy with explained keywords', () => {
    const j = byId('1452874433');
    expect(j.focus).toBe('technical');
    const ids = j.disciplines.map((d) => d.id);
    expect(ids).toContain('space-science');
    expect(ids).toContain('data-ai');
    expect(j.disciplines.find((d) => d.id === 'data-ai').keywords).toContain('PyTorch');
    expect(j.skills).toEqual(expect.arrayContaining(['Python', 'PyTorch', 'Machine learning']));
  });

  it('produces a loadable search index', () => {
    const idx = buildSearchIndex(data.jobs);
    expect(idx.documentCount).toBe(2);
  });
});

describe('data contract', () => {
  it('fails clearly when a required column is missing', async () => {
    const tmp = path.join(os.tmpdir(), `esa-missing-${process.pid}.csv`);
    const [header, ...rest] = fs.readFileSync(fixture, 'utf-8').split('\n');
    fs.writeFileSync(tmp, [header.replace('directorate,', 'dept,'), ...rest].join('\n'));
    await expect(loadDataset({ csvPath: tmp, quiet: true })).rejects.toThrow(/missing required column\(s\): directorate/);
    fs.unlinkSync(tmp);
  });

  it('tolerates extra columns appended by the scraper (--extra)', async () => {
    const tmp = path.join(os.tmpdir(), `esa-extra-${process.pid}.csv`);
    const csv = fs.readFileSync(fixture, 'utf-8').trimEnd().split('\n');
    // Only the header and record boundaries matter here: append an empty extra column to the header.
    csv[0] = `${csv[0]},grade_band`;
    fs.writeFileSync(tmp, `${csv.join('\n')}\n`);
    const data = await loadDataset({ csvPath: tmp, quiet: true });
    expect(data.jobs).toHaveLength(2);
    fs.unlinkSync(tmp);
  });
});

describe('classify', () => {
  it('separates technical from non-technical postings', () => {
    expect(classify({ title: 'Intern in Legal Services, Intellectual Property', topic: 'Contract law', tasks: 'draft legal opinions', requirements: '', directorate: '' }).focus)
      .toBe('non-technical');
    expect(classify({ title: 'Intern in the RF Payload Division', topic: 'Antenna measurements', tasks: 'characterise antennas with a VNA', requirements: 'VHDL and FPGA experience', directorate: '' }).disciplines[0].id)
      .toBe('rf-telecom');
  });

  it('does not match keywords inside other words', () => {
    const r = classify({ title: 'Intern', topic: 'Eventually costume lawn', tasks: '', requirements: '', directorate: '' });
    expect(r.disciplines.map((d) => d.id)).toEqual(['other']);
  });
});

import { describe, it, expect } from 'vitest';
import { escapeHtml, highlight, snippet, termRegex } from '../src/scripts/format.js';
import { statusOf } from '../src/scripts/status.js';
import { buildQuery, processTerm } from '../src/lib/searchConfig.js';

describe('format', () => {
  it('escapes HTML before highlighting', () => {
    expect(escapeHtml(`<b>"Tom's" & co</b>`)).toBe('&lt;b&gt;&quot;Tom&#39;s&quot; &amp; co&lt;/b&gt;');
    expect(highlight('<script>FPGA</script>', termRegex(['fpga']))).toBe('&lt;script&gt;<mark>FPGA</mark>&lt;/script&gt;');
  });

  it('highlights whole words that start with a term', () => {
    expect(highlight('FPGAs and antennas', termRegex(['fpga', 'antenna']))).toBe('<mark>FPGAs</mark> and <mark>antennas</mark>');
    expect(highlight('microfpga', termRegex(['fpga']))).toBe('microfpga');
  });

  it('cuts a snippet around the first match', () => {
    const text = `${'word '.repeat(60)}PyTorch experience ${'more '.repeat(60)}`;
    const s = snippet(text, termRegex(['pytorch']), 30);
    expect(s.startsWith('… ')).toBe(true);
    expect(s).toContain('<mark>PyTorch</mark>');
    expect(s.endsWith(' …')).toBe(true);
  });
});

describe('statusOf', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  it('classifies deadlines relative to now', () => {
    expect(statusOf('2026-11-30T22:59:00Z', now)).toMatchObject({ state: 'open', label: '19 days left' });
    expect(statusOf('2026-11-14T22:59:00Z', now).state).toBe('soon');
    expect(statusOf('2026-11-11T20:00:00Z', now)).toMatchObject({ state: 'soon', label: '8 h left' });
    expect(statusOf('2025-11-30T22:59:00Z', now)).toMatchObject({ state: 'closed', label: 'Closed' });
    expect(statusOf('', now).state).toBe('unknown');
  });
});

describe('search query building', () => {
  it('drops stop words and expands abbreviations', () => {
    expect(processTerm('The')).toBeNull();
    expect(processTerm('visualisation')).toBe('visualization');
    const q = buildQuery('the ML pytorch');
    expect(q.combineWith).toBe('AND');
    expect(q.queries).toHaveLength(2);
    expect(q.queries[0].combineWith).toBe('OR');
    expect(q.queries[1]).toBe('pytorch');
    expect(buildQuery('the of')).toBeNull();
  });
});

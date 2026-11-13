import { describe, it, expect } from 'vitest';
import { parseSchemaDate, parseHumanDate, parseTimestamp, formatDay } from '../src/lib/dates.js';

describe('date parsing', () => {
  it('parses schema.org dates as UTC', () => {
    expect(parseSchemaDate('Mon Nov 30 23:00:00 UTC 2026').toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(parseSchemaDate('Fri Oct 30 00:00:00 UTC 2026').toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });

  it('parses the human-readable closing date in CET (winter) and CEST (summer)', () => {
    expect(parseHumanDate('30 November 2026 23:59 CET/CEST').toISOString()).toBe('2026-11-30T22:59:00.000Z');
    expect(parseHumanDate('15 June 2026 23:59 CET/CEST').toISOString()).toBe('2026-06-15T21:59:00.000Z');
  });

  it('switches to summer time on the last Sunday of March', () => {
    expect(parseHumanDate('28 March 2026 12:00 CET/CEST').toISOString()).toBe('2026-03-28T11:00:00.000Z');
    expect(parseHumanDate('29 March 2026 12:00 CET/CEST').toISOString()).toBe('2026-03-29T10:00:00.000Z');
  });

  it('parses scraper timestamps with microseconds and offsets', () => {
    expect(parseTimestamp('2026-11-03 13:44:14.986851+00:00').toISOString()).toBe('2026-11-03T13:44:14.987Z');
    expect(parseTimestamp('2026-11-03 15:44:14+02:00').toISOString()).toBe('2026-11-03T13:44:14.000Z');
  });

  it('returns null for unparseable input', () => {
    expect(parseSchemaDate('')).toBeNull();
    expect(parseHumanDate('soon')).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });

  it('formats days in English regardless of locale', () => {
    expect(formatDay(new Date('2026-11-30T22:59:00Z'))).toBe('30 Nov 2026');
  });
});

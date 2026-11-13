import { describe, it, expect } from 'vitest';
import { parsePyLiteral, parseListCell, parseDictCell, PyLiteralError } from '../src/lib/pyLiteral.js';

describe('parsePyLiteral', () => {
  it('parses lists of single-quoted strings', () => {
    expect(parsePyLiteral("['Result Orientation', 'Forward Thinking']")).toEqual(['Result Orientation', 'Forward Thinking']);
  });

  it('handles strings Python wrote with double quotes because they contain an apostrophe', () => {
    const v = parsePyLiteral(`{'Education': "You must be ... at Master's level.", 'X': 'y'}`);
    expect(v.Education).toBe("You must be ... at Master's level.");
    expect(v.X).toBe('y');
  });

  it('decodes Python escapes', () => {
    expect(parsePyLiteral(String.raw`['a\xa0b', 'it\'s', 'back\\slash', 'line\nbreak', '’']`)).toEqual([
      'a b', "it's", 'back\\slash', 'line\nbreak', '’',
    ]);
  });

  it('parses nested dicts, empty containers, numbers and constants', () => {
    expect(parsePyLiteral("{'a': {'b': []}, 'c': (1, 2.5, -3), 'd': True, 'e': None, 'f': {}}")).toEqual({
      a: { b: [] }, c: [1, 2.5, -3], d: true, e: null, f: {},
    });
  });

  it('accepts trailing commas and implicit string concatenation', () => {
    expect(parsePyLiteral("['a' 'b', 'c',]")).toEqual(['ab', 'c']);
  });

  it('keeps non-ASCII characters as they are', () => {
    expect(parsePyLiteral("{'streetAddress': 'Villanueva de la Cañada, ES'}").streetAddress).toBe('Villanueva de la Cañada, ES');
  });

  it('rejects malformed input with a position', () => {
    expect(() => parsePyLiteral("['unterminated")).toThrow(PyLiteralError);
    expect(() => parsePyLiteral("['a' 'b'")).toThrow(/position/);
    expect(() => parsePyLiteral('["a"] extra')).toThrow(/trailing/);
  });
});

describe('cell helpers', () => {
  it('treat empty cells as empty values', () => {
    expect(parseListCell('')).toEqual({ value: [], error: null });
    expect(parseDictCell('  ')).toEqual({ value: {}, error: null });
  });

  it('report type mismatches and parse errors instead of throwing', () => {
    expect(parseListCell("{'a': 'b'}").error).toBe('not a list');
    expect(parseDictCell("['a']").error).toBe('not a dict');
    expect(parseListCell('[oops').error).toMatch(/position/);
  });
});

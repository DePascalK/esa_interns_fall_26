/**
 * Parser for the Python-literal cells written by the scraper (repr() of
 * lists/dicts of strings), e.g. "['a', \"Master's\"]" or "{'Location': 'ESTEC'}".
 *
 * JSON.parse cannot read these: Python switches between ' and " per string
 * and writes escapes such as \xa0. Supported: lists, tuples, dicts, strings
 * (incl. r/b/u prefixes and implicit concatenation), ints, floats,
 * True/False/None.
 */

export class PyLiteralError extends Error {
  constructor(message, pos) {
    super(`${message} at position ${pos}`);
    this.name = 'PyLiteralError';
    this.pos = pos;
  }
}

const WS = /\s/;

/**
 * Parse a Python literal. Throws PyLiteralError on malformed input.
 * @param {string} src
 */
export function parsePyLiteral(src) {
  if (typeof src !== 'string') throw new PyLiteralError('Input is not a string', 0);
  let i = 0;
  const n = src.length;

  const skipWs = () => {
    while (i < n && WS.test(src[i])) i++;
  };

  const fail = (msg) => {
    throw new PyLiteralError(msg, i);
  };

  function parseValue() {
    skipWs();
    if (i >= n) fail('Unexpected end of input');
    const c = src[i];
    if (c === '[') return parseSeq('[', ']');
    if (c === '(') return parseSeq('(', ')');
    if (c === '{') return parseDict();
    if (c === "'" || c === '"') return parseStrings();
    if (/[rRbBuU]/.test(c) && (src[i + 1] === "'" || src[i + 1] === '"' ||
        (/[rRbB]/.test(src[i + 1] || '') && (src[i + 2] === "'" || src[i + 2] === '"')))) {
      return parseStrings();
    }
    if (c === '-' || c === '+' || (c >= '0' && c <= '9') || c === '.') return parseNumber();
    for (const [word, value] of [['True', true], ['False', false], ['None', null]]) {
      if (src.startsWith(word, i) && !/\w/.test(src[i + word.length] || '')) {
        i += word.length;
        return value;
      }
    }
    fail(`Unexpected character ${JSON.stringify(c)}`);
  }

  function parseSeq(open, close) {
    i++; // open
    const out = [];
    skipWs();
    if (src[i] === close) {
      i++;
      return out;
    }
    for (;;) {
      out.push(parseValue());
      skipWs();
      if (src[i] === ',') {
        i++;
        skipWs();
        if (src[i] === close) {
          i++;
          return out;
        }
        continue;
      }
      if (src[i] === close) {
        i++;
        return out;
      }
      fail(`Expected ',' or '${close}'`);
    }
  }

  function parseDict() {
    i++; // {
    const out = {};
    skipWs();
    if (src[i] === '}') {
      i++;
      return out;
    }
    for (;;) {
      const key = parseValue();
      skipWs();
      if (src[i] !== ':') fail("Expected ':'");
      i++;
      out[String(key)] = parseValue();
      skipWs();
      if (src[i] === ',') {
        i++;
        skipWs();
        if (src[i] === '}') {
          i++;
          return out;
        }
        continue;
      }
      if (src[i] === '}') {
        i++;
        return out;
      }
      fail("Expected ',' or '}'");
    }
  }

  // Adjacent string literals are concatenated, as in Python.
  function parseStrings() {
    let s = parseString();
    for (;;) {
      const save = i;
      skipWs();
      if (i < n && (src[i] === "'" || src[i] === '"' ||
          (/[rRbBuU]/.test(src[i]) && (src[i + 1] === "'" || src[i + 1] === '"')))) {
        s += parseString();
      } else {
        i = save;
        return s;
      }
    }
  }

  function parseString() {
    let raw = false;
    while (/[rRbBuU]/.test(src[i])) {
      if (src[i] === 'r' || src[i] === 'R') raw = true;
      i++;
    }
    const q = src[i];
    if (q !== "'" && q !== '"') fail('Expected string');
    const triple = src[i + 1] === q && src[i + 2] === q;
    const quote = triple ? q.repeat(3) : q;
    i += quote.length;
    let out = '';
    for (;;) {
      if (i >= n) fail('Unterminated string');
      if (src.startsWith(quote, i)) {
        i += quote.length;
        return out;
      }
      const c = src[i];
      if (c === '\\') {
        if (raw) {
          out += c + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += parseEscape();
        continue;
      }
      if (!triple && (c === '\n' || c === '\r')) fail('Newline in string');
      out += c;
      i++;
    }
  }

  function parseEscape() {
    i++; // backslash
    const c = src[i];
    i++;
    switch (c) {
      case '\\': return '\\';
      case "'": return "'";
      case '"': return '"';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'a': return '\x07';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'v': return '\v';
      case '\n': return '';
      case 'x': return hex(2);
      case 'u': return hex(4);
      case 'U': return hex(8);
      default:
        if (c >= '0' && c <= '7') {
          let digits = c;
          while (digits.length < 3 && src[i] >= '0' && src[i] <= '7') digits += src[i++];
          return String.fromCodePoint(parseInt(digits, 8));
        }
        // Unknown escapes are kept literally, as Python does.
        return '\\' + (c ?? '');
    }
  }

  function hex(len) {
    const h = src.slice(i, i + len);
    if (!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(h)) fail(`Invalid \\x/\\u escape`);
    i += len;
    return String.fromCodePoint(parseInt(h, 16));
  }

  function parseNumber() {
    const m = /^[+-]?(?:\d[\d_]*)?(?:\.\d*)?(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (!m || !m[0] || m[0] === '-' || m[0] === '+') fail('Invalid number');
    i += m[0].length;
    return Number(m[0].replace(/_/g, ''));
  }

  const value = parseValue();
  skipWs();
  if (i !== n) fail('Unexpected trailing characters');
  return value;
}

/**
 * Parse a cell that should hold a list. Empty cells give [].
 * @returns {{ value: any[], error: string | null }}
 */
export function parseListCell(cell) {
  const s = (cell ?? '').trim();
  if (!s) return { value: [], error: null };
  try {
    const v = parsePyLiteral(s);
    if (Array.isArray(v)) return { value: v.map((x) => (x == null ? '' : String(x))), error: null };
    return { value: [], error: 'not a list' };
  } catch (e) {
    return { value: [], error: e.message };
  }
}

/**
 * Parse a cell that should hold a dict. Empty cells give {}.
 * @returns {{ value: Record<string, any>, error: string | null }}
 */
export function parseDictCell(cell) {
  const s = (cell ?? '').trim();
  if (!s) return { value: {}, error: null };
  try {
    const v = parsePyLiteral(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return { value: v, error: null };
    return { value: {}, error: 'not a dict' };
  } catch (e) {
    return { value: {}, error: e.message };
  }
}

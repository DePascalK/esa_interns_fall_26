/**
 * Date parsing for the formats in the CSV. Regex-based on purpose:
 * Date.parse() is not reliable across engines for these strings.
 *
 *   closing_date / date_posted  "Mon Nov 30 23:00:00 UTC 2026"   (schema.org)
 *   Closing Date                "30 November 2026 23:59 CET/CEST" (shown on ESA site)
 *   date_scraped                "2026-11-03 13:44:14.986851+00:00"
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const monthIndex = (name) => MONTHS[String(name).slice(0, 3).toLowerCase()];

/** "Mon Nov 30 23:00:00 UTC 2026" -> Date (UTC) or null. */
export function parseSchemaDate(s) {
  const m = /^\s*[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(UTC|GMT)\s+(\d{4})\s*$/.exec(s || '');
  if (!m) return null;
  const mon = monthIndex(m[1]);
  if (mon === undefined) return null;
  return new Date(Date.UTC(+m[7], mon, +m[2], +m[3], +m[4], +(m[5] || 0)));
}

/** Last Sunday of a month (UTC day number). */
function lastSunday(year, month) {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}

/**
 * UTC offset (hours) of Central European time at a given local wall-clock
 * time: CEST (+2) from the last Sunday of March to the last Sunday of October.
 */
function cetOffset(year, month, day, hour) {
  const startDay = lastSunday(year, 2);
  const endDay = lastSunday(year, 9);
  const afterStart = month > 2 || (month === 2 && (day > startDay || (day === startDay && hour >= 2)));
  const beforeEnd = month < 9 || (month === 9 && (day < endDay || (day === endDay && hour < 3)));
  return afterStart && beforeEnd ? 2 : 1;
}

/** "30 November 2026 23:59 CET/CEST" -> Date or null. */
export function parseHumanDate(s) {
  const m = /^\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\s*([A-Z/]+)?\s*$/.exec(s || '');
  if (!m) return null;
  const mon = monthIndex(m[2]);
  if (mon === undefined) return null;
  const [year, day] = [+m[3], +m[1]];
  const hour = m[4] !== undefined ? +m[4] : 23;
  const minute = m[5] !== undefined ? +m[5] : 59;
  const tz = (m[6] || 'CET').toUpperCase();
  let offset = 0;
  if (tz.includes('CE')) offset = cetOffset(year, mon, day, hour);
  return new Date(Date.UTC(year, mon, day, hour - offset, minute));
}

/** "2026-11-03 13:44:14.986851+00:00" -> Date or null. */
export function parseTimestamp(s) {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}:?\d{2})?\s*$/.exec(s || '');
  if (!m) return null;
  const ms = m[7] ? Math.round(Number(`0.${m[7]}`) * 1000) : 0;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), ms);
  if (m[8] && m[8] !== 'Z') {
    const sign = m[8][0] === '-' ? -1 : 1;
    const digits = m[8].slice(1).replace(':', '');
    t -= sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4)) * 60000;
  }
  return new Date(t);
}

/** First successfully parsed date from a list of [parser, input] pairs. */
export function firstDate(...attempts) {
  for (const [parser, input] of attempts) {
    const d = parser(input);
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export const toIso = (d) => (d ? d.toISOString() : null);

/** "30 Nov 2026" in English, independent of the build machine's locale. */
export function formatDay(d) {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(d);
}

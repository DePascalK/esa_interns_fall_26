/**
 * Reference data: ESA sites and countries.
 * Edit here when ESA adds a site or the eligible-state list changes.
 */

/** ESA establishments. `match` is tested against the Location line and the Workplace column. */
export const SITES = [
  { id: 'ESTEC', name: 'ESTEC', city: 'Noordwijk', country: 'NL', match: [/\bESTEC\b/i, /\bNoordwijk\b/i] },
  { id: 'ESOC', name: 'ESOC', city: 'Darmstadt', country: 'DE', match: [/\bESOC\b/i, /\bDarmstadt\b/i] },
  { id: 'ESRIN', name: 'ESRIN', city: 'Frascati', country: 'IT', match: [/\bESRIN\b/i, /\bFrascati\b/i] },
  { id: 'ESAC', name: 'ESAC', city: 'Villanueva de la Cañada', country: 'ES', match: [/\bESAC\b/i, /Villanueva de la Ca/i] },
  { id: 'EAC', name: 'EAC', city: 'Cologne', country: 'DE', match: [/\bEAC\b/i, /\bCologne\b/i, /\bK[öo]ln\b/i] },
  { id: 'ECSAT', name: 'ECSAT', city: 'Harwell', country: 'GB', match: [/\bECSAT\b/i, /\bHarwell\b/i, /\bDidcot\b/i] },
  { id: 'ESEC', name: 'ESEC', city: 'Redu', country: 'BE', match: [/\bESEC\b/i, /\bRedu\b/i, /\bTransinne\b/i, /\bGalaxia\b/i] },
  { id: 'HQ', name: 'ESA HQ', city: 'Paris', country: 'FR', match: [/\bHeadquarters\b/i, /\bParis\b/i] },
  { id: 'TLS', name: 'Toulouse', city: 'Toulouse', country: 'FR', match: [/\bToulouse\b/i] },
  { id: 'BRU', name: 'Brussels office', city: 'Brussels', country: 'BE', match: [/\bBrussels\b/i] },
  { id: 'ESRIC', name: 'ESRIC', city: 'Luxembourg', country: 'LU', match: [/\bESRIC\b/i] },
  { id: 'CSG', name: "Europe's Spaceport", city: 'Kourou', country: 'GF', match: [/\bKourou\b/i, /\bCSG\b/] },
];

/** Countries that appear in ESA eligibility statements, with ISO 3166 codes. */
export const COUNTRIES = [
  ['AL', 'Albania'], ['AD', 'Andorra'], ['AT', 'Austria'], ['BE', 'Belgium'],
  ['BA', 'Bosnia and Herzegovina'], ['BG', 'Bulgaria'], ['CA', 'Canada'], ['HR', 'Croatia'],
  ['CY', 'Cyprus'], ['CZ', 'Czechia', /\bCzech Republic\b/], ['DK', 'Denmark'], ['EE', 'Estonia'],
  ['FI', 'Finland'], ['FR', 'France'], ['DE', 'Germany'], ['GR', 'Greece'], ['HU', 'Hungary'],
  ['IS', 'Iceland'], ['IE', 'Ireland'], ['IT', 'Italy'], ['LV', 'Latvia'], ['LI', 'Liechtenstein'],
  ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MT', 'Malta'], ['MD', 'Moldova'],
  ['ME', 'Montenegro'], ['NL', 'Netherlands'], ['MK', 'North Macedonia'], ['NO', 'Norway'],
  ['PL', 'Poland'], ['PT', 'Portugal'], ['RO', 'Romania'], ['RS', 'Serbia'], ['SK', 'Slovakia'],
  ['SI', 'Slovenia'], ['ES', 'Spain'], ['SE', 'Sweden'], ['CH', 'Switzerland'], ['UA', 'Ukraine'],
  ['GB', 'United Kingdom', /\bUK\b|\bGreat Britain\b/],
].map(([code, name, alias]) => ({
  code,
  name,
  pattern: new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b${alias ? `|${alias.source}` : ''}`, 'i'),
}));

export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

/** Country name -> code (exact or alias match), or null. */
export function countryCode(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  const hit = COUNTRIES.find((c) => c.pattern.test(s) && s.replace(c.pattern, '').trim().length <= 4);
  return hit ? hit.code : null;
}

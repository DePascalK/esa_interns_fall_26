/**
 * Internal links must include Astro's `base` (the site is served from a
 * sub-path on GitHub Pages). BASE_URL may or may not end with a slash.
 */
export function withBase(p = '') {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return prefix + String(p).replace(/^\/+/, '');
}

export const jobPath = (id) => withBase(`job/${encodeURIComponent(id)}/`);

/**
 * Overview tab: a field × site grid and a directorate bar list, computed
 * from the jobs that pass every filter except field and site (the grid's
 * own axes). Every number is a button that applies the matching filter.
 */
import { escapeHtml } from './format.js';

function countMatrix(jobs, disciplines, sites) {
  const cell = new Map();
  const rowTotal = new Map();
  const colTotal = new Map();
  for (const j of jobs) {
    colTotal.set(j.site, (colTotal.get(j.site) || 0) + 1);
    for (const d of j.disc) {
      rowTotal.set(d, (rowTotal.get(d) || 0) + 1);
      const k = `${d}|${j.site}`;
      cell.set(k, (cell.get(k) || 0) + 1);
    }
  }
  return {
    cell,
    rowTotal,
    colTotal,
    rows: disciplines.filter((d) => rowTotal.get(d.id)),
    cols: sites.filter((s) => colTotal.get(s.id)),
  };
}

/**
 * @param {{ gridEl: HTMLElement, dirsEl: HTMLElement, introEl: HTMLElement, jobs: object[], total: number,
 *           meta: {disciplines, sites, directorates}, onPick: (filters: object) => void }} opts
 */
export function renderOverview({ gridEl, dirsEl, introEl, jobs, total, meta, onPick }) {
  introEl.textContent =
    jobs.length === total
      ? `All ${total} internships in the current view.`
      : `${jobs.length} of ${total} internships — those matching your search and other filters (field and site filters are not applied here).`;

  const m = countMatrix(jobs, meta.disciplines, meta.sites);
  if (!m.rows.length) {
    gridEl.innerHTML = '<p class="muted">Nothing to show for the current filters.</p>';
  } else {
    const max = Math.max(1, ...m.cell.values());
    const head = m.cols
      .map((s) => `<th scope="col"><button type="button" class="ov-btn" data-site="${escapeHtml(s.id)}" title="${escapeHtml(s.label)}">${escapeHtml(s.name)}<span class="ov-total">${m.colTotal.get(s.id)}</span></button></th>`)
      .join('');
    let group = null;
    const body = m.rows
      .map((d) => {
        let sep = '';
        if (group !== d.technical) {
          group = d.technical;
          sep = `<tr class="ov-group"><th scope="rowgroup" colspan="${m.cols.length + 1}">${d.technical ? 'Technical & science' : 'Other fields'}</th></tr>`;
        }
        const cells = m.cols
          .map((s) => {
            const n = m.cell.get(`${d.id}|${s.id}`) || 0;
            if (!n) return '<td class="ov-cell ov-zero"><span aria-hidden="true">·</span><span class="visually-hidden">0</span></td>';
            const level = (0.15 + 0.85 * (n / max)).toFixed(2);
            return `<td class="ov-cell"><button type="button" class="ov-btn" style="--level:${level}" data-disc="${escapeHtml(d.id)}" data-site="${escapeHtml(s.id)}" aria-label="${n} in ${escapeHtml(d.label)} at ${escapeHtml(s.name)}">${n}</button></td>`;
          })
          .join('');
        return `${sep}<tr><th scope="row"><button type="button" class="ov-btn ov-row" data-disc="${escapeHtml(d.id)}">${escapeHtml(d.label)}<span class="ov-total">${m.rowTotal.get(d.id)}</span></button></th>${cells}</tr>`;
      })
      .join('');
    gridEl.innerHTML = `<table class="ov-table"><thead><tr><th scope="col"><span class="visually-hidden">Field</span></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  const dirCounts = new Map();
  jobs.forEach((j) => dirCounts.set(j.dir, (dirCounts.get(j.dir) || 0) + 1));
  const dirs = meta.directorates.filter((d) => dirCounts.get(d.id)).sort((a, b) => dirCounts.get(b.id) - dirCounts.get(a.id));
  const dmax = Math.max(1, ...dirCounts.values());
  dirsEl.innerHTML = dirs.length
    ? dirs
        .map((d) => {
          const n = dirCounts.get(d.id);
          return `<button type="button" class="bar" data-dir="${escapeHtml(d.id)}"><span class="bar-label">${escapeHtml(d.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${((n / dmax) * 100).toFixed(1)}%"></span></span><span class="bar-value">${n}</span></button>`;
        })
        .join('')
    : '<p class="muted">Nothing to show for the current filters.</p>';

  const pick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const f = {};
    if (btn.dataset.disc) f.disc = [btn.dataset.disc];
    if (btn.dataset.site) f.site = [btn.dataset.site];
    if (btn.dataset.dir) f.dir = [btn.dataset.dir];
    onPick(f);
  };
  gridEl.onclick = pick;
  dirsEl.onclick = pick;
}

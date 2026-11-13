/**
 * List page controller: one state object drives the list, the facet counts,
 * the active-filter chips, the overview and the URL (so every view can be
 * bookmarked or shared). Cards are server-rendered; this only shows, hides
 * and reorders them.
 */
import { applyStatuses, statusOf } from './status.js';
import { shortlist, bindShortlistButtons } from './shortlist.js';
import { loadIndex, runSearch, snippetHtml, textMatch } from './search.js';
import { escapeHtml } from './format.js';
import { renderOverview } from './overview.js';
import { readNationality, writeNationality } from './prefs.js';

const MULTI = ['focus', 'disc', 'site', 'dir'];
const GROUP_LABELS = { focus: 'Focus', disc: 'Field', site: 'Site', dir: 'Directorate' };
const STATUS_LABELS = { open: 'Open only', soon: 'Closing within 7 days', all: 'Including closed' };
const FOCUS_RANK = { technical: 0, mixed: 1, 'non-technical': 2 };
const NONE = new Set();

const blank = () => ({
  q: '', status: 'open', focus: [], disc: [], site: [], dir: [], nat: '', noec: false, short: false, sort: '', tab: 'explore',
});

export function initExplorer() {
  const app = document.getElementById('app');
  if (!app) return;
  const $ = (id) => document.getElementById(id);
  const list = $('job-list');
  const els = {
    search: $('search-input'), sort: $('sort-select'), count: $('result-count'), chips: $('active-filters'),
    empty: $('empty-state'), emptyHint: $('empty-hint'), emptyUndo: $('empty-undo'), emptyClear: $('empty-clear'),
    notice: $('notice'), nat: $('nat-select'), noec: $('noec-check'), short: $('short-check'),
    shortCount: $('short-count'), shortExport: $('short-export'), shortFeedback: $('short-feedback'),
    facets: $('facets'), facetsToggle: $('facets-toggle'), facetsToggleCount: $('facets-toggle-count'),
    clearAll: $('clear-all'), tabExplore: $('tab-explore'), tabOverview: $('tab-overview'),
    panelExplore: $('panel-explore'), panelOverview: $('panel-overview'),
  };
  const indexUrl = app.dataset.indexUrl;
  const meta = JSON.parse($('facet-meta').textContent);
  const now = Date.now();

  const jobs = [...list.querySelectorAll(':scope > .card')].map((el, i) => {
    const d = el.dataset;
    return {
      el,
      id: d.id,
      rank: Number(d.rank ?? i),
      focus: d.focus,
      disc: (d.disc || '').split(' ').filter(Boolean),
      site: d.site,
      dir: d.dir,
      closes: d.closes || '',
      posted: d.posted || '',
      nat: (d.nat || '').split(' ').filter(Boolean),
      ec: d.ec === '1',
      headline: d.headline || '',
      url: d.url || '',
      state: statusOf(d.closes, now).state,
      snippetEl: el.querySelector('.card-snippet'),
      summaryEl: el.querySelector('.card-summary'),
      text: el.textContent.replace(/\s+/g, ' '),
    };
  });
  const total = jobs.length;
  const anyOpen = jobs.some((j) => j.state !== 'closed');
  const defaultStatus = anyOpen ? 'open' : 'all';

  let s = blank();
  let results = null; // Map of search hits, or null when no query is active
  let searchFailed = false;
  let searchToken = 0;
  const changes = []; // order in which filters were added, for "Remove last filter"

  /* ------------------------------------------------------------- URL state */

  function readUrl() {
    const p = new URLSearchParams(location.search);
    const st = blank();
    st.q = p.get('q') || '';
    const status = p.get('status');
    st.status = ['open', 'soon', 'all'].includes(status) ? status : defaultStatus;
    for (const g of MULTI) st[g] = (p.get(g) || '').split(',').filter(Boolean);
    st.nat = p.get('nat') || '';
    st.noec = p.get('noec') === '1';
    st.short = p.get('short') === '1';
    st.sort = p.get('sort') || '';
    st.tab = p.get('tab') === 'overview' ? 'overview' : 'explore';
    if (!p.has('nat')) {
      const stored = readNationality();
      if (stored && els.nat && [...els.nat.options].some((o) => o.value === stored.code)) st.nat = stored.code;
    }
    return st;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.status !== defaultStatus) p.set('status', s.status);
    for (const g of MULTI) if (s[g].length) p.set(g, s[g].join(','));
    if (s.nat) p.set('nat', s.nat);
    if (s.noec) p.set('noec', '1');
    if (s.short) p.set('short', '1');
    if (s.sort) p.set('sort', s.sort);
    if (s.tab === 'overview') p.set('tab', 'overview');
    const qs = p.toString();
    try {
      history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
    } catch {
      /* some embedded contexts forbid history changes */
    }
  }

  /* --------------------------------------------------------------- filters */

  const queryActive = () => !!s.q && (results !== null || searchFailed);

  function matchesQuery(j) {
    if (!s.q) return true;
    if (results) return results.has(j.id);
    if (searchFailed) return textMatch(j.text, s.q);
    return true;
  }

  /** @param {Set<string>} skip  filter groups to ignore (used for facet counts) */
  function passes(j, skip = NONE) {
    if (!skip.has('q') && !matchesQuery(j)) return false;
    if (!skip.has('status')) {
      if (s.status === 'open' && j.state === 'closed') return false;
      if (s.status === 'soon' && j.state !== 'soon') return false;
    }
    for (const g of MULTI) {
      if (skip.has(g) || !s[g].length) continue;
      if (g === 'disc' ? !j.disc.some((x) => s.disc.includes(x)) : !s[g].includes(j[g])) return false;
    }
    if (!skip.has('nat') && s.nat && j.nat.length && !j.nat.includes(s.nat)) return false;
    if (!skip.has('noec') && s.noec && j.ec) return false;
    if (!skip.has('short') && s.short && !shortlist.has(j.id)) return false;
    return true;
  }

  function activeFilters() {
    const out = [];
    if (s.q) out.push({ group: 'q', value: s.q, text: `Search: “${s.q}”` });
    if (s.status !== defaultStatus) out.push({ group: 'status', value: s.status, text: `Status: ${STATUS_LABELS[s.status]}` });
    for (const g of MULTI) for (const v of s[g]) out.push({ group: g, value: v, text: `${GROUP_LABELS[g]}: ${optionLabel(g, v)}` });
    if (s.nat) out.push({ group: 'nat', value: s.nat, text: `Eligible: ${natName(s.nat)}` });
    if (s.noec) out.push({ group: 'noec', value: true, text: 'No export control' });
    if (s.short) out.push({ group: 'short', value: true, text: 'Shortlisted only' });
    return out;
  }

  function optionLabel(group, value) {
    const input = [...els.facets.querySelectorAll(`input[name="${group}"]`)].find((i) => i.value === value);
    return input?.closest('label')?.querySelector('.opt-label')?.textContent.trim() || value;
  }

  function natName(code) {
    return [...(els.nat?.options || [])].find((o) => o.value === code)?.textContent || code;
  }

  function withoutFilter(st, f) {
    const next = { ...st, ...Object.fromEntries(MULTI.map((g) => [g, [...st[g]]])) };
    if (f.group === 'q') next.q = '';
    else if (f.group === 'status') next.status = defaultStatus;
    else if (MULTI.includes(f.group)) next[f.group] = next[f.group].filter((v) => v !== f.value);
    else if (f.group === 'nat') next.nat = '';
    else if (f.group === 'noec') next.noec = false;
    else if (f.group === 'short') next.short = false;
    return next;
  }

  function removeFilter(f) {
    s = withoutFilter(s, f);
    if (f.group === 'q') {
      results = null;
      searchFailed = false;
      searchToken++;
    }
    if (f.group === 'nat') writeNationality('');
    render();
  }

  function record(group, value) {
    changes.push({ group, value });
  }

  function undoLast() {
    const active = activeFilters();
    while (changes.length) {
      const c = changes.pop();
      const hit = active.find((f) => f.group === c.group && (f.value === c.value || c.value === undefined));
      if (hit) return removeFilter(hit);
    }
    if (active.length) removeFilter(active[active.length - 1]);
  }

  function clearAll() {
    s = { ...blank(), status: defaultStatus, sort: s.sort === 'relevance' ? '' : s.sort, tab: s.tab };
    results = null;
    searchFailed = false;
    searchToken++;
    changes.length = 0;
    writeNationality('');
    render();
  }

  /* --------------------------------------------------------------- render */

  const closeKey = (j) => {
    const t = j.closes ? Date.parse(j.closes) : NaN;
    if (Number.isNaN(t)) return 9e15;
    return j.state === 'closed' ? 8e15 + t : t;
  };
  const SORTS = {
    tech: (a, b) => FOCUS_RANK[a.focus] - FOCUS_RANK[b.focus] || (a.state === 'closed') - (b.state === 'closed') || a.rank - b.rank,
    closing: (a, b) => closeKey(a) - closeKey(b) || a.rank - b.rank,
    newest: (a, b) => (b.posted || '').localeCompare(a.posted || '') || a.rank - b.rank,
    az: (a, b) => a.headline.localeCompare(b.headline),
    relevance: (a, b) => (results.get(b.id)?.score || 0) - (results.get(a.id)?.score || 0) || a.rank - b.rank,
  };

  function effectiveSort() {
    if (s.sort && s.sort !== 'relevance') return s.sort;
    return results ? 'relevance' : 'tech';
  }

  function render() {
    const visible = jobs.filter((j) => passes(j));
    visible.sort(SORTS[effectiveSort()]);
    const shown = new Set(visible);
    const desired = [...visible, ...jobs.filter((j) => !shown.has(j))];

    // Reorder only when the order changed (moving nodes loses keyboard focus).
    const current = [...list.children];
    if (desired.some((j, i) => current[i] !== j.el)) {
      const frag = document.createDocumentFragment();
      desired.forEach((j) => frag.appendChild(j.el));
      list.appendChild(frag);
    }
    for (const j of jobs) {
      j.el.hidden = !shown.has(j);
      const html = results && shown.has(j) ? snippetHtml(results.get(j.id)) : null;
      j.snippetEl.hidden = !html;
      if (html) j.snippetEl.innerHTML = html;
      // The snippet replaces the summary while searching (they often quote the same paragraph).
      if (j.summaryEl) j.summaryEl.hidden = !!html;
    }

    const n = visible.length;
    els.count.textContent =
      `${n} of ${total} internship${total === 1 ? '' : 's'}` + (queryActive() ? ` matching “${s.q}”` : '');
    list.hidden = n === 0;
    els.empty.hidden = n > 0;
    const done = $('facets-done');
    if (done) done.textContent = `Show ${n} internship${n === 1 ? '' : 's'}`;
    if (!n) els.emptyHint.textContent = emptyHint();

    syncControls();
    updateCounts();
    renderChips();
    if (s.tab === 'overview') drawOverview();
    writeUrl();
  }

  function emptyHint() {
    const saved = s;
    let best = null;
    for (const f of activeFilters()) {
      s = withoutFilter(saved, f);
      const count = jobs.filter((j) => passes(j, f.group === 'q' ? new Set(['q']) : NONE)).length;
      s = saved;
      if (count && (!best || count > best.count)) best = { f, count };
    }
    if (!best) return 'Try a different search or clear the filters.';
    const n = best.count;
    return `${n} internship${n === 1 ? '' : 's'} match${n === 1 ? 'es' : ''} without the filter ${best.f.text}.`;
  }

  function syncControls() {
    if (document.activeElement !== els.search && els.search.value !== s.q) els.search.value = s.q;
    for (const input of els.facets.querySelectorAll('input[name="status"]')) input.checked = input.value === s.status;
    for (const g of MULTI) {
      for (const input of els.facets.querySelectorAll(`input[name="${g}"]`)) input.checked = s[g].includes(input.value);
    }
    if (els.nat) els.nat.value = s.nat;
    if (els.noec) els.noec.checked = s.noec;
    if (els.short) els.short.checked = s.short;

    const relevance = els.sort.querySelector('option[value="relevance"]');
    relevance.disabled = !results;
    els.sort.value = effectiveSort();

    const n = activeFilters().filter((f) => f.group !== 'q').length;
    els.facetsToggleCount.textContent = n ? `(${n})` : '';
  }

  function setCount(el, n) {
    el.textContent = String(n);
    const label = el.closest('label');
    const input = label?.querySelector('input');
    if (!input) return;
    const dead = n === 0 && !input.checked;
    input.disabled = dead;
    label.classList.toggle('is-empty', dead);
  }

  function updateCounts() {
    const byKey = new Map();
    const statusPool = jobs.filter((j) => passes(j, new Set(['status'])));
    byKey.set('status:open', statusPool.filter((j) => j.state !== 'closed').length);
    byKey.set('status:soon', statusPool.filter((j) => j.state === 'soon').length);
    byKey.set('status:all', statusPool.length);
    for (const g of MULTI) {
      for (const j of jobs) {
        if (!passes(j, new Set([g]))) continue;
        for (const v of g === 'disc' ? j.disc : [j[g]]) byKey.set(`${g}:${v}`, (byKey.get(`${g}:${v}`) || 0) + 1);
      }
    }
    byKey.set('ec:yes', jobs.filter((j) => j.ec && passes(j, new Set(['noec']))).length);
    for (const el of els.facets.querySelectorAll('[data-count-for]')) setCount(el, byKey.get(el.dataset.countFor) || 0);
    els.shortCount.textContent = String(shortlist.size);
  }

  function renderChips() {
    const filters = activeFilters();
    els.chips.innerHTML =
      filters
        .map(
          (f, i) =>
            `<button type="button" class="filter-chip" data-i="${i}">${escapeHtml(f.text)}<span aria-hidden="true" class="x">×</span><span class="visually-hidden"> (remove)</span></button>`,
        )
        .join('') + (filters.length > 1 ? '<button type="button" class="link-btn" data-clear="1">Clear all</button>' : '');
    els.chips.hidden = filters.length === 0;
    els.chips.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.clear) return clearAll();
      const f = filters[Number(btn.dataset.i)];
      if (f) removeFilter(f);
    };
  }

  /* -------------------------------------------------------------- search */

  async function applyQuery(raw) {
    const q = raw.trim();
    const wasEmpty = !s.q;
    s.q = q;
    const token = ++searchToken;
    if (!q) {
      results = null;
      searchFailed = false;
      render();
      return;
    }
    if (wasEmpty) record('q');
    els.count.textContent = 'Searching…';
    try {
      const r = await runSearch(indexUrl, q);
      if (token !== searchToken) return;
      results = r;
      searchFailed = false;
    } catch (err) {
      if (token !== searchToken) return;
      console.warn('Search index unavailable, using plain text matching:', err);
      results = null;
      searchFailed = true;
    }
    render();
  }

  let debounce;
  els.search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => applyQuery(els.search.value), 160);
  });
  els.search.addEventListener('focus', () => loadIndex(indexUrl).catch(() => {}), { once: true });
  els.search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.search.value) {
      e.preventDefault();
      els.search.value = '';
      applyQuery('');
    }
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      e.preventDefault();
      if (s.tab !== 'explore') setTab('explore');
      els.search.focus();
      els.search.select();
    }
  });

  /* -------------------------------------------------------------- controls */

  els.facets.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'status') {
      s.status = t.value;
      record('status', t.value);
    } else if (MULTI.includes(t.name)) {
      s[t.name] = t.checked ? [...s[t.name], t.value] : s[t.name].filter((v) => v !== t.value);
      if (t.checked) record(t.name, t.value);
    } else if (t === els.nat) {
      s.nat = t.value;
      writeNationality(s.nat, natName(s.nat));
      if (s.nat) record('nat', s.nat);
    } else if (t === els.noec) {
      s.noec = t.checked;
      if (t.checked) record('noec', true);
    } else if (t === els.short) {
      s.short = t.checked;
      if (t.checked) record('short', true);
    } else {
      return;
    }
    render();
  });

  els.sort.addEventListener('change', () => {
    s.sort = els.sort.value === 'relevance' ? '' : els.sort.value;
    render();
  });

  els.clearAll.addEventListener('click', clearAll);
  els.emptyClear.addEventListener('click', clearAll);
  els.emptyUndo.addEventListener('click', undoLast);

  // Small screens: the filter panel opens above the list; "Show results" closes it again.
  const setFacetsOpen = (open) => {
    els.facets.classList.toggle('is-open', open);
    els.facetsToggle.setAttribute('aria-expanded', String(open));
    if (open) els.facets.scrollIntoView({ block: 'start' });
  };
  els.facetsToggle.addEventListener('click', () => setFacetsOpen(!els.facets.classList.contains('is-open')));
  $('facets-done')?.addEventListener('click', () => {
    setFacetsOpen(false);
    els.search.closest('.toolbar').scrollIntoView({ block: 'start' });
    els.facetsToggle.focus({ preventScroll: true });
  });

  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
    const kbd = document.querySelector('.search-kbd');
    if (kbd) kbd.textContent = '⌘ K';
  }

  /* ------------------------------------------------------------- shortlist */

  bindShortlistButtons(list);
  shortlist.onChange(() => (s.short ? render() : updateCounts()));

  els.shortExport.addEventListener('click', async () => {
    const items = jobs.filter((j) => shortlist.has(j.id));
    const say = (msg) => {
      els.shortFeedback.textContent = msg;
    };
    if (!items.length) return say('Your shortlist is empty. Use the star on a posting to add it.');
    const text = items.map((j) => `${j.headline}\n${j.url}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      say(`Copied ${items.length} link${items.length === 1 ? '' : 's'} to the clipboard.`);
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = 'esa-internship-shortlist.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      say('Downloaded your shortlist as a text file.');
    }
  });

  /* ------------------------------------------------------------------ tabs */

  function drawOverview() {
    renderOverview({
      gridEl: $('overview-grid'),
      dirsEl: $('overview-dirs'),
      introEl: $('overview-intro'),
      jobs: jobs.filter((j) => passes(j, new Set(['disc', 'site']))),
      total,
      meta,
      onPick: (f) => {
        if (f.dir) {
          s.dir = f.dir;
          record('dir', f.dir[0]);
        } else {
          s.disc = f.disc || [];
          s.site = f.site || [];
          if (f.disc) record('disc', f.disc[0]);
          if (f.site) record('site', f.site[0]);
        }
        setTab('explore');
        render();
        els.panelExplore.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
  }

  function setTab(tab) {
    s.tab = tab;
    const ov = tab === 'overview';
    els.tabExplore.setAttribute('aria-selected', String(!ov));
    els.tabOverview.setAttribute('aria-selected', String(ov));
    els.tabExplore.tabIndex = ov ? -1 : 0;
    els.tabOverview.tabIndex = ov ? 0 : -1;
    els.panelExplore.hidden = ov;
    els.panelOverview.hidden = !ov;
    if (ov) drawOverview();
    writeUrl();
  }

  els.tabExplore.addEventListener('click', () => setTab('explore'));
  els.tabOverview.addEventListener('click', () => setTab('overview'));
  for (const tab of [els.tabExplore, els.tabOverview]) {
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = s.tab === 'explore' ? 'overview' : 'explore';
      setTab(next);
      (next === 'overview' ? els.tabOverview : els.tabExplore).focus();
    });
  }

  /* ------------------------------------------------------------------ init */

  if (!anyOpen && total) {
    els.notice.hidden = false;
    els.notice.textContent =
      (total === 1 ? 'The only internship in this dataset has closed' : `All ${total} internships in this dataset have closed`) +
      (app.dataset.dataAsOf ? ` (data from ${app.dataset.dataAsOf})` : '') +
      '. They are listed for reference — check jobs.esa.int for current openings.';
  }

  applyStatuses(list, now);
  s = readUrl();
  setTab(s.tab);
  if (s.q) applyQuery(s.q);
  else render();
}

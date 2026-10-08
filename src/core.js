const CORE = (() => {
  const DAILY_LIMIT = 12;
  const COOLDOWN_MS = 30_000;
  const keyForDay = date => new Date(date).toISOString().slice(0, 10);
  const isNotePath = path => /^\/(explore|discovery\/item)\/[^/]+\/?$/.test(path) || /^\/user\/profile\/[^/]+\/[^/]+\/?$/.test(path);
  function canonicalNoteUrl(input) {
    const url = new URL(input);
    if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(url.hostname) || !isNotePath(url.pathname)) throw new Error('unsupported_page');
    return `https://www.xiaohongshu.com${url.pathname.replace(/\/$/, '')}`;
  }
  function gate(history, now = Date.now()) {
    const today = keyForDay(now);
    const attempts = history.filter(v => keyForDay(v) === today);
    if (attempts.length >= DAILY_LIMIT) return { ok: false, reason: 'daily_limit' };
    const last = history.length ? Math.max(...history) : 0;
    if (now - last < COOLDOWN_MS) return { ok: false, reason: 'cooldown', seconds: Math.ceil((COOLDOWN_MS - now + last) / 1000) };
    return { ok: true };
  }
  function normalizeNote(raw, edits = {}) {
    return {
      id: crypto.randomUUID(),
      url: canonicalNoteUrl(raw.url),
      title: String(edits.title ?? raw.title ?? '').trim().slice(0, 180),
      author: String(edits.author ?? raw.author ?? '').trim().slice(0, 100),
      excerpt: String(edits.excerpt ?? raw.excerpt ?? '').trim().slice(0, 1800),
      visibleMetrics: String(edits.visibleMetrics ?? raw.visibleMetrics ?? '').trim().slice(0, 300),
      insight: String(edits.insight ?? '').trim().slice(0, 600),
      capturedAt: raw.capturedAt || new Date().toISOString(),
      source: raw.source === 'visible-page-optional-automation' ? raw.source : 'visible-page-manual'
    };
  }
  function exportCsv(notes) {
    const fields = ['title', 'author', 'url', 'excerpt', 'visibleMetrics', 'insight', 'capturedAt'];
    const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
    return '\uFEFF' + [fields.join(','), ...notes.map(n => fields.map(f => quote(n[f])).join(','))].join('\r\n');
  }
  return { DAILY_LIMIT, COOLDOWN_MS, isNotePath, canonicalNoteUrl, gate, normalizeNote, exportCsv };
})();
if (typeof module !== 'undefined') module.exports = CORE;

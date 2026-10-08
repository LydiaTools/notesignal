/* Read only the result cards visible in the current search viewport. */
(() => {
  const url = new URL(location.href);
  if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(url.hostname) || url.pathname !== '/search_result') return { error: 'unsupported_page' };
  const text = (document.body?.innerText || '').slice(0, 800);
  if (/请完成安全验证|滑动滑块完成拼图|账号异常|访问受限/.test(text)) return { error: 'verification_required' };
  const seen = new Set();
  const results = [];
  for (const a of document.querySelectorAll('a[href*="/explore/"],a[href*="/discovery/item/"]')) {
    const rect = a.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight) continue;
    let noteUrl;
    try { noteUrl = new URL(a.href, location.href); } catch { continue; }
    if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(noteUrl.hostname) || !/^\/(explore|discovery\/item)\/[^/]+\/?$/.test(noteUrl.pathname)) continue;
    const canonical = `https://www.xiaohongshu.com${noteUrl.pathname.replace(/\/$/, '')}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const card = a.closest('article,section,li') || a;
    const title = (a.innerText || card.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 110);
    results.push({ url: canonical, title });
    if (results.length >= 12) break;
  }
  return { results };
})()

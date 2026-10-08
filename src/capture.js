/* Executed only after the user presses Capture in the popup. */
(async () => {
  const url = new URL(location.href);
  if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(url.hostname) || !/^\/(explore|discovery\/item)\/[^/]+\/?$/.test(url.pathname) && !/^\/user\/profile\/[^/]+\/[^/]+\/?$/.test(url.pathname)) {
    return { error: 'unsupported_page' };
  }
  const hasWarning = () => /验证码|安全验证|账号异常|访问受限|captcha|verify your identity|请完成安全验证|滑动滑块完成拼图/i.test((document.title + ' ' + (document.body?.innerText || '').slice(0, 900)));
  if (hasWarning()) return { error: 'verification_required' };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visibleFor = performance.now();
  await wait(Math.max(3000, 6000 - visibleFor) + Math.floor(Math.random() * 1200));
  if (document.visibilityState !== 'visible') return { error: 'page_hidden' };
  if (hasWarning()) return { error: 'verification_required' };
  if (document.documentElement.scrollHeight > innerHeight * 1.2) {
    scrollBy({ top: Math.min(240, Math.floor(innerHeight * 0.28)), behavior: 'smooth' });
    await wait(650);
  }
  const pageText = document.body?.innerText || '';
  if (hasWarning()) {
    return { error: 'verification_required' };
  }
  const pick = selectors => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.innerText?.trim();
      if (value) return value;
    }
    return '';
  };
  const title = pick(['h1', '.title', '[class*="note-title"]', '[class*="title"]']) || document.title.replace(/ - 小红书.*/, '');
  const author = pick(['[class*="author"] [class*="name"]', '[class*="user-name"]', '[class*="author"]']) || '';
  const body = pick(['[class*="note-content"]', '[class*="desc"]', '[class*="content"]']) || '';
  const selected = String(getSelection() || '').trim();
  const visibleExcerpt = (selected || body || pageText).slice(0, 1800);
  const metricText = pick(['[class*="engage"]', '[class*="interaction"]']) || '';
  return {
    url: url.origin + url.pathname,
    title: title.slice(0, 180),
    author: author.slice(0, 100),
    excerpt: visibleExcerpt,
    visibleMetrics: metricText.slice(0, 300),
    capturedAt: new Date().toISOString()
  };
})()

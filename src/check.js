(() => {
  const url = new URL(location.href);
  if (!['www.xiaohongshu.com', 'xiaohongshu.com'].includes(url.hostname)) return { clean: false };
  const text = document.title + ' ' + (document.body?.innerText || '').slice(0, 900);
  return { clean: !/验证码|安全验证|账号异常|访问受限|captcha|verify your identity|请完成安全验证|滑动滑块完成拼图/i.test(text) };
})()

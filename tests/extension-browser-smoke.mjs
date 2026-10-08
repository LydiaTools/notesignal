import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const extensionDir = path.resolve(process.argv[2] || '.');
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'notesignal-smoke-'));
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`
  ]
});

try {
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const extensionId = await extensionsPage.waitForFunction(() => {
    const manager = document.querySelector('extensions-manager')?.shadowRoot;
    const list = manager?.querySelector('extensions-item-list')?.shadowRoot;
    const item = [...(list?.querySelectorAll('extensions-item') || [])]
      .find(node => (node.data?.name || '').includes('NoteSignal'));
    return item?.data?.id || null;
  }, null, { timeout: 15000 }).then(handle => handle.jsonValue());
  assert.match(extensionId, /^[a-p]{32}$/);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await popup.waitForFunction(() => document.querySelector('#brand-name')?.textContent === 'Xiaohongshu NoteSignal');
  assert.equal(await popup.locator('#brand-name').innerText(), 'Xiaohongshu NoteSignal');

  const manifest = await popup.evaluate(() => chrome.runtime.getManifest());
  assert.equal(manifest.version, '0.1.1');
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);

  await popup.locator('#lang').click();
  await popup.waitForFunction(() => document.querySelector('#brand-name')?.textContent === '小红书笔记风向标');
  assert.equal(await popup.locator('#brand-name').innerText(), '小红书笔记风向标');
  await popup.reload();
  await popup.waitForFunction(() => document.querySelector('#brand-name')?.textContent === '小红书笔记风向标');
  assert.equal(await popup.locator('#brand-name').innerText(), '小红书笔记风向标');

  await popup.locator('#capture-button').click();
  await popup.waitForFunction(() => document.querySelector('#status')?.textContent === '请先打开一篇小红书笔记。');
  assert.equal(await popup.locator('#status').innerText(), '请先打开一篇小红书笔记。');
  await popup.locator('#tab-library').click();
  assert.match(await popup.locator('#notes').innerText(), /还没有笔记/);

  console.log(JSON.stringify({
    result: 'PASS',
    releaseVersion: manifest.version,
    checks: ['extension loaded', 'popup opened', 'Chinese choice persisted', 'non-note capture stopped', 'empty library rendered']
  }));
} finally {
  await context.close();
}

const {test}=require('node:test');
const assert=require('node:assert/strict');
const CORE=require('../src/core.js');
test('capture gate enforces cooldown and daily budget',()=>{
  const now=Date.UTC(2026,9,8,10,0,0);
  assert.equal(CORE.gate([],now).ok,true);
  assert.equal(CORE.gate([now-20_000],now).reason,'cooldown');
  assert.equal(CORE.gate(Array.from({length:12},(_,i)=>now-100_000-i*31_000),now).reason,'daily_limit');
});
test('normalization strips share tokens and preserves user edits',()=>{
  const note=CORE.normalizeNote({url:'https://www.xiaohongshu.com/explore/abc?xsec_token=secret',title:'raw',excerpt:'visible'},{title:'checked',visibleMetrics:'12 likes'});
  assert.equal(note.url,'https://www.xiaohongshu.com/explore/abc');
  assert.equal(note.title,'checked');
  assert.equal(note.visibleMetrics,'12 likes');
  assert.equal(note.source,'visible-page-manual');
});
test('capture accepts note routes but rejects profile and search pages',()=>{
  assert.equal(CORE.isNotePath('/explore/abc'),true);
  assert.equal(CORE.isNotePath('/user/profile/user123/note456'),true);
  assert.equal(CORE.isNotePath('/user/profile/user123'),false);
  assert.equal(CORE.isNotePath('/search_result'),false);
  assert.equal(CORE.canonicalNoteUrl('https://xiaohongshu.com/explore/abc/?xsec_token=secret'),'https://www.xiaohongshu.com/explore/abc');
});
test('CSV safely quotes creator text',()=>{
  const csv=CORE.exportCsv([{title:'a,"b"',author:'x',url:'https://example.com',excerpt:'line\nbreak'}]);
  assert.ok(csv.includes('"a,""b"""'));
  assert.ok(csv.includes('"line\nbreak"'));
});
test('optional automation records keep distinct provenance on import',()=>{
  const note=CORE.normalizeNote({url:'https://www.xiaohongshu.com/explore/abc',title:'Demo',source:'visible-page-optional-automation'});
  assert.equal(note.source,'visible-page-optional-automation');
});

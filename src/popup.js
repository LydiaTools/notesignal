const STRINGS = {
  en: {
    brandName:'Xiaohongshu NoteSignal',subtitle:'Research from the page you can see',capture:'Capture',library:'Library',brief:'Brief',
    hero:'One page. One deliberate capture.',desc:'Collect a visible Xiaohongshu note into your private research library.',
    open:'Open a note in your signed-in browser.',doCapture:'Review and save only this page.',
    captureButton:'Capture current note',title:'Title',author:'Author',excerpt:'Visible excerpt',metrics:'Visible metrics (check on page)',insight:'Why does this work? Add your own observation.',save:'Save to library',
    searchIntro:'On a search page? Review only the result cards currently visible, then choose a note yourself.',searchButton:'Review visible results',searchEmpty:'No visible note links found. Scroll the page yourself and try again.',searchOpen:'Open note',searchSaved:'Saved',
    safety:'No background scan, automatic pagination, hidden API, cookie export or scheduled collection. A capture waits briefly and makes one small visible scroll. Local default: 30 seconds between captures and 12 per day; these are product guardrails, not a platform-approved threshold.',
    saved:'Saved locally.',duplicate:'This note is already in your library.',unsupported:'Open an individual Xiaohongshu note first.',verify:'Verification or account warning detected. Collection is paused.',halted:'Collection is paused. Resolve the warning in the browser, then recheck.',resume:'Recheck current page',stillVerify:'The current page still shows a warning.',resumed:'Current page is clear. You can continue.',hidden:'Keep the note tab visible while capturing.',pacing:'Reading this note after a short dwell…',
    failed:'Could not read this page. Try another visible note or copy text manually.',cooldown:'Wait {n} seconds before another capture.',daily_limit:'Today’s capture limit is reached. Continue tomorrow.',
    libraryTitle:'Saved notes',empty:'No notes yet. Open a note and capture it deliberately.',count:'{n} notes',delete:'Remove',exportCsv:'Download CSV',exportJson:'Download JSON',importJson:'Import runner JSON',imported:'Imported {n} new notes. Review each source.',importFailed:'Could not import this NoteSignal JSON.',
    briefTitle:'Research brief',briefIntro:'A starting point from your own saved observations. Review sources before writing.',
    briefEmpty:'Save at least one note to build a brief.',copy:'Copy brief',copied:'Copied.',footer:'Stored on this device only',
    briefHead:'Topic signals from saved notes',briefItem:'Source',briefAngle:'Your observation',briefEnd:'Next: compare audience, hook, proof, and your original angle. Do not copy source text into a post.'
  },
  zh: {
    brandName:'小红书笔记风向标',subtitle:'从你看得到的页面做研究',capture:'采集',library:'资料库',brief:'选题简报',
    hero:'一页一次，主动采集。',desc:'把当前可见的小红书笔记存进本地研究资料库。',
    open:'先在已登录浏览器打开一篇笔记。',doCapture:'核对当前页，再决定是否保存。',
    captureButton:'采集当前笔记',title:'标题',author:'作者',excerpt:'可见内容摘录',metrics:'页面可见指标（请核对）',insight:'它为什么有效？写下你的判断。',save:'保存到资料库',
    searchIntro:'正在搜索页？只查看当前屏幕里的结果，再由你选择要打开的笔记。',searchButton:'查看当前可见结果',searchEmpty:'当前屏幕没有找到笔记链接。请自行滚动页面后再试。',searchOpen:'打开笔记',searchSaved:'已保存',
    safety:'不后台扫描、不自动翻页、不调用隐藏接口、不导出 Cookie、不定时采集。采集前短暂停留并在当前页小幅滚动一次。默认间隔 30 秒、每日最多 12 次；这是产品保守限制，不代表平台认可的安全阈值。',
    saved:'已保存到本机。',duplicate:'这篇笔记已在资料库中。',unsupported:'请先打开一篇小红书笔记。',verify:'检测到验证或账号异常，采集已暂停。',halted:'采集已暂停。请先在浏览器处理异常，再重新检查。',resume:'重新检查当前页',stillVerify:'当前页仍显示异常提示。',resumed:'当前页已正常，可以继续。',hidden:'采集时请保持笔记标签页可见。',pacing:'短暂停留后正在读取这篇笔记…',
    failed:'未能读取当前页。请换一篇可见笔记，或自行整理内容。',cooldown:'请等待 {n} 秒再采集。',daily_limit:'今天已达到采集上限，明天再继续。',
    libraryTitle:'已存笔记',empty:'还没有笔记。打开一篇笔记后主动采集。',count:'{n} 篇',delete:'移除',exportCsv:'下载 CSV',exportJson:'下载 JSON',importJson:'导入脚本 JSON',imported:'已导入 {n} 篇新笔记，请核对来源。',importFailed:'无法导入这个 NoteSignal JSON。',
    briefTitle:'选题简报',briefIntro:'基于你保存的观察生成起点；写稿前要核对原页面。',
    briefEmpty:'先保存至少一篇笔记。',copy:'复制简报',copied:'已复制。',footer:'资料仅存本机',
    briefHead:'已存笔记的选题信号',briefItem:'来源',briefAngle:'你的观察',briefEnd:'下一步：比较受众、开头、证据与自己的独特角度；不要照搬原文。'
  }
};
let lang='en',notes=[],history=[],pending=null,halted=false;
const $=id=>document.getElementById(id);
const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replace('{'+k+'}',v),STRINGS[lang][key]);
async function readState(){const data=await chrome.storage.local.get(['lang','notes','history','halted']);lang=data.lang||'en';notes=data.notes||[];history=data.history||[];halted=!!data.halted;render();}
function render(){
  document.documentElement.lang=lang; $('lang').textContent=lang==='en'?'中文':'English';
  const ids={'brand-name':'brandName',subtitle:'subtitle','tab-capture':'capture','tab-library':'library','tab-brief':'brief','hero-title':'hero','hero-desc':'desc','step-open':'open','step-capture':'doCapture','capture-button':'captureButton','resume-button':'resume','label-title':'title','label-author':'author','label-excerpt':'excerpt','label-metrics':'metrics','label-insight':'insight','save-button':'save','search-intro':'searchIntro','search-button':'searchButton','safety-note':'safety','library-title':'libraryTitle','brief-title':'briefTitle','brief-intro':'briefIntro','copy-brief':'copy','export-csv':'exportCsv','export-json':'exportJson','import-json':'importJson','footer-text':'footer'};
  for(const [id,key] of Object.entries(ids)) $(id).textContent=t(key);
  $('resume-button').hidden=!halted;
  if(halted)showStatus('halted');
  $('count').textContent=t('count',{n:notes.length}); renderNotes();renderBrief();
}
function renderNotes(){
  $('notes').replaceChildren();
  if(!notes.length){const p=document.createElement('p');p.textContent=t('empty');$('notes').append(p);return;}
  for(const note of [...notes].reverse()){
    const article=document.createElement('article');article.className='note';
    const link=document.createElement('a');link.href=note.url;link.target='_blank';link.rel='noreferrer';link.textContent=note.title||note.url;
    const meta=document.createElement('span');meta.className='meta';meta.textContent=[note.author,new Date(note.capturedAt).toLocaleString()].filter(Boolean).join(' · ');
    const insight=document.createElement('p');insight.textContent=note.insight||note.excerpt;
    const metrics=document.createElement('span');metrics.className='meta';metrics.textContent=note.visibleMetrics||'';
    const remove=document.createElement('button');remove.textContent=t('delete');remove.onclick=async()=>{notes=notes.filter(n=>n.id!==note.id);await chrome.storage.local.set({notes});render();};
    article.append(link,meta,metrics,insight,remove);$('notes').append(article);
  }
}
function briefText(){
  if(!notes.length)return t('briefEmpty');
  return [t('briefHead'),'',
    ...notes.map((n,i)=>`${i+1}. ${n.title}\n${t('briefItem')}: ${n.url}\n${t('metrics')}: ${n.visibleMetrics||'—'}\n${t('briefAngle')}: ${n.insight||'—'}\n`),
    t('briefEnd')].join('\n');
}
function renderBrief(){$('brief-content').textContent=briefText();}
function showStatus(key,vars={}){$('status').textContent=t(key,vars);}
async function pauseCollection(){halted=true;await chrome.storage.local.set({halted:true});$('resume-button').hidden=false;showStatus('verify');}
function download(name,type,value){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelectorAll('nav button').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b===btn));
  document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==btn.dataset.tab);
});
$('lang').onclick=async()=>{lang=lang==='en'?'zh':'en';await chrome.storage.local.set({lang});render();};
$('resume-button').onclick=async()=>{
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/check.js']});
    if(!result?.result?.clean){showStatus('stillVerify');return;}
    halted=false;await chrome.storage.local.set({halted:false});$('resume-button').hidden=true;showStatus('resumed');
  }catch{showStatus('stillVerify');}
};
$('search-button').onclick=async()=>{
  if(halted){showStatus('halted');return;}
  const container=$('search-results');container.replaceChildren();
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const url=new URL(tab?.url||'about:blank');
    if(!['www.xiaohongshu.com','xiaohongshu.com'].includes(url.hostname)||url.pathname!=='/search_result'){showStatus('unsupported');return;}
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/search.js']});
    const data=result?.result;
    if(data?.error){if(data.error==='verification_required')await pauseCollection();else showStatus('unsupported');return;}
    if(!data?.results?.length){container.textContent=t('searchEmpty');return;}
    for(const item of data.results){
      const row=document.createElement('div');row.className='result';
      const link=document.createElement('a');link.href=CORE.canonicalNoteUrl(item.url);link.target='_blank';link.rel='noreferrer';link.textContent=item.title||t('searchOpen');
      const marker=document.createElement('span');marker.textContent=notes.some(n=>n.url===link.href)?t('searchSaved'):t('searchOpen');
      row.append(link,marker);container.append(row);
    }
    $('status').textContent='';
  }catch{showStatus('failed');}
};
$('capture-button').onclick=async()=>{
  if(halted){showStatus('halted');return;}
  const gate=CORE.gate(history);if(!gate.ok){showStatus(gate.reason,gate.seconds?{n:gate.seconds}:{});return;}
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url||!/^https:\/\/(www\.)?xiaohongshu\.com\//.test(tab.url)||!CORE.isNotePath(new URL(tab.url).pathname)){showStatus('unsupported');return;}
    const canonical=CORE.canonicalNoteUrl(tab.url);
    if(notes.some(note=>note.url===canonical)){showStatus('duplicate');return;}
    history.push(Date.now());await chrome.storage.local.set({history});
    $('capture-button').disabled=true;showStatus('pacing');
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['src/capture.js']});
    const raw=result?.result;
    if(raw?.error){if(raw.error==='verification_required')await pauseCollection();else showStatus(raw.error==='page_hidden'?'hidden':'unsupported');return;}
    if(!raw?.title&&!raw?.excerpt){showStatus('failed');return;}
    pending=raw;
    $('note-title').value=raw.title||'';$('note-author').value=raw.author||'';$('note-excerpt').value=raw.excerpt||'';$('note-metrics').value=raw.visibleMetrics||'';$('note-insight').value='';
    $('editor').hidden=false;$('status').textContent='';
  }catch(error){showStatus('failed');}finally{$('capture-button').disabled=false;}
};
$('editor').onsubmit=async event=>{
  event.preventDefault();if(!pending)return;
  const note=CORE.normalizeNote(pending,{title:$('note-title').value,author:$('note-author').value,excerpt:$('note-excerpt').value,visibleMetrics:$('note-metrics').value,insight:$('note-insight').value});
  notes.push(note);await chrome.storage.local.set({notes});pending=null;$('editor').hidden=true;showStatus('saved');render();
};
$('export-csv').onclick=()=>download('notesignal.csv','text/csv;charset=utf-8',CORE.exportCsv(notes));
$('export-json').onclick=()=>download('notesignal.json','application/json',JSON.stringify(notes,null,2));
$('import-json').onclick=()=>$('import-file').click();
$('import-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>2_000_000)throw new Error('too_large');
    const data=JSON.parse(await file.text());
    if(data.schema!==1||!Array.isArray(data.records)||data.records.length>500)throw new Error('unsupported');
    const known=new Set(notes.map(n=>n.url));let imported=0;
    for(const raw of data.records){
      if(!raw||typeof raw!=='object')continue;
      let url;try{url=CORE.canonicalNoteUrl(raw.url);}catch{continue;}
      if(known.has(url)||(!raw.title&&!raw.excerpt))continue;
      notes.push(CORE.normalizeNote({...raw,url,source:'visible-page-optional-automation'}));known.add(url);imported++;
    }
    await chrome.storage.local.set({notes});render();$('library-status').textContent=t('imported',{n:imported});
  }catch{$('library-status').textContent=t('importFailed');}
  event.target.value='';
};
$('copy-brief').onclick=async()=>{await navigator.clipboard.writeText(briefText());$('copy-brief').textContent=t('copied');};
readState();

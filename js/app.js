const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let doc=null,quiz=[],qi=0,score=0,difficulty='mixed',cards=[],ci=0,cardFlipped=false;
const DB='studywell-db-v3', STORE='documents';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)};
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveDoc(d){try{const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:d.id,name:d.name,pages:d.pagesData,pageInfo:d.pageInfo||d.pageInfoData||[],created:d.created});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}catch(e){console.warn('Local save unavailable',e)}}
async function listDocs(){try{const db=await openDB();return await new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}catch{return[]}}
async function deleteDoc(id){const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getDoc(id){const db=await openDB();return await new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function show(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));if(id==='exam')renderExam();if(id==='cards')renderCards();if(id==='home')renderHome();if(id==='ask')renderSuggestions();if(id==='library')renderDocs();window.scrollTo({top:0,behavior:'smooth'});$('.sidebar')?.classList.remove('open')}
$$('#tabs button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.tab)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));
$('#mobileMenu').onclick=()=>$('.sidebar').classList.toggle('open');
$('#collapseSidebar').onclick=()=>{const side=$('.sidebar');side.classList.toggle('collapsed');localStorage.setItem('studywell-sidebar-collapsed',side.classList.contains('collapsed')?'1':'0')};
if(localStorage.getItem('studywell-sidebar-collapsed')==='1')$('.sidebar')?.classList.add('collapsed');

$('#themeBtn').onclick=()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('studywell-theme',document.documentElement.classList.contains('dark')?'dark':'light')};
if(localStorage.getItem('studywell-theme')==='dark')document.documentElement.classList.add('dark');
const needDoc=el=>{el.innerHTML=`<div class="empty"><b>Add a PDF first</b>Import your notes in Library and this space will come alive.<br><button class="primary-btn" data-go="library" style="margin-top:14px">Open Library</button></div>`;el.querySelector('[data-go]')?.addEventListener('click',()=>show('library'))};
function docStats(){return doc?{pages:doc.pages,chunks:doc.chunks.length,topics:StudyEngine.examTopics(doc,8).length}:null}
function renderHome(){
 const stats=$('#homeStats'); if(!doc){stats.innerHTML=['Documents','Pages','Topics','Practice'].map((x,i)=>`<div class="stat"><strong>—</strong><span>${x}</span></div>`).join('');$('#homeDocs').innerHTML=`<div class="empty" style="grid-column:1/-1"><b>Your library is empty</b>Import a PDF to start building your private study space.</div>`;return}
 const s=docStats();stats.innerHTML=`<div class="stat"><strong>1</strong><span>Active document</span></div><div class="stat"><strong>${s.pages}</strong><span>Pages indexed</span></div><div class="stat"><strong>${s.topics}</strong><span>Revision topics</span></div><div class="stat"><strong>${quiz.length||0}</strong><span>Quiz questions ready</span></div>`;
 $('#homeDocs').innerHTML=(doc.ocrPages?.length?`<div class="notice-card" style="grid-column:1/-1"><div><b>${doc.ocrPages.length} page${doc.ocrPages.length===1?' is':'s are'} not indexed</b><span>Those pages look scanned/handwritten or corrupted. They were skipped so StudyWell does not generate gibberish from them.</span></div><span class="notice-pill">OCR needed</span></div>`:'')+docCard(doc);$('#homeDocs [data-open-active]')?.addEventListener('click',()=>show('ask'));$('#homeDocs [data-go-library]')?.addEventListener('click',()=>show('library'));
}
function docCard(d){return `<article class="doc-card" data-home-doc="1"><div class="doc-top"><div class="pdf-icon">PDF</div><span class="green-dot" title="Available offline"></span></div><h3>${esc(d.name)}</h3><div class="doc-meta">${d.pages} pages · ${d.chunks.length} searchable passages${d.ocrPages?.length?` · ${d.ocrPages.length} skipped`:''}</div><div class="doc-actions"><button class="mini-btn primary" data-open-active>Study this</button><button class="mini-btn" data-go-library>Library</button></div></article>`}
async function renderDocs(){const out=$('#docs'),items=await listDocs();if(!items.length){out.innerHTML=`<div class="empty" style="grid-column:1/-1"><b>No documents yet</b>Import a PDF above. It will be stored locally so you can return to it offline.</div>`;return}out.innerHTML=items.map(d=>`<article class="doc-card" data-id="${esc(d.id)}"><div class="doc-top"><div class="pdf-icon">PDF</div><span class="green-dot"></span></div><h3>${esc(d.name)}</h3><div class="doc-meta">${d.pages.length} pages · saved locally${d.pageInfo?.filter(x=>x.status==='needs-ocr').length?` · ${d.pageInfo.filter(x=>x.status==='needs-ocr').length} need OCR`:''}</div><div class="doc-actions"><button class="mini-btn primary" data-open-doc>Open</button><button class="mini-btn" data-delete-doc>Remove</button></div></article>`).join('');out.querySelectorAll('[data-open-doc]').forEach(b=>b.onclick=async()=>{const x=await getDoc(b.closest('[data-id]').dataset.id);if(x){setDocFromPages(x.name,x.pages,undefined,x.pageInfo||[]);show('home');toast('Document opened')}});out.querySelectorAll('[data-delete-doc]').forEach(b=>b.onclick=async()=>{const id=b.closest('[data-id]')?.dataset.id;if(id){await deleteDoc(id);if(doc?.id===id){doc=null;localStorage.removeItem('studywell-active')}renderDocs();renderHome();toast('Removed from this device')}})}
function setDocFromPages(name,pages,id,pageInfo=[]){if(pageInfo.length)pages.pageInfo=pageInfo;doc=StudyEngine.build(name,pages);doc.id=id||('doc-'+Date.now());doc.pagesData=[...pages];doc.pageInfoData=doc.pageInfo||pageInfo;localStorage.setItem('studywell-active',doc.id);quiz=[];cards=[];ci=0;renderHome();renderSuggestions()}
async function load(file){if(!file||file.type!=='application/pdf'){toast('Please choose a PDF file');return}const st=$('#status'),bar=$('#statusBar'),pct=$('#statusPct'),txt=$('#statusText');st.hidden=false;try{const pages=await StudyEngine.extract(file,(p,n)=>{txt.textContent=`Reading page ${p} of ${n}…`;const v=Math.round(p/n*100);bar.style.width=v+'%';pct.textContent=v+'%' });const readable=pages.filter(Boolean).length;const scanned=(pages.pageInfo||[]).filter(x=>x.status==='needs-ocr');if(!readable){txt.textContent='No reliable text found. This looks like a scanned/handwritten PDF.';bar.style.width='100%';pct.textContent='100%';toast('This PDF needs OCR — no readable text was imported');return}const id='doc-'+Date.now();setDocFromPages(file.name.replace(/\.pdf$/i,''),pages,id,pages.pageInfo||[]);await saveDoc({id,name:doc.name,pagesData:pages,pageInfo:doc.pageInfo||[],created:doc.created});st.hidden=true;await renderDocs();show('home');if(scanned.length){toast(`Imported ${readable} pages. ${scanned.length} page${scanned.length===1?' is':'s are'} scanned/handwritten and were skipped to prevent gibberish.`)}else toast('Ready — your notes are stored locally')}catch(e){console.error(e);txt.textContent='Could not read this PDF. Try another text-based PDF.'}}
$('#file').onchange=e=>load(e.target.files[0]);const drop=$('#drop');['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));drop.addEventListener('drop',e=>load(e.dataTransfer.files[0]));drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file').click()}});
function renderSuggestions(){const out=$('#suggestions');if(!doc){out.innerHTML='';return}const qs=['Explain this topic simply','What should I study for the exam?','Find the important code','Give me a 6-mark answer'];out.innerHTML=qs.map(q=>`<button class="suggestion">${q}</button>`).join('');out.querySelectorAll('.suggestion').forEach((b,i)=>b.onclick=()=>{const vals=['Explain the most important topic in my notes simply','What should I study for the exam?','Show me the important code in my notes','Give me a 6-mark answer for the most important topic'];$('#q').value=vals[i];$('#askForm').requestSubmit()})}
$('#askForm').onsubmit=e=>{e.preventDefault();if(!doc)return needDoc($('#answer'));const q=$('#q').value.trim();if(!q)return;let mode='normal';if(/simple|simply|easy|eli5/i.test(q))mode='simple';if(/6[- ]?mark|exam answer|marks/i.test(q))mode='exam';let r;if(/what should i study|important topic|most important/i.test(q))r={selected:StudyEngine.examTopics(doc,4).map(x=>({text:x.excerpt,page:x.page,type:x.type})),pages:StudyEngine.examTopics(doc,4).map(x=>x.page)};else if(/important code|code/i.test(q)){const hits=doc.chunks.filter(x=>x.type==='code').slice(0,4);r={selected:hits.map(x=>({text:x.text,page:x.page,type:x.type})),pages:hits.map(x=>x.page)}}else r=StudyEngine.answer(doc,q,mode);renderAnswer(r,q,mode)};
function renderAnswer(r,q,mode){const out=$('#answer');if(!r||!r.selected?.length){out.innerHTML=`<div class="empty"><b>I couldn't find a strong match</b>Try a phrase or concept that appears in your notes. Search is fully local and only uses your uploaded material.</div>`;return}const text=StudyEngine.explain(r.selected,mode);const sources=r.selected.slice(0,5).map(x=>`<div class="source"><b>p.${x.page}</b><span>${esc(x.text.slice(0,110))}${x.text.length>110?'…':''}</span></div>`).join('');const code=r.code?`<div class="code-block">${esc(r.selected.filter(x=>x.type==='code').map(x=>x.text).join('\n\n')).slice(0,2500)}</div>`:'';out.innerHTML=`<div class="answer-wrap"><article class="answer-main"><h3>${mode==='simple'?'Simple explanation':mode==='exam'?'Exam-ready answer':'From your notes'}</h3><p>${esc(text)}</p>${code}<div class="answer-actions"><button data-follow="simple">Explain simpler</button><button data-follow="exam">Turn into 6-mark answer</button><button data-follow="quiz">Quiz me on this</button></div></article><aside class="answer-side"><h4>Sources</h4>${sources}<span class="cite">${r.pages.length} source page${r.pages.length===1?'':'s'}</span></aside></div>`;out.querySelectorAll('[data-follow]').forEach(b=>b.onclick=()=>{const a=b.dataset.follow;if(a==='quiz'){show('quiz');startQuizForTopic(q);return}$('#q').value=a==='simple'?`Explain ${q} simply`:`Give me a 6-mark answer about ${q}`;$('#askForm').requestSubmit()})}
function renderExam(){
 const out=$('#examOut'),banner=$('#examSummary');
 if(!doc){banner.innerHTML='';return needDoc(out)}
 const ts=StudyEngine.examTopics(doc,18);
 banner.innerHTML=`<div class="exam-summary-left"><span class="summary-orb">✦</span><div><strong>${ts.length} topics to master</strong><span>Flip a card to see the explanation, working, key points and an exam-ready answer — all grounded in your notes.</span></div></div><div class="flip-hint"><span>↻</span> Click any card</div>`;
 out.innerHTML=`<div class="exam-toolbar"><div><span class="eyebrow">YOUR REVISION DECK</span><h2>What matters for the exam</h2><p>Each card is a compact explanation of the topic, not a raw PDF excerpt.</p></div><div class="topic-count">${ts.length}<span>topics</span></div></div><div class="exam-grid">${ts.map((x,i)=>{
   const b=x.breakdown||{};
   const frontSummary=b.definition||x.excerpt;
   const backWork=(b.working||[]).map((z,j)=>`<li><span>${j+1}</span>${esc(z)}</li>`).join('');
   const backPoints=(b.points||[]).map(z=>`<li>${esc(z)}</li>`).join('');
   const code=x.type==='code' ? `<div class="flip-code">${esc(x.excerpt.slice(0,900))}</div>` : '';
   return `<article class="flip-card-shell" tabindex="0" aria-label="${esc(x.title)}. Click to flip">
    <div class="flip-card-inner">
      <div class="flip-face flip-front">
        <div class="card-glow"></div>
        <div class="card-topline"><span class="topic-number">${String(i+1).padStart(2,'0')}</span><span class="priority ${x.priority.toLowerCase()}">${esc(x.priority)}</span></div>
        <div class="topic-kind">${x.type==='code'?'CODE + CONCEPT':'CONCEPT'}</div>
        <h3>${esc(x.title)}</h3>
        <p class="front-summary">${esc(frontSummary.slice(0,210))}${frontSummary.length>210?'…':''}</p>
        <div class="learn-row">${x.keywords.slice(0,4).map(k=>`<span class="learn-pill">${esc(k)}</span>`).join('')}</div>
        <div class="card-footer"><span>Page ${x.page}</span><span class="flip-cta">Flip to learn <b>↗</b></span></div>
      </div>
      <div class="flip-face flip-back">
        <div class="back-scroll">
          <div class="back-head"><span>STUDY BREAKDOWN</span><span>p.${x.page}</span></div>
          <h3>${esc(x.title)}</h3>
          <section><label>What is it?</label><p>${esc(b.definition||x.excerpt)}</p></section>
          <section><label>How it works</label><ul class="step-list">${backWork||`<li><span>•</span>${esc(x.excerpt)}</li>`}</ul></section>
          <section><label>Key points</label><ul class="point-list">${backPoints||`<li>${esc(x.excerpt)}</li>`}</ul></section>
          ${code}
          <section class="exam-answer"><label>6-MARK / EXAM ANSWER</label><p>${esc(b.exam||x.excerpt)}</p></section>
          <div class="likely"><label>LIKELY QUESTION</label><p>${esc(x.question)}</p></div>
        </div>
        <div class="back-actions"><button data-ask-topic="${esc(x.title)}">Ask this</button><button data-unflip>↩ Front</button></div>
      </div>
    </div>
   </article>`;
 }).join('')}</div>`;
 out.querySelectorAll('.flip-card-shell').forEach(card=>{
   const flip=()=>card.classList.toggle('flipped');
   card.addEventListener('click',e=>{if(e.target.closest('button'))return;flip()});
   card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();flip()}});
   card.querySelector('[data-unflip]')?.addEventListener('click',e=>{e.stopPropagation();card.classList.remove('flipped')});
   card.querySelector('[data-ask-topic]')?.addEventListener('click',e=>{e.stopPropagation();const topic=e.currentTarget.dataset.askTopic;show('ask');$('#q').value=`Explain ${topic} simply and give me the important exam points`;$('#askForm').requestSubmit()});
 });
}
function startQuizForTopic(topic){show('quiz');quiz=StudyEngine.makeQuiz(doc,8,'hard');if(!quiz.length){$('#quizOut').innerHTML='<div class="empty">Not enough material for a quiz yet.</div>';return}qi=0;score=0;renderQuiz()}
$$('.choice').forEach(b=>b.onclick=()=>{$$('.choice').forEach(x=>x.classList.remove('active'));b.classList.add('active');difficulty=b.dataset.diff});
$('#startQuiz').onclick=()=>{if(!doc)return needDoc($('#quizOut'));quiz=StudyEngine.makeQuiz(doc,8,difficulty);if(!quiz.length){$('#quizOut').innerHTML='<div class="empty"><b>Not enough usable text</b>This PDF may be too short or mostly scanned images.</div>';return}qi=0;score=0;renderQuiz()};
function renderQuiz(){const out=$('#quizOut');if(qi>=quiz.length){const pct=Math.round(score/quiz.length*100);out.innerHTML=`<div class="quiz-card score-card"><p class="eyebrow">SESSION COMPLETE</p><div class="score-big">${score}/${quiz.length}</div><p style="color:var(--muted)">${pct>=80?'Strong recall.':'Use the cited pages to review the weak spots, then try again.'}</p><button class="primary-btn" id="again">Try another set</button></div>`;$('#again').onclick=()=>$('#startQuiz').click();return}const q=quiz[qi];const pct=qi/quiz.length*100;out.innerHTML=`<div class="quiz-shell"><div class="quiz-meta"><span>Question ${qi+1} of ${quiz.length}</span><span>${score} correct</span></div><div class="quiz-track"><i style="width:${pct}%"></i></div><article class="quiz-card"><div class="question-type">${q.type} · Page ${q.page}</div><h3>${esc(q.question)}</h3>${q.opts.map((o,i)=>`<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join('')}<div id="quizFeedback"></div></article></div>`;out.querySelectorAll('.quiz-opt').forEach(b=>b.onclick=()=>{const selected=+b.dataset.i;out.querySelectorAll('.quiz-opt').forEach(x=>x.disabled=true);const all=out.querySelectorAll('.quiz-opt');all[q.answer].classList.add('correct');if(selected===q.answer)score++;else b.classList.add('wrong');$('#quizFeedback').innerHTML=`<div class="quiz-feedback"><b>${selected===q.answer?'Correct':'Not quite'}</b><span>${esc(q.explanation)}</span><div><span class="cite">Source · Page ${q.page}</span></div><button class="primary-btn" id="nextQ" style="margin-top:13px">${qi+1<quiz.length?'Next question':'See result'}</button></div>`;$('#nextQ').onclick=()=>{qi++;renderQuiz()}})}
function renderCards(){const out=$('#cardsOut');if(!doc)return needDoc(out);if(!cards.length)cards=StudyEngine.flashcards(doc,18);if(!cards.length){out.innerHTML='<div class="empty">Not enough material to make useful question-based flashcards.</div>';return}const c=cards[ci%cards.length];const total=cards.length;out.innerHTML=`<div class="flash-wrap"><div class="flash-meta"><span>QUESTION ${String(ci+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}</span><span>${esc(c.type)} · Page ${c.page}</span></div><div class="flash-card ${cardFlipped?'revealed':''}" id="flash"><div class="flash-inner"><div class="flash-hint">${cardFlipped?'ANSWER':'ACTIVE RECALL'}</div>${cardFlipped?'<div class="flash-answer"><h4>Answer</h4><p>'+esc(c.back)+'</p><span class="cite">Source · Page '+c.page+'</span></div>':'<div class="flash-question"><span class="question-mark">?</span><h3>'+esc(c.front)+'</h3><p>Think first. Tap to reveal the answer.</p></div>'}</div></div><div class="flash-controls"><button class="secondary-btn" id="prevCard">← Previous</button><button class="primary-btn" id="nextCard">${ci+1<cards.length?'Next question':'Restart deck'}</button></div><p class="flash-note">Questions are generated only when the notes contain enough evidence for a meaningful answer.</p></div>`;$('#flash').onclick=()=>{cardFlipped=!cardFlipped;renderCards()};$('#prevCard').onclick=e=>{e.stopPropagation();ci=(ci-1+cards.length)%cards.length;cardFlipped=false;renderCards()};$('#nextCard').onclick=e=>{e.stopPropagation();ci=(ci+1)%cards.length;cardFlipped=false;renderCards()}}
let timerSec=1500,timerId=null;function updateTimer(){const m=Math.floor(timerSec/60),s=timerSec%60;$('#timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;const total=Number(localStorage.getItem('studywell-timer-total')||1500);const deg=Math.max(0,360-(timerSec/total*360));$('.timer-ring').style.background=`conic-gradient(var(--blue) ${deg}deg,rgba(0,113,227,.09) 0deg)`}$('#timerStart').onclick=()=>{if(timerId){clearInterval(timerId);timerId=null;$('#timerStart').textContent='Resume';return}$('#timerStart').textContent='Pause';timerId=setInterval(()=>{if(timerSec<=0){clearInterval(timerId);timerId=null;$('#timerStart').textContent='Start';toast('Focus session complete ✦');return}timerSec--;updateTimer()},1000)};$('#timerReset').onclick=()=>{if(timerId)clearInterval(timerId);timerId=null;timerSec=Number(localStorage.getItem('studywell-timer-total')||1500);$('#timerStart').textContent='Start';updateTimer()};$$('.timer-presets button').forEach(b=>b.onclick=()=>{$$('.timer-presets button').forEach(x=>x.classList.remove('active'));b.classList.add('active');timerSec=Number(b.dataset.min)*60;localStorage.setItem('studywell-timer-total',timerSec);if(timerId){clearInterval(timerId);timerId=null}$('#timerStart').textContent='Start';updateTimer()});updateTimer();
(async()=>{await renderDocs();const active=localStorage.getItem('studywell-active');if(active){try{const x=await getDoc(active);if(x)setDocFromPages(x.name,x.pages,active,x.pageInfo||[])}catch(e){}}renderHome();renderSuggestions()})();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(console.warn);

/* Curated interaction layer — no external runtime dependency. */
function setStateful(button, state, labels={}){
  if(!button)return;
  button.classList.remove('is-loading','is-success');
  if(state==='loading'){button.classList.add('is-loading');button.disabled=true;button.dataset.originalLabel=button.dataset.originalLabel||button.textContent;button.textContent=labels.loading||'Working…'}
  else if(state==='success'){button.classList.add('is-success');button.disabled=false;button.textContent=labels.success||'Done ✓';setTimeout(()=>{button.classList.remove('is-success');button.textContent=labels.idle||button.dataset.originalLabel||'Done';},1200)}
  else {button.disabled=false;button.textContent=labels.idle||button.dataset.originalLabel||button.textContent}
}

/* Floating dock mirrors the supplied Aceternity navigation pattern on mobile. */
$$('.floating-dock [data-dock]').forEach(b=>b.addEventListener('click',()=>{
  show(b.dataset.dock);
  $$('.floating-dock [data-dock]').forEach(x=>x.classList.toggle('active',x===b));
}));

/* Spotlight + glow on the curated card surfaces. */
function bindSpotlights(){
  $$('.stat,.tool-card,.doc-card,.exam-card,.practice-setup,.focus-wrap,.focus-tips>div').forEach(el=>{
    el.classList.add('spotlight-card','glow-card');
    el.addEventListener('pointermove',e=>{
      const r=el.getBoundingClientRect();
      el.style.setProperty('--spot-x',(e.clientX-r.left)+'px');
      el.style.setProperty('--spot-y',(e.clientY-r.top)+'px');
      el.style.setProperty('--glow-angle',((e.clientX-r.left)/Math.max(r.width,1)*360)+'deg');
    });
  });
}
const _renderHome=renderHome;
renderHome=function(){_renderHome();requestAnimationFrame(bindSpotlights)};
const _renderDocs=renderDocs;
renderDocs=async function(){const r=await _renderDocs();requestAnimationFrame(bindSpotlights);return r};

/* Stateful feedback for primary study actions. */
const _startQuiz=()=>{
  const b=$('#startQuiz');
  if(!doc){return needDoc($('#quizOut'))}
  setStateful(b,'loading',{loading:'Building practice…'});
  setTimeout(()=>{
    quiz=StudyEngine.makeQuiz(doc,8,difficulty);
    if(!quiz.length){setStateful(b,'idle',{idle:'Start 8-question practice'});$('#quizOut').innerHTML='<div class="empty"><b>Not enough usable text</b>This PDF may be too short or mostly scanned images.</div>';return}
    qi=0;score=0;setStateful(b,'success',{success:'Practice ready ✓',idle:'Start 8-question practice'});renderQuiz();
  },140);
};
$('#startQuiz').onclick=_startQuiz;

/* Ask button gets the same immediate state feedback. */
const askButton=$('#askForm .primary-btn');
if(askButton){
  const oldAsk=$('#askForm').onsubmit;
  $('#askForm').onsubmit=e=>{
    if(!doc){oldAsk?.(e);return}
    setStateful(askButton,'loading',{loading:'Searching…'});
    setTimeout(()=>{oldAsk?.(e);setStateful(askButton,'success',{success:'Found ✓',idle:'Ask'});},80);
  };
}

/* Rebind after dynamic views are created. */
requestAnimationFrame(bindSpotlights);

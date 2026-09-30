/* StudyWell local engine. No network calls. Retrieval is heuristic/on-device, not generative AI. */
const StudyEngine=(()=>{
const STOP=new Set(`a an the and or but if of to in on at by for with as is are was were be been being it its this that these those from into than then so such not no can will would should could may might do does did has have had which what who whom whose when where why how also about over under between each other more most some any their there they them we you your i he she his her our us via per use used using used as into out only very much many few all both each own same new one two three four five six seven eight nine ten`.split(/\s+/));
const WORD_RE=/[A-Za-z][A-Za-z0-9_+#.'-]{1,}/g;
const CODE_RE=/\b(module|endmodule|always_comb|always_ff|always|logic|wire|reg|assign|begin|end|input|output|parameter|localparam|case|endcase|if|else|for|initial|posedge|negedge|endmodule|SystemVerilog|Verilog|testbench|DUT)\b/i;
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const tokens=s=>(String(s||'').toLowerCase().match(WORD_RE)||[]).map(x=>x.replace(/^[^a-z]+|[^a-z0-9+#_]+$/g,'')).filter(w=>w.length>1&&!STOP.has(w));
const uniq=a=>[...new Set(a)];
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const escapeReg=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function splitSentences(text){return (String(text||'').replace(/\n+/g,' ').match(/[^.!?]+(?:[.!?]+|$)/g)||[]).map(clean).filter(s=>s.length>20)}
function looksCode(s){const t=String(s||'');return /\b(module|endmodule|always_comb|always_ff|assign|logic\s+\[|wire\s+|reg\s+|case\s*\(|initial\s+begin|begin\s*$|end\s*$|posedge|negedge)\b/i.test(t)||/[{};]|\b\d+'b[01x]+\b/.test(t)}
function headingScore(s){let n=0;if(s.length<95)n+=1;if(/^[A-Z][A-Za-z0-9 &/()_-]{2,65}$/.test(s))n+=2;if(/^(unit|chapter|module|topic|introduction|definition|working|advantages|applications|design|architecture|overview|algorithm|procedure|theory)\b/i.test(s))n+=3;return n}
function textQuality(raw){
 const text=clean(raw);
 if(!text) return {score:0,reason:'no-text',suspicious:false,wordCount:0};
 const words=(text.match(/[A-Za-z][A-Za-z0-9_+#.'-]*/g)||[]);
 const letters=(text.match(/[A-Za-z]/g)||[]).length;
 const vowels=(text.match(/[aeiou]/gi)||[]).length;
 const alphaRatio=letters/Math.max(text.length,1);
 const vowelRatio=vowels/Math.max(letters,1);
 const mixedCase=words.filter(w=>/[a-z]/.test(w)&&/[A-Z]/.test(w)&&!/^[A-Z][a-z]+$/.test(w)&&!/[A-Z]{2,}$/.test(w)).length;
 const longWeird=words.filter(w=>w.length>=5 && !/[aeiou]/i.test(w) && !/^[A-Z0-9_]+$/.test(w)).length;
 const repeatedCaps=words.filter(w=>/[A-Z]{2,}[a-z]{1,}/.test(w)).length;
 const weirdPunct=(text.match(/[»«¤¦§¿¡]{1}/g)||[]).length;
 const codeLike=looksCode(text);
 let score=1;
 if(alphaRatio>.45)score+=1;
 if(vowelRatio>.22)score+=1;
 if(words.length>=12)score+=1;
 if(codeLike)score+=1;
 if(mixedCase/Math.max(words.length,1)>.16)score-=2;
 if(repeatedCaps/Math.max(words.length,1)>.18)score-=2;
 if(longWeird/Math.max(words.length,1)>.22)score-=1;
 if(weirdPunct>2)score-=1;
 const suspicious=score<2 || (mixedCase/Math.max(words.length,1)>.28 && !codeLike) || vowelRatio<.13;
 return {score,reason:suspicious?'low-confidence-text':'ok',suspicious,wordCount:words.length,alphaRatio,vowelRatio};
}
function reconstructText(items){
 const rows=[];
 for(const item of items){
  const str=String(item.str||'').trim(); if(!str)continue;
  const tr=item.transform||[]; const x=Number(tr[4]||0), y=Number(tr[5]||0);
  let row=rows.find(r=>Math.abs(r.y-y)<3.2);
  if(!row){row={y,items:[]};rows.push(row)}
  row.items.push({x,str});
 }
 rows.sort((a,b)=>b.y-a.y);
 return clean(rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(x=>x.str).join(' ')).join('\n'));
}
async function extract(file,onProgress){
 pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
 const pages=[], pageInfo=[];
 for(let p=1;p<=pdf.numPages;p++){
  const page=await pdf.getPage(p);
  const tc=await page.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false});
  const raw=reconstructText(tc.items||[]);
  const q=textQuality(raw);
  // Never feed obviously corrupted/garbled OCR layers into the study engine.
  if(q.suspicious){
   pages.push('');
   pageInfo.push({page:p,status:'needs-ocr',quality:q.score,reason:q.reason,words:q.wordCount});
  }else{
   pages.push(raw);
   pageInfo.push({page:p,status:raw?'text':'needs-ocr',quality:q.score,reason:q.reason,words:q.wordCount});
  }
  onProgress&&onProgress(p,pdf.numPages);
 }
 pages.pageInfo=pageInfo;
 return pages;
}
function build(name,pages){
 const chunks=[];
 const pageInfo=pages.pageInfo||pages.map((raw,i)=>({page:i+1,status:raw?'text':'needs-ocr'}));
 pages.forEach((raw,pi)=>{
  const text=clean(raw); if(!text)return;
  const sentences=splitSentences(text);
  const pieces=[];
  // Group nearby prose so retrieval returns context instead of isolated fragments.
  let buffer=[];
  const flush=()=>{if(!buffer.length)return;const t=buffer.join(' ');pieces.push({text:t,type:'prose',score:Math.max(...buffer.map(headingScore),0)});buffer=[]};
  for(const s of sentences){
   if(looksCode(s)){flush();pieces.push({text:s,type:'code',score:headingScore(s)});continue}
   buffer.push(s); if(buffer.length>=2)flush();
  }
  flush();
  if(!pieces.length)pieces.push({text:text.slice(0,700),type:looksCode(text)?'code':'prose',score:0});
  pieces.forEach((p,i)=>chunks.push({id:`${pi+1}-${i}`,page:pi+1,text:p.text,type:p.type,headingScore:p.score}));
 });
 const df={};chunks.forEach(c=>uniq(tokens(c.text)).forEach(w=>df[w]=(df[w]||0)+1)); const N=Math.max(chunks.length,1);
 const idf=w=>Math.log((N+1)/((df[w]||0)+1))+1;
 chunks.forEach(c=>{const tf={};tokens(c.text).forEach(w=>tf[w]=(tf[w]||0)+1);let norm=0;c.vec={};Object.entries(tf).forEach(([w,n])=>{const v=(1+Math.log(n))*idf(w);c.vec[w]=v;norm+=v*v});c.norm=Math.sqrt(norm)||1;c.terms=Object.keys(tf)});
 const headings=chunks.filter(c=>c.headingScore>=2).map(c=>({text:c.text,page:c.page}));
 return {name,pages:pages.length,chunks,df,idf,headings,pageInfo,ocrPages:pageInfo.filter(x=>x.status==='needs-ocr').map(x=>x.page),created:Date.now()};
}
function scoreChunk(doc,c,qTokens,qText){let dot=0;const qf={};qTokens.forEach(w=>qf[w]=(qf[w]||0)+1);Object.entries(qf).forEach(([w,n])=>{if(c.vec[w])dot+=c.vec[w]*((1+Math.log(n))*doc.idf(w))});let score=dot/c.norm;
 const lower=c.text.toLowerCase(), phrase=qText.toLowerCase().trim(); if(phrase.length>5&&lower.includes(phrase))score+=2.5;
 if(c.headingScore)score+=Math.min(c.headingScore*.12,.5); return score;
}
function search(doc,q,k=6){const qt=tokens(q);if(!qt.length)return[];return doc.chunks.map(c=>({c,s:scoreChunk(doc,c,qt,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,k)}
function topKeywords(doc,limit=10){const scored=Object.entries(doc.df).map(([w,n])=>[w,(doc.idf(w)*Math.log2(n+1))]).sort((a,b)=>b[1]-a[1]);return scored.slice(0,limit).map(x=>x[0])}
function topicLabel(text){
 let s=clean(text).replace(/^[-•\s]+/,'').trim();
 const patterns=[
  /^(.{2,72}?)\s+(?:is|are|refers to|means|denotes|converts|consists of|is a|is an|is the|are a|are an)\b/i,
  /^(.{2,72}?)\s*[–—:]\s+/,
  /^(.{2,72}?)\s+(?:does|do|can|will|provides|contains|includes|uses|used|works|affects|affect)\b/i
 ];
 for(const re of patterns){const m=s.match(re);if(m){s=m[1].trim();break}}
 s=s.replace(/^[Aa]n?\s+/,'').replace(/^[Tt]he\s+/,'').replace(/[,:;.]+$/,'').trim();
 if(s.length>72)s=s.split(/\s+/).slice(0,8).join(' ');
 return s||'Core concept';
}
function extractConceptTitle(text){
 const s=clean(text);
 const m=s.match(/^(.{2,72}?)\s+(?:is|are|refers to|means|denotes|converts|consists of|is a|is an|is the|are a|are an)\b/i);
 if(m)return m[1].replace(/^[Aa]n?\s+|^[Tt]he\s+/,'').trim();
 const d=s.match(/^(.{2,72}?)\s*[–—:]\s+/);if(d)return d[1].trim();
 return null;
}
function concepts(doc,n=12){
 const candidates=[]; const seen=new Set();
 // First prefer explicit definition/title patterns; these are much more useful than arbitrary keywords.
 doc.chunks.forEach(c=>{
  if(c.type==='code')return;
  const ts=tokens(c.text); if(ts.length<5)return;
  const explicit=extractConceptTitle(c.text);
  if(!explicit || explicit.length<2)return;
  const id=explicit.toLowerCase(); if(seen.has(id))return; seen.add(id);
  const keywords=uniq(ts).sort((a,b)=>(doc.idf(b)-doc.idf(a))).slice(0,5);
  candidates.push({title:explicit,source:c,keywords,score:7+(c.headingScore*2)+(keywords.length*.35)+(ts.length/80)});
 });
 // Then use heading-like and information-dense prose as a fallback.
 doc.chunks.forEach(c=>{
  if(c.type==='code')return;
  const ts=tokens(c.text); if(ts.length<7)return;
  const key=topicLabel(c.text),id=key.toLowerCase(); if(seen.has(id))return;
  if(/^(the|this|that|these|those|when|if|for|from|in|on|it|they|he|she|a|an)\b/i.test(key))return;
  seen.add(id);
  const keywords=uniq(ts).sort((a,b)=>(doc.idf(b)-doc.idf(a))).slice(0,5);
  const density=ts.reduce((a,w)=>a+(doc.df[w]||0),0);
  candidates.push({title:key,source:c,keywords,score:(c.headingScore*2)+(keywords.length*.3)+(density/Math.max(ts.length,1))});
 });
 return candidates.sort((a,b)=>b.score-a.score).slice(0,n+8);
}
function sentenceList(text){
 return splitSentences(text).slice(0,8);
}
function definitionLine(text,title){
 const ss=sentenceList(text);
 const def=ss.find(x=>/\b(is|are|refers to|means|denotes|converts|consists of|defined as|called)\b/i.test(x));
 return clean(def||ss[0]||`Your notes introduce ${title}.`);
}
function workingLines(text){
 const ss=sentenceList(text);
 const signal=/\b(first|second|then|next|finally|when|during|works|working|operation|process|input|output|carry|propagat|connect|connected|converts|used|uses|contains|consists|step)\b/i;
 const picked=ss.filter(x=>signal.test(x));
 return uniq((picked.length?picked:ss.slice(1)).slice(0,4));
}
function keyPoints(text,keywords){
 const ss=sentenceList(text);
 const points=[];
 ss.forEach(x=>{if(x.length>35 && !points.includes(x))points.push(x)});
 keywords.slice(0,4).forEach(k=>{if(!points.some(p=>new RegExp('\\b'+escapeReg(k)+'\\b','i').test(p)))points.push(`Remember the term “${k}” from this section.`)});
 return points.slice(0,4);
}
function examAnswer(title,source,keywords){
 const definition=definitionLine(source.text,title);
 const work=workingLines(source.text);
 const points=keyPoints(source.text,keywords);
 let out=`${title} is covered in your notes as follows: ${definition}`;
 if(work.length)out+=` ${work.join(' ')}`;
 if(points.length)out+=` Key points to remember: ${points.slice(0,2).join(' ')}`;
 return clean(out);
}
function studyBreakdown(title,source,keywords){
 const definition=definitionLine(source.text,title);
 const working=workingLines(source.text);
 const points=keyPoints(source.text,keywords);
 const exam=examAnswer(title,source,keywords);
 const code=source.type==='code';
 return {definition,working,points,exam,code};
}
function examTopics(doc,n=12){
 const cs=concepts(doc,Math.max(n+6,18));
 const qs=['Define {t} and explain its working.','Explain the working of {t} with the important points from your notes.','Write a short note on {t}. Include its definition, working and key points.','Explain {t} as you would in an exam answer.'];
 return cs.slice(0,n).map((x,i)=>{
  const title=x.title,source=x.source,keywords=x.keywords.slice(0,5);
  const breakdown=studyBreakdown(title,source,keywords);
  const q=source.type==='code'?`Explain the purpose and working of the ${title} code shown in your notes.`:qs[i%qs.length].replace('{t}',title);
  return {title,page:source.page,excerpt:source.text,keywords,question:q,priority:i<3?'High':i<7?'Important':'Review',type:source.type,breakdown,score:x.score};
 });
}
function answer(doc,q,mode='normal'){
 const hits=search(doc,q,8); if(!hits.length)return null;
 const qwords=tokens(q); const chosen=[]; const seen=new Set();
 hits.forEach(h=>{const s=h.c.text; const sid=h.c.id;if(seen.has(sid))return;let rel=qwords.filter(w=>tokens(s).includes(w)).length;chosen.push({text:s,page:h.c.page,type:h.c.type,rel,score:h.s});seen.add(sid)});
 chosen.sort((a,b)=>(b.rel+b.score)-(a.rel+a.score));
 let selected=chosen.slice(0,mode==='exam'?4:3);
 if(mode==='simple')selected=chosen.slice(0,2);
 const pages=uniq(selected.map(x=>x.page)).sort((a,b)=>a-b);
 const code=selected.some(x=>x.type==='code');
 return {selected,pages,code,keywords:qwords.slice(0,8)};
}
function likelyQuestion(title,type){
 if(type==='code')return `Explain the code for ${title}. State what each important block does and the expected behavior.`;
 return `Explain ${title}. Include its definition, working, important points and one relevant application.`;
}
function quizPool(doc){
 const pool=[];
 doc.chunks.forEach(c=>{
  if(c.type==='code'){if(c.text.length>45)pool.push({type:'Code',text:c.text,page:c.page,source:c});return;}
  const s=c.text;if(s.length<45||s.length>300)return;
  const words=uniq(tokens(s)).filter(w=>w.length>=5).sort((a,b)=>(doc.idf(b)-doc.idf(a)));
  if(words.length)pool.push({type:'Concept',text:s,key:words[0],page:c.page,source:c});
 });return pool;
}
function makeQuiz(doc,n=8,difficulty='mixed'){
 const pool=quizPool(doc); if(pool.length<4)return[]; const chosen=shuffle(pool).slice(0,Math.min(n,pool.length)); const allTerms=uniq(pool.map(x=>x.key).filter(Boolean));
 return chosen.map((x,idx)=>{
  if(x.type==='Code'){
   const words=x.text.match(/\b(module|always_comb|always_ff|assign|logic|wire|input|output|case|for|initial)\b/i); const term=words?words[0]:null;
   if(term){const wrong=shuffle(['module','always_comb','logic','assign','case','initial','wire'].filter(w=>w.toLowerCase()!==term.toLowerCase())).slice(0,3);const opts=shuffle([term,...wrong]);return {type:'Code',question:`In the following note excerpt, which construct is being used?\n\n${x.text.slice(0,420)}`,opts,answer:opts.indexOf(term),explanation:`Your notes use the ${term} construct in this code example.`,page:x.page};}
  }
  const key=x.key; const wrong=shuffle(allTerms.filter(w=>w!==key)).slice(0,3);if(wrong.length<3)return null;const opts=shuffle([key,...wrong]);
  let question=`Which term best completes this statement from your notes?\n\n${x.text.replace(new RegExp('\\b'+escapeReg(key)+'\\b','i'),'_____')}`;
  if(difficulty==='hard')question=`Which concept is being described here?\n\n${x.text}`;
  return {type:'Concept',question,opts,answer:opts.indexOf(key),explanation:`The note passage identifies “${key}” as the key concept in this context.`,page:x.page};
 }).filter(Boolean).slice(0,n);
}
function flashcards(doc,n=18){
 const out=[]; const seen=new Set();
 const add=(front,back,page,type='Concept')=>{
  const f=clean(front), b=clean(back);
  if(f.length<12||b.length<20)return;
  const id=(f+'|'+b).toLowerCase();
  if(seen.has(id))return;
  seen.add(id); out.push({front:f,back:b,page,type});
 };
 const sentenceFor=(text,rx)=>sentenceList(text).find(s=>rx.test(s));
 const conceptsList=concepts(doc,Math.max(n*2,30));
 conceptsList.forEach(x=>{
  const title=clean(x.title), text=x.source.text;
  if(!title||title.length>80)return;
  const definition=definitionLine(text,title);
  const work=workingLines(text);
  const code=x.source.type==='code';

  // Prefer real questions that a student would actually be asked, rather than a bare term.
  if(definition && definition.length>25){
   add(`What is ${title}?`,definition,x.source.page,code?'Code + concept':'Definition');
  }

  if(work.length){
   const useful=work.slice(0,3).join(' ');
   add(`How does ${title} work?`,useful,x.source.page,code?'Code + working':'Working');
  }

  // If the source contains a direct fact about the concept, turn that fact into a targeted recall question.
  const fact=sentenceFor(text,new RegExp('\\b(does not|do not|is used|are used|used to|contains|consists of|converts|requires|allows|provides|supports|stores|loads|sets|resets|generates|detects|connects|called)\\b','i'));
  if(fact && !/^what is /i.test(fact)){
   add(`What important point does your note make about ${title}?`,fact,x.source.page,'Key point');
  }

  // For code-heavy material, ask purpose/behavior instead of asking the learner to memorize syntax.
  if(code){
   const behavior=sentenceFor(text,/\b(module|testbench|output|input|case|always_comb|always_ff|initial|instantiat|result|test case)\b/i)||text;
   add(`What does the ${title} code do?`,behavior,x.source.page,'Code');
  }
 });

 // Fallback: only use explicit definition sentences. Never turn arbitrary keywords into questions.
 if(out.length<Math.min(8,n)){
  doc.chunks.forEach(c=>{
   if(out.length>=n||c.type==='code')return;
   const m=c.text.match(/^(.{3,70}?)\s+(?:is|are|refers to|means|denotes|converts|consists of|defined as|called)\s+(.{20,260})/i);
   if(!m)return;
   const title=m[1].trim();
   add(`What is ${title}?`,c.text,c.page,'Definition');
  });
 }
 return out.slice(0,n);
}
function explain(selected,mode){if(!selected.length)return '';const texts=selected.map(x=>x.text);if(mode==='simple')return `In simple terms, your notes say: ${texts.slice(0,2).join(' ')}`;if(mode==='exam')return `For an exam answer, structure it around the definition, working, key points and application. Your notes state: ${texts.join(' ')}`;return texts.join(' ')}
return {extract,build,search,answer,examTopics,makeQuiz,flashcards,topKeywords,explain,studyBreakdown};
})();

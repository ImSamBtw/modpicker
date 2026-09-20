(()=>{
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pct=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
function metrics(p){
  const src=p.liveSources||[];
  const evidence=p.evidence||[];
  const urls=new Set([...src.map(x=>x.url),...evidence.map(x=>x.url)].filter(Boolean));
  const types=new Set([...src.map(x=>x.source_type),...evidence.map(x=>String(x.type||'').toLowerCase())].filter(Boolean));
  const offers=(p.liveOffers?.length?p.liveOffers:p.offers)||[];
  const fit=Number(p.fitmentData?.confidence??(p.confidence||0)/100);
  const fitment=p.fitmentData?.fitment_status==='verified'||fit>=.9?100:fit>=.75?80:fit>=.6?60:35;
  const price=offers.length>=3?100:offers.length===2?85:offers.length===1?65:0;
  const sourceCount=urls.size;
  const sourceDiversity=types.size;
  const sources=Math.min(100,sourceCount*12+sourceDiversity*12);
  const install=p.install?.difficulty&&Number(p.install?.hours)>0?100:p.install?.difficulty?65:20;
  const scoreConfidence=p.scoreMetadata?.sourceCount?Math.min(100,35+Number(p.scoreMetadata.sourceCount)*8):pct(p.confidence||0);
  const total=Math.round(fitment*.28+price*.20+sources*.24+install*.10+scoreConfidence*.18);
  return {total,fitment,price,sources,install,scoreConfidence,sourceCount,sourceDiversity,offerCount:offers.length,provisional:Boolean(p.scoreMetadata?.provisional)};
}
function label(n){return n>=85?'Strong':n>=70?'Good':n>=50?'Developing':'Limited'}
function decorateCards(){
  const grid=document.querySelector('#partGrid');if(!grid)return;
  let list=[];try{list=typeof window.filtered==='function'?window.filtered():[]}catch(e){}
  const cards=[...grid.querySelectorAll('.part-card')];
  cards.forEach((card,i)=>{
    if(card.querySelector('.research-coverage'))return;
    const p=list[i];if(!p)return;
    const m=metrics(p);
    const el=document.createElement('div');
    el.className='research-coverage';
    el.innerHTML=`<div class="research-coverage-head"><span>Research coverage</span><strong>${m.total}% · ${label(m.total)}</strong></div><div class="research-coverage-track"><span style="width:${m.total}%"></span></div><small>${m.sourceCount} source${m.sourceCount===1?'':'s'} · ${m.offerCount} price offer${m.offerCount===1?'':'s'} · ${m.provisional?'provisional ranking':'evidence-backed ranking'}</small>`;
    const meta=card.querySelector('.quick-meta')||card.querySelector('.score-list');
    if(meta)meta.insertAdjacentElement('afterend',el);else card.appendChild(el);
  });
}
function appendDetail(id){
  const p=window.MODPICKER_DATA?.parts?.find(x=>x.id===id),root=document.querySelector('#partDialogContent');if(!p||!root||root.querySelector('.research-completeness-panel'))return;
  const m=metrics(p),official=p.database?.official_url||p.official_url||p.officialUrl;
  root.insertAdjacentHTML('beforeend',`<section class="detail-section research-completeness-panel"><span class="eyebrow">Data quality</span><h3>Research completeness: ${m.total}% · ${label(m.total)}</h3><p class="fine-print">This measures how much supporting information ModPicker has collected. It is not a rating of the part itself.</p><div class="research-metric-grid"><div><span>Fitment evidence</span><strong>${m.fitment}%</strong></div><div><span>Price coverage</span><strong>${m.price}%</strong></div><div><span>Source coverage</span><strong>${m.sources}%</strong><small>${m.sourceCount} unique sources / ${m.sourceDiversity} source types</small></div><div><span>Install data</span><strong>${m.install}%</strong></div><div><span>Ranking evidence</span><strong>${m.scoreConfidence}%</strong><small>${m.provisional?'Ranking remains provisional':'Ranking has evidence support'}</small></div></div>${official?`<p><a class="button secondary small" href="${esc(official)}" target="_blank" rel="noopener">Official / primary product source ↗</a></p>`:''}</section>`);
}
const prior=window.showPart;
if(typeof prior==='function')window.showPart=function(id){prior(id);appendDetail(id)};
const grid=document.querySelector('#partGrid');if(grid)new MutationObserver(()=>queueMicrotask(decorateCards)).observe(grid,{childList:true});
window.addEventListener('load',()=>{decorateCards();setTimeout(decorateCards,500);setTimeout(decorateCards,1500)});
window.MODPICKER_RESEARCH_METRICS=metrics;
})();

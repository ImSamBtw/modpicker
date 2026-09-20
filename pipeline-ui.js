(()=>{
const prev=window.showPart;
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const safeUrl=u=>/^https?:\/\//i.test(String(u||''))?u:'#';
window.showPart=function(id){
 prev(id); const p=window.MODPICKER_DATA?.parts?.find(x=>x.id===id); if(!p)return;
 const root=document.querySelector('#partDialogContent'); if(!root)return;
 const src=p.liveSources||[],off=p.liveOffers||[]; if(!src.length&&!off.length)return;
 root.insertAdjacentHTML('beforeend',`<section class="research-panel"><span class="eyebrow">Automated data pipeline</span><h3>Live-discovered data</h3><p class="fine-print">Collected automatically with source provenance. API-derived data is refreshed by scheduled GitHub Actions.</p>${off.length?`<h4>Live offers</h4><div class="research-links">${off.slice(0,8).map(o=>`<a class="research-link" href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener"><span><strong>${esc(o.vendor)}</strong><br><small>${esc(o.condition||'new')} · ${esc(o.retrieved_at||'')}</small></span><strong>${o.price==null?'Check price':new Intl.NumberFormat('en-US',{style:'currency',currency:o.currency||'USD'}).format(o.price)}</strong></a>`).join('')}</div>`:''}${src.length?`<h4>Discovered sources</h4><div class="research-links">${src.slice(0,12).map(s=>`<a class="research-link" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener"><span><strong>${esc(s.title)}</strong><br><small>${esc(s.outlet||s.source_type)} · ${esc(s.source_type)}</small></span><small>${Math.round((s.confidence||0)*100)}% source confidence ↗</small></a>`).join('')}</div>`:''}</section>`);
}
const link=document.createElement('link');link.rel='stylesheet';link.href='quality.css';document.head.appendChild(link);
const script=document.createElement('script');script.src='quality-ui.js';script.defer=true;document.head.appendChild(script);
})();

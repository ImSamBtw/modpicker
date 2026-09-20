(()=>{
const original=window.showPart;
window.showPart=function(id){original(id);const p=part(id),root=document.querySelector('#partDialogContent');if(!p)return;
const metric=root.querySelector('.detail-grid');if(metric)metric.innerHTML=`<div><span>Published owner rating</span><strong>${ratingText(p.rating.overall)}${p.rating.overall!=null?'/10':''}</strong></div><div><span>Review count</span><strong>${p.scoreMetadata?.review_count||0}</strong></div><div><span>Fitment</span><strong>${fitmentVerified(p)?'Application listed':'Confirm exact fitment'}</strong></div>`;
const breakdown=[...root.querySelectorAll('.detail-section')].find(x=>x.querySelector('h3')?.textContent==='Score breakdown');if(breakdown){const evidence=p.scoreMetadata?.evidence||[];breakdown.innerHTML=`<h3>Where the rating comes from</h3><p>${evidence.length?'Published review averages normalized to a 10-point scale, weighted by review count. Retailer-reported reviews are not independently verified.':'No usable published review data has been collected for this exact product yet. It is not rated.'}</p><p class="fine-print">Quality, reliability, power, handling and value stay unrated without measurements for those specific metrics. A source link does not establish a product score.</p>${evidence.map(e=>`<p><a href="${MP_TEXT(MP_URL(e.url))}" target="_blank" rel="noopener">${MP_TEXT(e.outlet)}</a> · ${e.rating}/10 · ${e.count} reviews · checked ${new Date(e.retrieved_at).toLocaleDateString()}</p>`).join('')}`}
root.querySelector('.two-col-details')?.remove();
const fit=selectedFitment(p);if(fit){const section=document.createElement('section');section.className='detail-section';const title=document.createElement('h3');title.textContent='Selected application evidence';const note=document.createElement('p');note.textContent=fit.notes||fitmentLabel(p);section.append(title,note);const link=MP_URL(fit.source_url);if(link){const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener';a.textContent='Check fitment source';section.append(a)}root.append(section)}
const sources=p.liveSources||[];root.insertAdjacentHTML('beforeend',`<section class="detail-section"><h3>Collected source links (${sources.length})</h3><p class="fine-print">Search matches and community discussions are research leads, not proof of fitment or product quality.</p><div class="research-links">${sources.map(s=>`<a class="research-link" href="${MP_TEXT(s.url)}" target="_blank" rel="noopener"><span>${s.title||s.url}<small>${s.source_type} · checked ${new Date(s.retrieved_at).toLocaleDateString()}</small></span><span>↗</span></a>`).join('')||'<p>No source links collected yet.</p>'}</div></section>`);

const photoSource=(p.liveSources||[]).find(s=>s.metadata?.identity_matched&&s.metadata?.product_image);const rawPhoto=photoSource?.metadata.product_image;const photo=MP_URL(Array.isArray(rawPhoto)?rawPhoto[0]:rawPhoto);if(photo)root.querySelector('.dialog-hero')?.insertAdjacentHTML('beforeend',`<img class="product-photo" loading="lazy" src="${MP_TEXT(photo)}" alt="Product photo from the linked source">`);
const source=p.officialUrl;if(source)root.querySelector('.dialog-hero')?.insertAdjacentHTML('beforeend',`<p><a href="${MP_TEXT(source)}" target="_blank" rel="noopener">Product source ↗</a>${p.mpn?` · Part number ${p.mpn}`:''}</p>`);
};
})();

(()=>{
if(document.querySelector('script[data-garage-ui]'))return;
const script=document.createElement('script');
script.src='garage-ui.js';
script.async=false;
script.dataset.garageUi='1';
script.addEventListener('load',()=>{
 const garageLink=document.querySelector('[data-route="garage"]');
 if(garageLink&&!garageLink.dataset.routeBound){
  garageLink.dataset.routeBound='1';
  garageLink.addEventListener('click',event=>{
   event.preventDefault();
   if(typeof window.route==='function')window.route('garage');
  });
 }
});
document.body.appendChild(script);
})();

(()=>{
for(const src of ['garage-planner.js','interchange.js','ui-polish.js','site-refresh.js']){
 if(document.querySelector(`script[src="${src}"]`))continue;
 const script=document.createElement('script');script.src=src;script.async=false;document.body.appendChild(script);
}
})();

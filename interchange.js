(()=>{
'use strict';
const DATA_URL='data/manual/interchange_groups.json';
let groups=[];
let loaded=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
const loadPromise=fetch(DATA_URL,{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(`Interchange data ${r.status}`);return r.json()}).then(rows=>{groups=Array.isArray(rows)?rows:[];loaded=true;return groups}).catch(e=>{console.warn('Interchange data unavailable',e);loaded=true;return[]});
function partGroup(p){
 if(!p)return null;
 const mpn=norm(p.mpn||p.manufacturer_part_number);
 return groups.find(g=>(g.part_ids||[]).includes(p.id)||(g.manufacturer_part_numbers||[]).some(x=>norm(x)===mpn))||null;
}
function appLabel(a){return `${a.year_from}${a.year_to&&a.year_to!==a.year_from?`–${a.year_to}`:''} ${a.make} ${a.model}`}
function matchesVehicle(a,v){
 if(!v)return false;
 const year=Number(v.year);
 return norm(a.make)===norm(v.make)&&norm(a.model)===norm(v.model)&&year>=Number(a.year_from)&&year<=Number(a.year_to||a.year_from);
}
function render(p){
 const root=document.querySelector('#partDialogContent');if(!root)return;
 root.querySelector('#interchangeSection')?.remove();
 const g=partGroup(p);if(!g)return;
 const v=typeof vehicle==='function'?vehicle():null;
 const currentMatches=(g.applications||[]).some(a=>matchesVehicle(a,v));
 const evidence=(g.evidence||[])[0];
 const section=document.createElement('section');section.id='interchangeSection';section.className='detail-section';
 section.innerHTML=`<h3>Shared application / interchange</h3><p><strong>${esc(g.canonical_name)}</strong>${g.manufacturer_part_numbers?.length?` · ${esc(g.manufacturer_part_numbers.join(', '))}`:''}</p><p>${currentMatches?'The reviewed interchange record includes the selected vehicle.':'This record documents other applications for the same identified component; it does not change exact fitment for the selected vehicle.'}</p><div class="tags">${(g.applications||[]).map(a=>`<span class="tag">${esc(appLabel(a))}</span>`).join('')}</div>${(g.constraints||[]).map(x=>`<p class="fine-print">Constraint: ${esc(x)}</p>`).join('')}${evidence?.source_url?`<p><a href="${esc(evidence.source_url)}" target="_blank" rel="noopener">Check manufacturer interchange evidence ↗</a></p>`:''}<p class="fine-print">Interchange records are separate from normal fitment. A shared part number or manufacturer application can broaden discovery without silently marking unrelated vehicles as compatible.</p>`;
 root.appendChild(section);
}
const original=window.showPart;
if(typeof original==='function'){
 window.showPart=function(id){original(id);const p=typeof part==='function'?part(id):null;if(loaded)render(p);else loadPromise.then(()=>{if(document.querySelector('#partDialog')?.open)render(p)})};
}
window.ModPickerInterchange={ready:()=>loadPromise,getGroups:()=>structuredClone(groups),findForPart:id=>{const p=typeof part==='function'?part(id):null;return structuredClone(partGroup(p))}};
})();

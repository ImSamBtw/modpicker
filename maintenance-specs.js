(()=>{
'use strict';
const DATA_URL='data/manual/maintenance_specs.json';
let packs=[];
let applying=false;
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function vehicleId(){try{return window.ModPickerGarage?.getRecommendationContext?.()?.vehicle?.id||''}catch{return''}}
function packFor(id=vehicleId()){return packs.find(pack=>(pack.vehicle_ids||[]).includes(id))||null}
function cardByName(name){const target=String(name||'').trim().toLowerCase();return [...document.querySelectorAll('#maintenanceList .maintenance-card')].find(card=>String(card.querySelector('.maintenance-name')?.value||'').trim().toLowerCase()===target)||null}
function inputFor(card,field){return card?.querySelector(`[data-maint-field="${field}"]`)||null}
function setBlank(card,field,value){if(value==null||value==='')return false;const el=inputFor(card,field);if(!el||String(el.value||'').trim())return false;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));return true}
async function createItem(name){const button=$('#addMaintenanceButton');if(!button)return null;button.click();await sleep(0);let card=[...document.querySelectorAll('#maintenanceList .maintenance-card')].find(row=>!String(row.querySelector('.maintenance-name')?.value||'').trim());if(!card)return cardByName(name);const input=card.querySelector('.maintenance-name');input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}));return card}
function sourceBlock(spec,pack){const source=pack.source||{},url=String(source.source_url||'');const box=document.createElement('div');box.className='maintenance-source-reference';box.dataset.maintenanceSource=pack.id;const strong=document.createElement('strong');strong.textContent='Source reference';box.append(strong);const span=document.createElement('span');if(/^https:\/\//i.test(url)){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent=source.title||'Maintenance source';span.append(a)}else span.append(document.createTextNode(source.title||'Maintenance source'));const details=[];if(source.document_part_number)details.push(source.document_part_number);if(spec.source_pages?.length)details.push(`pages ${spec.source_pages.join(', ')}`);if(source.retrieved_at)details.push(`checked ${source.retrieved_at}`);if(details.length)span.append(document.createTextNode(` · ${details.join(' · ')}`));box.append(span);return box}
function decorate(){const pack=packFor();if(!pack)return;for(const spec of pack.items||[]){const card=cardByName(spec.name);if(!card)continue;card.querySelector('.maintenance-source-reference')?.remove();const head=card.querySelector('.maintenance-card-head');if(head)head.insertAdjacentElement('afterend',sourceBlock(spec,pack))}}
async function apply({notify=false}={}){
 if(applying||!window.ModPickerGarage)return {changed:false};const pack=packFor();if(!pack)return {changed:false};applying=true;let changed=false,created=0,filled=0;
 try{
  for(const spec of pack.items||[]){let card=cardByName(spec.name);if(!card){card=await createItem(spec.name);if(card){created++;changed=true}}if(!card)continue;
   for(const [field,value] of [['fluidSpec',spec.fluid_spec],['capacity',spec.capacity],['parts',spec.parts],['intervalMiles',spec.interval_miles],['intervalMonths',spec.interval_months]])if(setBlank(card,field,value)){filled++;changed=true}
   if(setBlank(card,'notes',spec.notes)){filled++;changed=true}
  }
  decorate();
  if(notify&&typeof window.toast==='function')window.toast(changed?'Source-backed maintenance values applied where fields were blank.':'Source-backed maintenance values are already present.');
  return {changed,created,filled,pack:pack.id};
 }finally{applying=false}
}
function sourcedReport(base){const pack=packFor();if(!pack)return base;const source=pack.source||{},lines=['','SOURCED MAINTENANCE REFERENCES'];for(const spec of pack.items||[]){lines.push(`- ${spec.name}: ${[spec.fluid_spec,spec.capacity].filter(Boolean).join(' | ')}`);lines.push(`  source: ${source.title||'Source'}${source.document_part_number?` (${source.document_part_number})`:''}${spec.source_pages?.length?` pp. ${spec.source_pages.join(', ')}`:''}${source.source_url?` | ${source.source_url}`:''}`);if(spec.interval_miles==null&&spec.interval_months==null)lines.push('  fixed interval: not stated in this source; left blank')};return `${base}${lines.join('\n')}`}
function wrapApi(){const api=window.ModPickerGarage;if(!api||api.__maintenanceSourceWrapped)return false;const baseReport=api.getMaintenanceReport?.bind(api);if(baseReport)api.getMaintenanceReport=()=>sourcedReport(baseReport());api.getMaintenanceSpecs=()=>structuredClone(packs);api.applySourcedMaintenance=options=>apply(options);api.__maintenanceSourceWrapped=true;return true}
function bind(){
 const list=$('#maintenanceList');if(list)new MutationObserver(()=>decorate()).observe(list,{childList:true,subtree:true});
 $('#seedMaintenanceButton')?.addEventListener('click',()=>setTimeout(()=>apply(),0));
 document.querySelectorAll('[data-route="garage"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>apply(),0)));
 const vehicleName=$('#vehicleName');if(vehicleName)new MutationObserver(()=>setTimeout(()=>apply(),0)).observe(vehicleName,{childList:true,subtree:true,characterData:true});
 const copy=$('#copyMaintenanceReport');if(copy)copy.addEventListener('click',async event=>{if(!window.ModPickerGarage?.getMaintenanceReport)return;event.preventDefault();event.stopImmediatePropagation();try{await navigator.clipboard.writeText(window.ModPickerGarage.getMaintenanceReport());if(typeof window.toast==='function')window.toast('Maintenance report copied with source references.')}catch{}},true);
}
async function init(){
 for(let i=0;i<40&&!window.ModPickerGarage;i++)await sleep(50);if(!window.ModPickerGarage)return;
 try{const response=await fetch(DATA_URL,{cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();packs=Array.isArray(data)?data:[]}catch(error){console.warn('Maintenance specification load failed',error);packs=[]}
 wrapApi();bind();await apply();window.ModPickerMaintenanceSpecs={getPacks:()=>structuredClone(packs),apply};
}
init();
})();

(()=>{
const base='https://pzxofwrdidvqhdlqbehk.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_C8d6CWAvqo85Cy_iGT3DZA_pfis07Xq'};
async function get(table){let all=[];for(let offset=0;offset<20000;offset+=500){const r=await fetch(`${base}${table}?select=*&limit=500&offset=${offset}`,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`${table}: ${r.status}`);const page=await r.json();all.push(...page);if(page.length<500)return all}throw new Error('Catalog exceeds pagination limit');}
async function hydrate(){try{
const [parts,fitments,sources,offers,scores,vendors,vehicles]=await Promise.all(['parts','part_fitments','sources','offers','part_scores','vendors','vehicles'].map(get));
const vendorMap=Object.fromEntries(vendors.map(x=>[x.id,x.name]));
// A previous database generation must not overwrite a newer bundled evidence snapshot.
const snapshot=Object.fromEntries((window.MODPICKER_PIPELINE_DATA?.parts||[]).map(p=>[p.id,p]));
window.MP_APPLY(parts.filter(p=>p.status==='active').map(p=>({id:p.id,brand:p.manufacturer,name:p.name,category:p.category,description:p.description,official_url:p.official_url,manufacturer_part_number:p.manufacturer_part_number,install:p.metadata?.install,fitments:fitments.filter(f=>f.part_id===p.id),sources:sources.filter(s=>s.part_id===p.id),offers:offers.filter(o=>o.part_id===p.id).map(o=>({...o,vendor:vendorMap[o.vendor_id]})),ranking:scores.find(s=>s.part_id===p.id&&s.methodology_version==='published_reviews_v2')||snapshot[p.id]?.ranking})),vehicles);
window.MODPICKER_SUPABASE={ok:true,counts:{parts:parts.length,sources:sources.length,offers:offers.length}};
const editing=document.activeElement;if(editing?.matches('input,textarea'))editing.addEventListener('blur',()=>window.renderAll(),{once:true});else window.renderAll();
}catch(e){window.MODPICKER_SUPABASE={ok:false,error:String(e)};console.warn('Using bundled catalog:',String(e));}
const banner=document.querySelector('.prototype-banner');if(banner)banner.textContent=window.MODPICKER_SUPABASE.ok?'Catalog connected · Ratings require published reviews. Confirm fitment and current seller prices before ordering.':'Saved catalog · Live updates are temporarily unavailable. Check the dates on prices and sources.';
}
window.addEventListener('load',hydrate,{once:true});
})();

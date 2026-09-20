(()=>{
const URL='https://pzxofwrdidvqhdlqbehk.supabase.co';
const KEY='sb_publishable_C8d6CWAvqo85Cy_iGT3DZA_pfis07Xq';
const headers={apikey:KEY};
const get=async(path)=>{const r=await fetch(`${URL}/rest/v1/${path}`,{headers});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json()};
const byId=(arr)=>Object.fromEntries(arr.map(x=>[x.id,x]));
async function hydrate(){
  try{
    const [dbParts,fitments,sources,offers,scores]=await Promise.all([
      get('parts?select=*'),
      get('part_fitments?select=*'),
      get('sources?select=*'),
      get('offers?select=*'),
      get('part_scores?select=*')
    ]);
    const data=window.MODPICKER_DATA;if(!data)return;
    const parts=byId(data.parts||[]),scoreMap=Object.fromEntries(scores.map(x=>[x.part_id,x]));
    for(const row of dbParts){
      const p=parts[row.id];if(!p)continue;
      p.database={source:'supabase',updated_at:row.updated_at,status:row.status,manufacturer_part_number:row.manufacturer_part_number};
      if(row.description)p.summary=row.description;
      const s=scoreMap[row.id];
      if(s){p.rating=p.rating||{};for(const k of ['overall','quality','reliability','value'])if(s[k]!=null)p.rating[k]=Number(s[k]);if(s.performance!=null)p.rating.power=Number(s.performance);if(s.handling!=null)p.rating.handling=Number(s.handling);if(s.confidence!=null)p.confidence=Number(s.confidence)}
    }
    for(const f of fitments){const p=parts[f.part_id];if(!p)continue;p.fitmentData=f;if(!p.vehicles?.includes(f.vehicle_id))p.vehicles=[...(p.vehicles||[]),f.vehicle_id]}
    for(const s of sources){const p=parts[s.part_id];if(!p)continue;p.liveSources=p.liveSources||[];if(!p.liveSources.some(x=>x.id===s.id))p.liveSources.push(s)}
    for(const o of offers){const p=parts[o.part_id];if(!p)continue;p.liveOffers=p.liveOffers||[];if(!p.liveOffers.some(x=>x.id===o.id))p.liveOffers.push(o)}
    window.MODPICKER_SUPABASE={ok:true,loadedAt:new Date().toISOString(),counts:{parts:dbParts.length,fitments:fitments.length,sources:sources.length,offers:offers.length,scores:scores.length}};
    const banner=document.querySelector('.prototype-banner');if(banner)banner.innerHTML=`<strong>Live database connected:</strong> Supabase is serving ${dbParts.length} canonical parts, ${fitments.length} fitment records and ${sources.length} evidence sources. Static catalog data remains as fallback.`;
    if(typeof window.renderAll==='function')window.renderAll();
  }catch(err){
    console.warn('Supabase hydration failed; static fallback remains active.',err);
    window.MODPICKER_SUPABASE={ok:false,error:String(err)};
    const banner=document.querySelector('.prototype-banner');if(banner)banner.innerHTML=`<strong>Fallback mode:</strong> live database is temporarily unavailable, so ModPicker is using its bundled catalog.`;
  }
}
window.addEventListener('load',hydrate,{once:true});
})();

(()=>{
const URL='https://pzxofwrdidvqhdlqbehk.supabase.co';
const KEY='sb_publishable_C8d6CWAvqo85Cy_iGT3DZA_pfis07Xq';
const headers={apikey:KEY};
const get=async(path)=>{const r=await fetch(`${URL}/rest/v1/${path}`,{headers});if(!r.ok)throw new Error(`${r.status} ${await r.text()}`);return r.json()};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
async function hydrate(){
  try{
    const [dbParts,fitments,sources,offers,scores,vendors]=await Promise.all([
      get('parts?select=*'),get('part_fitments?select=*'),get('sources?select=*'),get('offers?select=*'),get('part_scores?select=*'),get('vendors?select=id,name')
    ]);
    const data=window.MODPICKER_DATA;if(!data)return;
    const vendorMap=Object.fromEntries(vendors.map(v=>[v.id,v.name]));
    const scoreMap=Object.fromEntries(scores.map(x=>[x.part_id,x]));
    const fitByPart={};for(const f of fitments)(fitByPart[f.part_id]??=[]).push(f);
    const sourceByPart={};for(const s of sources)(sourceByPart[s.part_id]??=[]).push(s);
    const offerByPart={};for(const o of offers)(offerByPart[o.part_id]??=[]).push(o);
    const parts=Object.fromEntries((data.parts||[]).map(x=>[x.id,x]));

    for(const row of dbParts){
      const score=scoreMap[row.id];const fs=fitByPart[row.id]||[];let p=parts[row.id];
      if(!p){
        p={
          id:row.id,brand:row.manufacturer,name:row.name,category:row.category||'Other',vehicles:[],
          fitment:'Database-backed fitment. Verify exact application before purchase.',
          rating:{overall:0,quality:0,reliability:0,power:0,handling:0,value:0},confidence:0,powerImpact:0,
          goalTags:row.metadata?.goals||['balanced'],tags:[row.category||'Other','Database'],requires:[],recommended:[],conflicts:[],
          summary:row.description||`${row.manufacturer} ${row.name}`,
          pros:['Source-backed catalog entry'],cons:['Verify exact application and seller availability before purchase'],
          install:row.metadata?.install||{difficulty:'Moderate',hours:2},offers:[],evidence:[]
        };
        data.parts.push(p);parts[p.id]=p;
      }
      p.database={source:'supabase',updated_at:row.updated_at,status:row.status,manufacturer_part_number:row.manufacturer_part_number,official_url:row.official_url};
      p.brand=row.manufacturer||p.brand;p.name=row.name||p.name;p.category=row.category||p.category;
      if(row.description)p.summary=row.description;
      if(row.metadata?.install)p.install=row.metadata.install;if(row.metadata?.goals)p.goalTags=row.metadata.goals;
      if(score){
        p.rating=p.rating||{};
        p.rating.overall=Number(score.overall??p.rating.overall??0);p.rating.quality=Number(score.quality??p.rating.quality??0);
        p.rating.reliability=Number(score.reliability??p.rating.reliability??0);p.rating.power=Number(score.performance??p.rating.power??0);
        p.rating.handling=Number(score.handling??p.rating.handling??0);p.rating.value=Number(score.value??p.rating.value??0);
        p.confidence=clamp(score.confidence,0,100);p.scoreMetadata={methodology:score.methodology_version,sourceCount:score.source_count,provisional:Boolean(score.metadata?.provisional)};
      }
      for(const f of fs){if(!p.vehicles.includes(f.vehicle_id))p.vehicles.push(f.vehicle_id)}
      if(fs.length){const best=[...fs].sort((a,b)=>Number(b.confidence)-Number(a.confidence))[0];p.fitmentData=best;p.fitment=best.notes||`${best.fitment_status} fitment (${Math.round(Number(best.confidence)*100)}% evidence confidence)`;if(!score)p.confidence=Math.round(Number(best.confidence)*100)}
      const srcs=sourceByPart[p.id]||[];p.liveSources=srcs;
      const knownEvidence=new Set((p.evidence||[]).map(e=>e.url));
      p.evidence=[...(p.evidence||[]),...srcs.filter(s=>!knownEvidence.has(s.url)).map(s=>({type:`${s.source_type}`,summary:s.title||s.summary,url:s.url,confidence:s.confidence,retrieved_at:s.retrieved_at}))];
      const live=(offerByPart[p.id]||[]).filter(o=>o.price!=null).map(o=>({seller:vendorMap[o.vendor_id]||o.vendor_id,price:Number(o.price),shipping:o.shipping==null?'Check site':Number(o.shipping)===0?'Free':`$${Number(o.shipping).toFixed(2)}`,status:o.in_stock===false?'Out of stock':'Verify stock',url:o.url,live:true,retrieved_at:o.retrieved_at}));
      p.liveOffers=live;const existing=new Set((p.offers||[]).map(o=>o.url));p.offers=[...(p.offers||[]),...live.filter(o=>!existing.has(o.url))];
      p.tags=[...new Set([...(p.tags||[]),p.category,score?.metadata?.provisional?'Provisional ranking':'Database'])].filter(Boolean);
    }
    window.MODPICKER_SUPABASE={ok:true,loadedAt:new Date().toISOString(),counts:{parts:dbParts.length,fitments:fitments.length,sources:sources.length,offers:offers.length,scores:scores.length}};
    const banner=document.querySelector('.prototype-banner');if(banner)banner.innerHTML=`<strong>Live database connected:</strong> ${dbParts.length} canonical parts · ${fitments.length} fitments · ${sources.length} evidence sources · ${offers.length} live/observed offers. Static data remains as fallback.`;
    if(typeof window.renderAll==='function')window.renderAll();
  }catch(err){
    console.warn('Supabase hydration failed; static fallback remains active.',err);window.MODPICKER_SUPABASE={ok:false,error:String(err)};
    const banner=document.querySelector('.prototype-banner');if(banner)banner.innerHTML=`<strong>Fallback mode:</strong> live database is temporarily unavailable, so ModPicker is using its bundled catalog.`;
  }
}
if(document.readyState==='complete')hydrate();else window.addEventListener('load',hydrate,{once:true});
})();

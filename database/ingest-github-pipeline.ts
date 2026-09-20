import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';

const JWKS=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='modpicker-supabase';
const REPOSITORY='ImSamBtw/modpicker';
const REF='refs/heads/main';
const WORKFLOW_SUFFIX='/.github/workflows/data-pipeline.yml@refs/heads/main';
const SOURCE_PRIORITY:Record<string,number>={manufacturer:100,professional_review:90,retailer:80,forum:60,youtube:55,reddit:50};

function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}})}
function vendorId(name:string){return name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'unknown-vendor'}
async function verifyGithub(req:Request){
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))throw new Error('missing bearer token');
  const {payload}=await jwtVerify(auth.slice(7),JWKS,{issuer:ISSUER,audience:AUDIENCE});
  if(payload.repository!==REPOSITORY)throw new Error('repository not allowed');
  if(payload.ref!==REF)throw new Error('ref not allowed');
  if(!String(payload.workflow_ref||'').endsWith(WORKFLOW_SUFFIX))throw new Error('workflow not allowed');
  if(!['push','schedule','workflow_dispatch'].includes(String(payload.event_name||'')))throw new Error('event not allowed');
  return payload;
}
async function adminFetch(path:string,init:RequestInit={}){
  const base=Deno.env.get('SUPABASE_URL')!;
  const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const key=secretKeys.default;
  if(!key)throw new Error('Supabase secret key unavailable');
  const headers=new Headers(init.headers||{}); headers.set('apikey',key); headers.set('content-type','application/json');
  const r=await fetch(`${base}/rest/v1/${path}`,{...init,headers});
  if(!r.ok)throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r;
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
    const claims=await verifyGithub(req);
    const body=await req.json();
    const catalog=Array.isArray(body.parts)?body.parts:[];
    // Keep parts with an intentionally empty compatibility set in the sync
    // scope. Their category may be unknown, but their old fitment rows still
    // need to be removed when the generated snapshot says `fitments: []`.
    const parts=catalog.filter((p:any)=>p?.id&&p?.brand&&p?.name);
    const candidates=Array.isArray(body.candidates)?body.candidates:[];
    const vehicles=Array.isArray(body.vehicles)?body.vehicles:[];
    const rawSources=Array.isArray(body.sources)?body.sources:[];
    const offers=Array.isArray(body.offers)?body.offers:[];
    const status=body.status&&typeof body.status==='object'?body.status:{};
    const now=new Date().toISOString();

    const sourceMap=new Map<string,any>();
    for(const s of rawSources){
      if(!s?.part_id||!s?.url||!s?.source_type)continue;
      const key=`${s.part_id}|${s.url}`;
      const old=sourceMap.get(key);
      if(!old){sourceMap.set(key,s);continue;}
      const oldRank=[SOURCE_PRIORITY[String(old.source_type)]||40,Number(old.confidence||0)];
      const newRank=[SOURCE_PRIORITY[String(s.source_type)]||40,Number(s.confidence||0)];
      if(newRank[0]>oldRank[0]||(newRank[0]===oldRank[0]&&newRank[1]>oldRank[1]))sourceMap.set(key,s);
    }
    const sources=[...sourceMap.values()];
    const evidenceCount=new Map<string,number>();
    for(const s of sources)evidenceCount.set(s.part_id,(evidenceCount.get(s.part_id)||0)+1);

    if(vehicles.length){
      const rows=vehicles.filter((v:any)=>v.id&&v.year&&v.make&&v.model).map((v:any)=>({id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim||'Unspecified',chassis:v.chassis||null,engine:v.engine||null,metadata:v.metadata||{}}));
      if(rows.length)await adminFetch('vehicles?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});
    }
    if(parts.length){
      const partRows=parts.map((p:any)=>({
        id:p.id,manufacturer:p.brand,name:p.name,manufacturer_part_number:p.manufacturer_part_number??null,
        category:p.category||'Uncategorized',description:p.description??null,official_url:p.official_url??null,status:p.status||'active',
        metadata:{catalog_seed:!p.auto_discovered,auto_discovered:!!p.auto_discovered,install:p.install??null,goals:p.goals??[],vehicle_query:p.vehicle_query??null,fitment_status:p.fitment_status??'unknown'}
      }));
      await adminFetch('parts?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(partRows)});
      const fitRows:any[]=[];
      for(const p of parts){
        // An explicit empty array means the pipeline found no compatible
        // application and must clear old rows. Only legacy payloads that omit
        // `fitments` may use the single-record fallback.
        const fits=Array.isArray(p.fitments)?p.fitments:[{vehicle_id:p.vehicle_id,fitment_status:p.fitment_status,confidence:p.fitment_confidence,source_url:p.fitment_source_url,source_kind:'legacy_part_record'}];
        for(const fit of fits){
          if(!fit?.vehicle_id)continue;
          fitRows.push({
            part_id:p.id,vehicle_id:fit.vehicle_id,fitment_status:fit.fitment_status||'unknown',
            confidence:Number(fit.confidence??p.fitment_confidence??0.5),notes:fit.notes??p.description??null,source_url:fit.source_url??p.fitment_source_url??p.official_url??null,
            metadata:{catalog_seed:!p.auto_discovered,vehicle_query:p.vehicle_query??null,rule_id:fit.rule_id??null,source_kind:fit.source_kind??null},updated_at:now
          });
        }
      }
      // The catalog snapshot is authoritative for every published part. Clear
      // its previous application rows before inserting the current expansion so
      // removed years, retired rules, and narrowed selectors cannot remain live
      // in Supabase after a refresh.
      const partIds=[...new Set(parts.map((p:any)=>String(p.id)).filter(Boolean))];
      if(partIds.length){
        await adminFetch(`part_fitments?part_id=in.(${partIds.join(',')})`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      }
      if(fitRows.length)await adminFetch('part_fitments?on_conflict=part_id,vehicle_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(fitRows)});
      const scoreRows=catalog.filter((p:any)=>p.ranking?.methodology_version==='published_reviews_v2').map((p:any)=>({
        part_id:p.id,overall:p.ranking.overall??null,quality:p.ranking.quality??null,reliability:p.ranking.reliability??null,
        performance:p.ranking.performance??null,handling:p.ranking.handling??null,value:p.ranking.value??null,
        confidence:p.ranking.confidence??null,source_count:p.ranking.source_count||0,methodology_version:p.ranking.methodology_version||'curated_seed_v1',
        calculated_at:now,metadata:p.ranking.metadata||{}
      }));
      if(scoreRows.length)await adminFetch('part_scores?on_conflict=part_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(scoreRows)});
    }

    if(candidates.length){
      const rows=candidates.filter((c:any)=>c?.id&&c?.vehicle_id&&c?.url&&c?.title).map((c:any)=>({
        id:c.id,vehicle_id:c.vehicle_id,vendor:c.vendor||'Unknown',title:c.title,url:c.url,source_url:c.source_url??null,
        observed_price:c.observed_price??null,currency:c.currency||'USD',fitment_confidence:Number(c.fitment_confidence??0.5),
        metadata:c.metadata??{},discovered_at:c.discovered_at??now,updated_at:now
      }));
      if(rows.length)await adminFetch('catalog_candidates?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows)});
    }

    if(sources.length){
      const rows=sources.map((s:any)=>({id:s.id,part_id:s.part_id,source_type:s.source_type,url:s.url,title:s.title??null,outlet:s.outlet??null,published_at:s.published_at??null,retrieved_at:s.retrieved_at??now,summary:s.summary??null,confidence:s.confidence??0.5,metadata:{...(s.metadata??{}),ingested_via:'github_oidc'}}));
      await adminFetch('sources?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});
    }
    if(offers.length){
      const vendors=new Map<string,any>();
      for(const o of offers){const name=String(o.vendor||'Unknown vendor');const id=vendorId(name);vendors.set(id,{id,name})}
      await adminFetch('vendors?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify([...vendors.values()])});
      const rows=offers.map((o:any)=>({id:o.id,part_id:o.part_id,vendor_id:vendorId(String(o.vendor||'Unknown vendor')),vendor_sku:o.vendor_sku??null,url:o.url,price:o.price??null,shipping:typeof o.shipping==='number'?o.shipping:null,currency:o.currency||'USD',condition:o.condition||'new',in_stock:o.in_stock??null,source_type:o.source_type??null,retrieved_at:o.retrieved_at??now,metadata:{...(o.metadata??{}),ingested_via:'github_oidc'}}));
      await adminFetch('offers?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify(rows)});
      const hist=rows.filter((o:any)=>o.price!=null).map((o:any)=>({offer_id:o.id,part_id:o.part_id,vendor_id:o.vendor_id,price:o.price,shipping:o.shipping,currency:o.currency,in_stock:o.in_stock,captured_at:o.retrieved_at,captured_date:String(o.retrieved_at||now).slice(0,10),metadata:{source:'github-oidc'}}));
      if(hist.length)await adminFetch('price_history?on_conflict=offer_id,captured_date',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(hist)});
    }
    await adminFetch('pipeline_state?id=eq.github-sync',{method:'PATCH',body:JSON.stringify({last_started_at:now,last_completed_at:now,last_status:status.ok===false?'degraded':'success',source_count:sources.length,offer_count:offers.length,details:{github_status:status,run_id:claims.run_id,workflow_ref:claims.workflow_ref,repository:claims.repository,catalog_parts:parts.length,candidates:candidates.length},updated_at:now})});
    return reply({ok:true,parts:parts.length,candidates:candidates.length,sources:sources.length,offers:offers.length,run_id:claims.run_id});
  }catch(e){console.error(String(e));return reply({ok:false,error:'Authentication or ingestion failed; inspect function logs.'},400)}
});

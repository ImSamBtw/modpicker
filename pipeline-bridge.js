/* One canonical data adapter shared by the bundled snapshot and live database. */
(()=>{
const data=window.MODPICKER_DATA;
const text=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
window.MP_TEXT=text;window.MP_URL=url;
const metrics=['overall','quality','reliability','power','handling','value'];
function normalizePlatform(p){return {...p,id:String(p.id||''),make:String(p.make||''),name:String(p.name||''),display_name:String(p.display_name||p.name||''),type:String(p.type||'platform'),aliases:Array.isArray(p.aliases)?p.aliases.map(String):[],vehicle_ids:Array.isArray(p.vehicle_ids)?p.vehicle_ids.map(String):[],categories:Array.isArray(p.categories)?p.categories.map(String):[],description:String(p.description||''),source_urls:Array.isArray(p.source_urls)?p.source_urls.map(url).filter(Boolean):[]}}
function apply(rows,vehicles=[],platforms=[]){
 data.platforms=(platforms.length?platforms:(data.platforms||[])).map(normalizePlatform).filter(p=>p.id);window.MODPICKER_PLATFORMS=data.platforms;
 for(const v of vehicles){if(!data.vehicles.some(x=>x.id===v.id))data.vehicles.push({...v,make:text(v.make),model:text(v.model),trim:text(v.trim||'Unspecified'),chassis:text(v.chassis||'Not specified'),engine:text(v.engine||'Not specified'),tags:(v.tags||['Model record · confirm exact trim']).map(text)});}
 for(const row of rows){
  let p=data.parts.find(x=>x.id===row.id);
  if(!/^[a-zA-Z0-9_-]+$/.test(row.id))continue;
  if(!p){p={id:row.id,vehicles:[],requires:[],conflicts:[],recommended:[],tags:[],goalTags:[],evidence:[]};data.parts.push(p)}
  for(const [target,key] of [['brand','brand'],['name','name'],['category','category'],['summary','description']])if(row[key])p[target]=text(row[key]);
  p.brand||='Unknown brand';p.category||='Other';p.summary||='Product information awaiting verification.';
  const fitments=Array.isArray(row.fitments)?row.fitments.filter(x=>x&&x.vehicle_id).map(x=>({...x,vehicle_id:String(x.vehicle_id),source_url:url(x.source_url||x.fitment_source_url)})):[];
  if(row.vehicle_id&&!p.vehicles.includes(String(row.vehicle_id)))p.vehicles.push(String(row.vehicle_id));
  if(Array.isArray(row.fitments))p.vehicles=[...new Set(fitments.map(x=>x.vehicle_id))];
  p.fitments=fitments.length?fitments:(row.vehicle_id?[{vehicle_id:String(row.vehicle_id),fitment_status:row.fitment_status||'unknown',source_url:url(row.fitment_source_url),confidence:Number(row.fitment_confidence??0.5),source_kind:'legacy_part_record'}]:[]);
  p.fitmentSummary=row.fitment_summary||null;
  p.platform_ids=Array.isArray(row.platform_ids)?row.platform_ids.map(String):[];
  p.fitment='Confirm exact vehicle, trim, engine and part number with the linked source.';
  p.officialUrl=url(row.official_url);p.mpn=text(row.manufacturer_part_number||'');
  p.install=row.install||null;p.powerImpact=null;p.pros=[];p.cons=[];
  p.liveSources=(row.sources||[]).map(s=>({...s,url:url(s.url),title:text(s.title),outlet:text(s.outlet),summary:text(s.summary)})).filter(s=>s.url);
  p.evidence=p.liveSources.map(s=>({type:s.source_type,url:s.url,summary:s.title}));
  p.liveOffers=row.offers||[];
  p.offers=p.liveOffers.filter(o=>url(o.url)&&Number.isFinite(Number(o.price))&&Number(o.price)>0&&o.currency==='USD'&&o.in_stock!==false&&o.metadata?.identity_matched!==false&&!/google\.|bing\.|\/search/.test(o.url)).map(o=>({...o,url:url(o.url),seller:text(o.vendor||o.seller||'Seller'),price:Number(o.price),shipping:o.shipping==null?'Shipping unknown':Number(o.shipping)===0?'Free shipping':`Shipping $${Number(o.shipping).toFixed(2)}`,status:o.in_stock===true?'In stock when checked':'Stock unknown',live:true}));
  const r=row.ranking;const valid=r?.methodology_version==='published_reviews_v2';
  p.rating=Object.fromEntries(metrics.map(m=>[m,valid&&Number.isFinite(r[m==='power'?'performance':m])?r[m==='power'?'performance':m]:null]));
  p.scoreMetadata=valid?{...r.metadata,methodology:r.methodology_version,sourceCount:r.source_count}:{review_count:0,evidence:[],provisional:true};
  p.confidence=0;p.tags=[p.category,row.auto_discovered?'Auto-discovered':'Catalog'];
 }
}
// Remove all demonstration ratings, offers, performance claims and install estimates before first paint.
for(const p of data.parts){p.rating=Object.fromEntries(metrics.map(m=>[m,null]));p.confidence=0;p.offers=[];p.powerImpact=null;p.install=null;p.pros=[];p.cons=[];p.evidence=[];p.tags=[p.category];}
window.MP_APPLY=apply;
const snapshot=window.MODPICKER_PIPELINE_DATA||{};apply(snapshot.parts||[],snapshot.vehicles||[],snapshot.platforms||[]);window.MODPICKER_PIPELINE_STATUS=snapshot.status||{};
})();

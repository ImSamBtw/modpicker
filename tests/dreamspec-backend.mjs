import assert from 'node:assert/strict';
import {createHandler,validateInput,validateResult} from '../supabase/functions/dreamspec-diagnose/handler.mjs';
const uid='11111111-1111-4111-8111-111111111111',vid='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333',runid='44444444-4444-4444-8444-444444444444';
const key='sk-proj-test-key-never-store-1234567890';
const raw={summary:'Possible intake leak',urgency:'Inspect before replacement.',limitations:'Fault not confirmed.',causes:[{cause:'Vacuum leak',reason:'Unmetered air can cause a lean code.',source_urls:['https://www.corvetteforum.com/forums/c6-tech-performance/123.html','https://evil.example/fabricated']}],steps:[{action:'Inspect accessible intake connections',expected:'Record any cracked or loose connection',safety:'Work with the engine off and cool.',source_urls:[]}],repairs:[{component:'Intake connection',when_confirmed:'Only after a test confirms a leak.',catalog_ids:['hose','invented']}],sources:[{url:'https://evil.example/fabricated',title:'Invented',note:'Ignore this'}]};
const ai={status:'completed',model:'gpt-5-mini',output:[{type:'web_search_call',action:{sources:[{url:'https://www.corvetteforum.com/forums/c6-tech-performance/123.html',title:'Owner troubleshooting thread'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]};
function fixture(options={}){
 const calls=[],dbBodies=[];
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',OPENAI_API_KEY:'host-credits-must-never-be-used'};
 if(options.splitCatalog){env.DREAMSPEC_CATALOG_URL='https://catalog.supabase.co';env.DREAMSPEC_CATALOG_KEY='catalog-public-key'}
 const fetcher=async(url,init={})=>{
  calls.push({url,init});
  if(url.includes('/auth/v1/user'))return Response.json(options.invalidToken?{}:{id:uid},{status:options.invalidToken?401:200});
  const body=init.body?JSON.parse(init.body):null;
  if(url.includes('/rest/v1/')){
   dbBodies.push(body);
   const publicRead=/\/(vehicles|part_fitments|parts)\?/.test(url);
   assert.equal(new URL(url).origin,publicRead&&options.splitCatalog?'https://catalog.supabase.co':'https://test.supabase.co');
   if(publicRead){
    assert.equal(init.headers.Authorization,undefined,'never send a private JWT to the public catalog');
    assert.equal(init.headers.apikey,options.splitCatalog?'catalog-public-key':'public');
    if(options.catalogUnavailable)return Response.json({message:'unavailable'},{status:503});
   }else assert.equal(init.headers.Authorization,'Bearer user-jwt');
  }
  if(url.includes('owned_vehicles?'))return Response.json(options.otherOwner?[{id:vid,owner_id:'other'}]:[{id:vid,owner_id:uid,catalog_vehicle_id:'car',profile:{currentMods:'Stock',maintenance:[]}}]);
  if(url.includes('/vehicles?'))return Response.json([{id:'car',year:2007,make:'Chevrolet',model:'Corvette',engine:'LS2'}]);
  if(url.includes('begin_diagnostic_run'))return options.rateLimit?Response.json({message:'diagnostic_rate_limit'},{status:400}):Response.json({id:runid,status:options.completed?'completed':'pending',result:raw,event_id:'event',reused:!!options.reused});
  if(url.includes('part_fitments?'))return Response.json([{part_id:'hose',source_url:'https://manufacturer.example/application'}]);
  if(url.includes('/parts?'))return Response.json([{id:'hose',manufacturer:'OE supplier',name:'Intake hose',manufacturer_part_number:'ABC123'}]);
  if(url.includes('finish_diagnostic_run'))return options.saveFails?Response.json({message:'unavailable'},{status:503}):Response.json({event_id:'event',result:body.p_result});
  if(url.includes('diagnostic_runs?'))return Response.json({});
  if(url==='https://api.openai.com/v1/responses'){
   assert.equal(init.headers.Authorization,'Bearer '+key,'use only this request’s key');
   assert.equal(body.store,false);
   assert.equal(body.tool_choice,'required');
   assert.ok(body.tools[0].filters.allowed_domains.includes('corvetteforum.com'));
   assert.ok(!init.body.includes(key),'do not send the key as prompt content');
   return options.providerFails?Response.json({error:'no credits'},{status:429}):Response.json(options.malformed?{...ai,output:[]}:ai);
  }
  throw new Error('Unexpected URL '+url);
 };
 return {handler:createHandler({env,fetcher}),calls,dbBodies};
}
function request({token=true,byok=true,origin='https://imsambtw.github.io',body={}}={}){
 return new Request('https://test.supabase.co/functions/v1/dreamspec-diagnose',{method:'POST',headers:{...(token?{Authorization:'Bearer user-jwt'}:{}),...(byok?{'X-DreamSpec-AI-Key':key}:{}),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({vehicle_id:vid,request_id:rid,symptoms:'Lean code after a rough idle',codes:['P0171'],...body})});
}
for(const [setup,input,status] of [[{}, {token:false},401],[{invalidToken:true},{},401],[{}, {byok:false},402],[{otherOwner:true},{},404],[{}, {origin:'https://evil.example'},403],[{}, {body:{codes:['INVALID']}},400],[{rateLimit:true},{},429],[{catalogUnavailable:true},{},503]]){
 const f=fixture(setup),response=await f.handler(request(input));assert.equal(response.status,status);
 assert.equal(f.calls.filter(x=>x.url.includes('api.openai.com')).length,0,'rejected calls must never spend AI tokens');
}
const f=fixture(),response=await f.handler(request()),result=await response.json();
assert.equal(response.status,200);assert.equal(result.saved,true);
assert.deepEqual(result.result.sources.map(x=>x.url),['https://www.corvetteforum.com/forums/c6-tech-performance/123.html']);
assert.equal(result.result.catalog_parts.length,1);assert.equal(result.result.catalog_parts[0].mpn,'ABC123');
assert.equal(result.result.causes[0].source_urls.length,1);
assert.ok(!JSON.stringify(f.dbBodies).includes(key),'credentials must never be saved');
assert.equal(f.calls.filter(x=>x.url.includes('finish_diagnostic_run')).length,1,'log the result automatically');
for(const opt of [{completed:true},{reused:true}]){
 const retry=fixture(opt),res=await retry.handler(request());assert.equal(res.status,opt.completed?200:409);assert.equal(retry.calls.filter(x=>x.url.includes('api.openai.com')).length,0,'retries must not bill twice');
}
const split=fixture({splitCatalog:true});
assert.equal((await split.handler(request())).status,200);
assert.equal(split.calls.filter(x=>x.url.startsWith('https://catalog.supabase.co/')).length,3);
const failed=fixture({providerFails:true});assert.equal((await failed.handler(request())).status,429);
assert.ok(failed.calls.some(x=>x.url.includes('diagnostic_runs?')),'failed inference is recorded without credentials');
const saving=fixture({saveFails:true});const unsaved=await (await saving.handler(request())).json();assert.equal(unsaved.saved,false);assert.equal(unsaved.run_id,runid);assert.ok(unsaved.result,'allow saving the result again without another AI call');
const malformed=fixture({malformed:true});assert.equal((await malformed.handler(request())).status,502);
assert.throws(()=>validateInput({vehicle_id:'bad'}));
const redacted=validateResult({...raw,summary:key},ai,[],key);assert.ok(!JSON.stringify(redacted).includes(key));
console.log('PASS: verified auth, ownership, BYOK-only billing, bounded input, retrieved citations, exact catalog IDs, idempotency, rate limits and automatic logging.');

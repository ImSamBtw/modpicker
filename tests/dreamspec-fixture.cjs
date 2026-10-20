/* Network fixtures are test-only. Production code always verifies the Supabase user. */
const crypto=require('node:crypto');
const A='11111111-1111-4111-8111-111111111111',B='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const first='22222222-2222-4222-8222-222222222222';
const configContext={window:{}};
require('node:vm').runInNewContext(
 require('node:fs').readFileSync(require('node:path').join(__dirname,'..','dreamspec-config.js'),'utf8'),
 configContext
);
const BASE=configContext.window.DREAM_SPEC_CONFIG.supabaseUrl;
async function install(page){
 const rows=[{id:first,owner_id:A,catalog_vehicle_id:'z3-2000-28',year:2000,make:'BMW',model:'Z3',engine:'M52TU B28',variant:'2.8 Roadster',nickname:'',profile:{photos:[],maintenance:[],codes:[],receipts:[]},build:{},version:1,created_at:new Date().toISOString()},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',owner_id:B,catalog_vehicle_id:'z3-2000-28',year:2000,make:'BMW',model:'Z3',engine:'M52TU B28',variant:'2.8 Roadster',nickname:'Other account project',profile:{nickname:'Other account project',photos:[],maintenance:[],codes:[],receipts:[]},build:{},version:1}];
 const events=[],calls=[],photos=new Map();
 await page.route(BASE+'/storage/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.includes('/object/sign/')&&request.method()==='POST')return route.fulfill({json:{signedURL:url.pathname.replace('/storage/v1','')+'?token=test'}});
  const path=url.pathname.split('/vehicle-photos/')[1];
  if(request.method()==='POST'&&path){photos.set(path,request.postDataBuffer());return route.fulfill({json:{Key:path}})}
  if(request.method()==='DELETE'){for(const p of request.postDataJSON().prefixes)photos.delete(p);return route.fulfill({json:{}})}
  if(request.method()==='GET'&&photos.has(path))return route.fulfill({body:photos.get(path),contentType:'image/jpeg'});
  return route.fulfill({status:404,json:{}});
 });
 await page.route(BASE+'/auth/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.postDataJSON?.()||{};
  if(url.pathname.endsWith('/token')){
   const user=body.email==='other@example.test'?B:A;
   return route.fulfill({json:{access_token:'test-'+user,refresh_token:'refresh-'+user,expires_in:3600,user:{id:user,email:body.email}}});
  }
  if(url.pathname.endsWith('/user')){
   const id=(request.headers().authorization||'').slice('Bearer test-'.length);
   return route.fulfill({json:{id,email:id===B?'other@example.test':'owner@example.test'}});
  }
  return route.fulfill({json:{}});
 });
 await page.route(BASE+'/rest/v1/owned_vehicles**',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),id=(request.headers().authorization||'').slice('Bearer test-'.length);
  calls.push({url:url.href,method});
  let own=rows.filter(r=>r.owner_id===id);const filter=url.searchParams.get('id');if(filter)own=own.filter(r=>r.id===filter.slice(3));
  if(method==='POST'){const body=request.postDataJSON(),row={...body,id:crypto.randomUUID(),owner_id:id,version:1,created_at:new Date().toISOString()};rows.push(row);return route.fulfill({json:[row]})}
  if(method==='PATCH'){
   const version=url.searchParams.get('version'),row=own.find(r=>!version||String(r.version)===version.slice(3));
   if(row){Object.assign(row,request.postDataJSON());row.version++}
   return route.fulfill({json:row?[row]:[]});
  }
  return route.fulfill({json:own});
 });
 await page.route(BASE+'/rest/v1/vehicle_events**',async route=>{
  const request=route.request(),url=new URL(request.url()),id=(request.headers().authorization||'').slice('Bearer test-'.length);
  let own=events.filter(e=>e.owner_id===id);
  const filter=url.searchParams.get('vehicle_id');if(filter)own=own.filter(e=>e.vehicle_id===filter.slice(3));
  if(request.method()==='PATCH'){const event=own.find(e=>e.id===url.searchParams.get('id')?.slice(3));if(event)Object.assign(event,request.postDataJSON())}
  return route.fulfill({json:own});
 });
 await page.route(BASE+'/functions/v1/dreamspec-diagnose',async route=>{
  const request=route.request(),body=request.postDataJSON(),id=(request.headers().authorization||'').slice('Bearer test-'.length);
  calls.push({url:request.url(),headers:request.headers(),body});
  const result={summary:'Inspect for an intake leak',urgency:'Inspect before replacing parts.',limitations:'Unconfirmed; verify with tests.',causes:[{cause:'Vacuum leak',reason:'Possible unmetered air',source_urls:[]}],steps:[{action:'Inspect intake connections',expected:'Document damaged connections',safety:'Engine off and cool',source_urls:[]}],repairs:[{component:'Intake hose',when_confirmed:'After confirming a leak',catalog_ids:[]}],sources:[{url:'https://www.corvetteforum.com/forums/c6-tech-performance/123.html',title:'Owner experience',note:'Check the exact engine match.'}],catalog_parts:[]};
  events.push({id:crypto.randomUUID(),owner_id:id,vehicle_id:body.vehicle_id,title:'Diagnosis: Inspect for an intake leak',status:'unconfirmed',payload:{symptoms:body.symptoms,result},created_at:new Date().toISOString()});
  return route.fulfill({json:{result,run_id:crypto.randomUUID(),saved:true}});
 });
 return {rows,events,calls,A,B,first};
}
async function signIn(page,email='owner@example.test'){
 await page.evaluate(()=>route('account',false));
 await page.locator('#accountForm input[name="email"]').fill(email);
 await page.locator('#accountForm input[name="password"]').fill('Test-password-12345');
 await page.locator('#accountForm button[value="login"]').click();
 await page.waitForFunction(()=>window.DSAuth?.user&&window.DSOwned?.active);
}
module.exports={install,signIn};

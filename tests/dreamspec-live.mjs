/* Read-only checks against deployed public endpoints. Never signs up users or calls AI. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.runInNewContext(fs.readFileSync('dreamspec-config.js','utf8'),context);
const cfg=context.window.DREAM_SPEC_CONFIG;
const entry=fs.readFileSync('supabase/functions/dreamspec-diagnose/index.ts','utf8');
const catalogUrl=entry.match(/DREAMSPEC_CATALOG_URL:.*?\|\|'([^']+)'/)?.[1]||cfg.supabaseUrl;
const catalogKey=entry.match(/DREAMSPEC_CATALOG_KEY:.*?\|\|'([^']+)'/)?.[1]||cfg.publishableKey;
const origin=process.env.DREAMSPEC_TEST_ORIGIN||'https://imsambtw.github.io';
const get=(url,headers={})=>fetch(url,{headers,signal:AbortSignal.timeout(20000)});

const settingsResponse=await get(cfg.supabaseUrl+'/auth/v1/settings',{apikey:cfg.publishableKey});
assert.equal(settingsResponse.status,200,'Auth must recognize the configured public key');
const settings=await settingsResponse.json();
assert.equal(settings.external?.email,true,'Email/password login must be enabled');
assert.equal(settings.disable_signup,false,'The account creation path must be enabled');

for(const table of ['owned_vehicles','diagnostic_runs','vehicle_events']){
 const response=await get(cfg.supabaseUrl+'/rest/v1/'+table+'?select=id&limit=1',{apikey:cfg.publishableKey});
 assert.ok([401,403].includes(response.status),'Anonymous access must be denied: '+table);
}
const functionUrl=cfg.supabaseUrl+'/functions/v1/'+cfg.diagnoseFunction;
for(const authorization of ['', 'Bearer invalid-user-jwt']){
 const response=await fetch(functionUrl,{method:'POST',headers:{apikey:cfg.publishableKey,Origin:origin,'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:'{}',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,401,'The function must reject unauthenticated requests');
}
const preflight=await fetch(functionUrl,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-dreamspec-ai-key'},signal:AbortSignal.timeout(20000)});
assert.ok([200,204].includes(preflight.status),'Browser preflight must succeed');
assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
assert.ok(preflight.headers.get('access-control-allow-headers')?.toLowerCase().includes('x-dreamspec-ai-key'));

for(const [table,fields] of [['vehicles','id,year,make,model,engine,trim'],['part_fitments','part_id,vehicle_id,fitment_status,source_url'],['parts','id,manufacturer,name,manufacturer_part_number,official_url,category']]){
 const response=await get(catalogUrl+'/rest/v1/'+table+'?select='+fields+'&limit=1',{apikey:catalogKey});
 assert.equal(response.status,200,'The existing public catalog must remain accessible: '+table);
 assert.ok(Array.isArray(await response.json()));
}
console.log('PASS: live email-auth configuration, anonymous private-table rejection, function JWT gate, browser CORS and public catalog compatibility. No accounts created, emails sent or AI calls made.');

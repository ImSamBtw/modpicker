/* Exercise the deployed entrypoint with verified-claim and database boundaries mocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const repository='jakehenry076-cmd/modpicker';
const valid={repository,ref:'refs/heads/main',workflow_ref:repository+'/.github/workflows/data-pipeline.yml@refs/heads/main',event_name:'schedule',run_id:'test-run'};
const jwks={},writes=[];
let handle,claims=valid,verifications=0;
const source=fs.readFileSync('database/ingest-github-pipeline.ts','utf8');
const withoutImport=source.replace(/^import \{ createRemoteJWKSet, jwtVerify \} from 'npm:jose@6\.2\.12';\r?\n/,'');
assert.notEqual(withoutImport,source,'Mock only the external JWT-verification boundary');
vm.runInNewContext(stripTypeScriptTypes(withoutImport),{
 URL,Request,Response,Headers,
 console:{error(){}},
 createRemoteJWKSet(url){assert.equal(url.href,'https://token.actions.githubusercontent.com/.well-known/jwks');return jwks},
 async jwtVerify(token,keys,options){
  verifications++;
  assert.equal(keys,jwks);
  assert.equal(options.issuer,'https://token.actions.githubusercontent.com');
  assert.equal(options.audience,'modpicker-supabase');
  if(token!=='verified-test-token')throw new Error('invalid signature');
  return {payload:claims};
 },
 Deno:{serve(fn){handle=fn},env:{get(name){return {SUPABASE_URL:'https://catalog.example.test',SUPABASE_SECRET_KEYS:'{"default":"test-only-key"}'}[name]}}},
 async fetch(url,init){writes.push({url,init});return Response.json({})}
},{filename:'ingest-github-pipeline.js'});
assert.equal(typeof handle,'function');

async function request(payload,{token='verified-test-token',allowed=false}={}){
 claims=payload;writes.length=0;
 const response=await handle(new Request('https://catalog.example.test/functions/v1/ingest-github-pipeline',{
  method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:'{}'
 }));
 assert.equal(response.status,allowed?200:400);
 assert.equal((await response.json()).ok,allowed);
 if(allowed){
  assert.equal(writes.length,1);
  assert.equal(writes[0].url,'https://catalog.example.test/rest/v1/pipeline_state?id=eq.github-sync');
  assert.equal(JSON.parse(writes[0].init.body).details.repository,repository);
 }else assert.equal(writes.length,0,'rejected identities must not write to the catalog');
}

for(const event_name of ['push','schedule','workflow_dispatch'])await request({...valid,event_name},{allowed:true});
await request({...valid,repository:'ImSamBtw/modpicker'});
await request({...valid,repository:'unrelated/modpicker'});
await request({...valid,ref:'refs/heads/refactor/dream-spec-hub'});
await request({...valid,workflow_ref:repository+'/.github/workflows/pr-checks.yml@refs/heads/main'});
await request({...valid,workflow_ref:repository+'/.github/workflows/data-pipeline.yml@refs/heads/feature'});
await request({...valid,event_name:'pull_request'});
await request(valid,{token:'forged-test-token'});
const beforeMissingToken=verifications;
await request(valid,{token:''});
assert.equal(verifications,beforeMissingToken,'missing tokens must be rejected before verification');
console.log('PASS: transferred repository ingestion, main/workflow/event restrictions, invalid JWT rejection and no writes for rejected identities.');

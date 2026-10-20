/* Private owned vehicles. Only explicit legacy import reads the old local profiles. */
(()=>{
'use strict';
const {esc,safeUrl}=window.DreamSpecCore;
let owner=null,rows=[],activeId=null,events=[],epoch=0,switching=false,dirty=false,timer=null,saving=null,publicState=null;
const empty=()=>({photos:[],maintenance:[],codes:[],receipts:[]});
function active(){return rows.find(r=>r.id===activeId)||null}
function isPrivateContext(){return !!owner&&!!active()&&active().catalog_vehicle_id===state.vehicleId}
function capturesCurrent(){return !switching&&isPrivateContext()}
function getProfile(vehicleId){return owner&&active()?.catalog_vehicle_id===(vehicleId||state.vehicleId)?active().profile:empty()}
function setStatus(text){const el=document.querySelector('#garageSyncStatus');if(el)el.textContent=text}
function notify(text){if(typeof toast==='function')toast(text);setStatus(text)}
function emit(){document.dispatchEvent(new CustomEvent('ds:owned',{detail:{vehicle:active()}}))}
function cleanProfile(profile){
 const p=structuredClone(profile||empty());p.photos=(Array.isArray(p.photos)?p.photos:[]).slice(0,4).filter(x=>typeof x.path==='string').map(x=>({name:String(x.name||'Vehicle photo').slice(0,160),path:x.path,addedAt:x.addedAt}));
 return p;
}
function queue(){if(!capturesCurrent())return false;dirty=true;clearTimeout(timer);timer=setTimeout(()=>flush().catch(e=>notify(e.message)),600);setStatus('Saving changes…');return true}
function saveProfile(){return queue()}
function captureBuild(){
 if(!capturesCurrent())return;
 const row=active(),next=buildPayload();
 if(JSON.stringify(row.build)!==JSON.stringify(next)){row.build=structuredClone(next);queue()}
}
async function storage(path,options={}){
 const token=await window.DSAuth.token(),cfg=window.DREAM_SPEC_CONFIG;
 const response=await fetch(cfg.supabaseUrl+'/storage/v1/'+path,{...options,headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error('Could not save or load this private photo.');return data;
}
async function signPhotos(row){
 const expected=epoch;
 for(const photo of row.profile.photos||[]){
  if(!photo.path?.startsWith(owner+'/'+row.id+'/'))continue;
  try{const result=await storage('object/sign/vehicle-photos/'+photo.path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});
   if(expected!==epoch)return;photo.data=window.DREAM_SPEC_CONFIG.supabaseUrl+'/storage/v1'+result.signedURL;
  }catch{photo.data=''}
 }
}
async function addPhoto(data,name){
 const row=active();if(!capturesCurrent()||!row)throw new Error('Select a saved vehicle first.');
 if((row.profile.photos||[]).length>=4)throw new Error('Four photos are already saved.');
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)||data.length>900000)throw new Error('Use a smaller JPEG photo.');
 const path=owner+'/'+row.id+'/'+crypto.randomUUID()+'.jpg',bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0)),expected=epoch;
 await storage('object/vehicle-photos/'+path,{method:'POST',headers:{'Content-Type':'image/jpeg','x-upsert':'false'},body:bytes});
 if(expected!==epoch||activeId!==row.id)throw new Error('Vehicle changed before photo upload finished.');
 row.profile.photos??=[];row.profile.photos.push({name,path,data,addedAt:new Date().toISOString()});queue();
}
async function removePhoto(index){
 const row=active(),photo=row?.profile.photos?.[index];if(!photo)return;
 await storage('object/vehicle-photos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[photo.path]})});
 row.profile.photos.splice(index,1);queue();window.ModPickerGarage?.refresh?.();
}
async function flush(){
 clearTimeout(timer);timer=null;if(saving){await saving;if(dirty)return flush();return}
 if(!dirty||!owner||!active())return;
 const row=active(),expected=epoch,payload={profile:cleanProfile(row.profile),build:structuredClone(row.build||{}),nickname:String(row.profile.nickname||row.nickname||'').slice(0,100)};
 dirty=false;
 saving=(async()=>{
  try{
   const values=await DSAuth.request('owned_vehicles?id=eq.'+row.id+'&version=eq.'+row.version,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
   if(expected!==epoch)return;
   if(!values?.length)throw new Error('This vehicle was updated in another session. Reload the garage before continuing.');
   row.version=values[0].version;row.nickname=payload.nickname;setStatus(dirty?'Saving changes…':'All changes saved');
  }catch(e){if(expected===epoch)dirty=true;throw e}
 })().finally(()=>{saving=null});
 await saving;if(dirty)return flush();
}
async function select(id){
 await flush();const row=rows.find(r=>r.id===id);if(!row)throw new Error('Choose a saved vehicle.');
 if(!publicState)publicState=structuredClone(state);
 window.ModPickerGarage?.clear?.();switching=true;activeId=id;
 try{
  const view=state.route;switchVehicle(row.catalog_vehicle_id);
  if(Array.isArray(row.build?.build)){acceptBuild({...row.build,vehicleId:row.catalog_vehicle_id});state.route=view}
  else Object.assign(state,{build:[],buildMeta:{},buildName:row.nickname||'My build',budget:5000,laborRate:0,goal:'balanced'});
  renderAll();
 }finally{switching=false}
 window.ModPickerGarage?.refresh?.();await loadEvents();render();emit();
}
async function loadEvents(){
 const row=active(),expected=epoch;if(!row)return;
 const values=await DSAuth.request('vehicle_events?vehicle_id=eq.'+row.id+'&order=created_at.desc&limit=50');
 if(expected===epoch&&activeId===row.id){events=values||[];renderHistory()}
}
function renderHistory(){
 const root=document.querySelector('#diagnosisHistory');if(!root)return;
 root.innerHTML=events.length?events.map(e=>'<article class="ds-event"><div class="ds-event-top"><strong>'+esc(e.title)+'</strong><span class="tag">'+(e.status==='resolved'?'Resolved':'Diagnostic · unconfirmed')+'</span></div><p>'+esc(e.payload?.symptoms||'')+'</p><small>'+esc(new Date(e.created_at).toLocaleString())+'</small><details><summary>Diagnostic notes and sources</summary><pre class="ds-event-payload">'+esc(JSON.stringify(e.payload?.result||e.payload,null,2))+'</pre></details>'+(e.status!=='resolved'?'<label>Repair / verification notes<input data-event-note="'+esc(e.id)+'" maxlength="2000" placeholder="What did you verify or repair?"></label><button class="button secondary small" data-resolve-event="'+esc(e.id)+'">Record resolution</button>':'<p>'+esc(e.resolution||'')+'</p>')+'</article>').join(''):'<p class="ds-muted">Diagnoser sessions will appear here automatically.</p>';
}
function render(){
 const selector=document.querySelector('#ownedVehicleSelect'),editor=document.querySelector('#garageEditor');
 if(selector){selector.innerHTML=rows.length?rows.map(r=>'<option value="'+esc(r.id)+'">'+esc((r.profile.nickname||r.nickname||'My vehicle')+' · '+r.year+' '+r.make+' '+r.model+' · '+(r.engine||'engine unspecified'))+'</option>').join(''):'<option value="">No vehicles saved yet</option>';selector.value=activeId||''}
 const editable=!!owner&&!!active()&&active().catalog_vehicle_id===state.vehicleId;
 if(editor)editor.hidden=!editable;
 const hint=document.querySelector('#garageSelectionHint');if(hint)hint.textContent=!owner?'Log in to open your garage.':!rows.length?'Choose your vehicle above, then add it to your garage.':editable?'Each saved vehicle has its own profile and build sheet.':'Select a saved vehicle to edit its profile, or add the vehicle selected above.';
 const runVehicle=document.querySelector('#diagnoseVehicle');if(runVehicle){const selected=runVehicle.value;runVehicle.innerHTML=rows.map(r=>'<option value="'+esc(r.id)+'">'+esc((r.profile.nickname||r.nickname||'')+' · '+r.year+' '+r.make+' '+r.model+' '+(r.engine||''))+'</option>').join('');runVehicle.value=rows.some(r=>r.id===selected)?selected:(activeId||rows[0]?.id||'')}
 renderHistory();
}
async function create({catalogId=state.vehicleId,nickname='',profile=empty(),build={},legacyKey=null}={}){
 await flush();const v=window.MODPICKER_DATA.vehicles.find(x=>x.id===catalogId);if(!v)throw new Error('Choose a catalog vehicle first.');
 const photoData=(profile.photos||[]).filter(x=>/^data:image\/jpeg;base64,/.test(x.data||''));
 const payload={catalog_vehicle_id:v.id,year:v.year,make:v.make,model:v.model,engine:v.engine||'',variant:v.trim||'',nickname,profile:{...profile,nickname:profile.nickname||nickname,photos:[]},build,legacy_import_key:legacyKey};
 const expected=epoch;const values=await DSAuth.request('owned_vehicles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
 if(epoch!==expected)return;rows.push(values[0]);await select(values[0].id);
 for(const photo of photoData.slice(0,4))await addPhoto(photo.data,photo.name);
 await flush();window.ModPickerGarage?.refresh?.();render();return active();
}
async function importLegacy(){
 let old={},builds={};try{old=JSON.parse(localStorage.getItem('modpicker-owner-garage-v1')||'{}');builds=JSON.parse(localStorage.getItem('modpicker-state-v2')||'{}').garage||{}}catch{}
 const ids=[...new Set([...Object.keys(old),...Object.keys(builds)])].filter(id=>window.MODPICKER_DATA.vehicles.some(v=>v.id===id));
 let added=0;
 for(const id of ids){if(rows.some(r=>r.legacy_import_key==='legacy:'+id))continue;await create({catalogId:id,nickname:old[id]?.nickname||'Imported vehicle',profile:old[id]||empty(),build:builds[id]||{},legacyKey:'legacy:'+id});added++}
 notify(added?added+' vehicle profiles imported. Your original browser data was preserved.':'No new browser profiles to import.');
}
async function importProfile(payload){
 if(!capturesCurrent())throw new Error('Select a saved vehicle before importing.');
 if(payload.vehicleId!==state.vehicleId)throw new Error('Select the matching vehicle before importing.');
 const incoming=payload.profile;if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw new Error('Invalid profile.');
 const photos=(incoming.photos||[]).filter(x=>/^data:image\/jpeg;base64,/.test(x.data||'')).slice(0,4);
 active().profile={...incoming,photos:active().profile.photos||[]};
 for(const field of ['maintenance','codes','receipts'])active().profile[field]=Array.isArray(incoming[field])?incoming[field]:[];
 for(const photo of photos.slice(0,Math.max(0,4-active().profile.photos.length)))await addPhoto(photo.data,photo.name);
 queue();await flush();window.ModPickerGarage?.refresh?.();render();
}
async function load(){
 const expected=++epoch;clearTimeout(timer);dirty=false;activeId=null;rows=[];events=[];owner=DSAuth.user?.id||null;
 window.ModPickerGarage?.clear?.();render();
 if(!owner){try{sessionStorage.removeItem('dreamspec-private-route')}catch{}if(publicState){switching=true;Object.assign(state,publicState);publicState=null;switching=false;renderAll()}emit();return}
 try{const values=await DSAuth.request('owned_vehicles?order=created_at.asc');if(epoch!==expected)return;rows=(values||[]).map(r=>({...r,profile:{...empty(),...r.profile}}));for(const row of rows)await signPhotos(row);if(rows.length)await select(rows[0].id);else render();emit()}
 catch(e){if(epoch===expected){notify(e.message);render()}}
}
function bind(){
 document.querySelector('#ownedVehicleSelect')?.addEventListener('change',e=>select(e.target.value).catch(e=>notify(e.message)));
 document.querySelector('#addOwnedVehicle')?.addEventListener('click',()=>create({nickname:document.querySelector('#newVehicleNickname').value,profile:empty(),build:{}}).catch(e=>notify(e.message)));
 document.querySelector('#importLegacyGarage')?.addEventListener('click',()=>importLegacy().catch(e=>notify(e.message)));
 document.querySelector('#reloadOwnedGarage')?.addEventListener('click',()=>{if(dirty){notify('Save or export pending changes before reloading.');return}load()});
 document.querySelector('#diagnosisHistory')?.addEventListener('click',async event=>{
  const b=event.target.closest('[data-resolve-event]');if(!b)return;
  const note=document.querySelector('[data-event-note="'+b.dataset.resolveEvent+'"]').value.trim();if(!note)return notify('Add a repair or verification note first.');
  try{await DSAuth.request('vehicle_events?id=eq.'+b.dataset.resolveEvent,{method:'PATCH',body:JSON.stringify({status:'resolved',resolution:note})});await loadEvents()}catch(e){notify(e.message)}
 });
}
window.DSOwned={get active(){return active()},get vehicles(){return rows},get events(){return events},capturesCurrent,isPrivateContext,getProfile,saveProfile,captureBuild,select,create,flush,loadEvents,importProfile,addPhoto,removePhoto,render,load,
 onCatalogChange(){render()},
};
document.addEventListener('ds:auth',load);
document.addEventListener('ds:garage-ready',()=>{bind();load()});
document.addEventListener('ds:route',()=>render());
document.addEventListener('ds:catalog-change',()=>render());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush().catch(()=>{})});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
})();

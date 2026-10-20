(()=>{
'use strict';
const core=window.DreamSpecCore,{esc,safeUrl,GOALS}=core;
let preview=null,previewSignature='',busy=false,apiKey='',diagnosis=null,diagnoseRequest=null;
function message(id,text){const node=document.querySelector('#'+id);if(node)node.textContent=text}
function status(text){if(typeof toast==='function')toast(text)}
function signature(){return JSON.stringify({vehicle:state.vehicleId,build:state.build,meta:state.buildMeta})}
function goal(){return document.querySelector('#guidedGoal').value}
function renderGoals(){
 document.querySelector('#goalCards').innerHTML=Object.entries(GOALS).map(([id,g])=>'<button type="button" class="ds-goal-tile" data-goal="'+id+'" aria-pressed="'+String(id===goal())+'"><span class="ds-telemetry">'+esc(g.short)+'</span><strong>'+esc(g.label)+'</strong><span aria-hidden="true">↗</span></button>').join('');
}
function renderPlan(){
 const root=document.querySelector('#guidedPlan');
 if(!preview){root.innerHTML='<div class="ds-empty"><strong>Choose a direction for your build.</strong><p>Select your vehicle, a goal and your budget to preview a plan.</p></div>';return}
 const p=preview,fmt=n=>money(n);
 root.innerHTML='<div class="ds-plan-summary"><div><span>Known parts cost</span><strong>'+fmt(p.knownParts)+'</strong></div><div><span>Known install time</span><strong>'+p.knownHours.toFixed(1)+' hr'+(p.unknownHours?' + unknowns':'')+'</strong></div><div><span>Labor at your rate</span><strong>'+(p.laborRate?fmt(p.knownLabor)+(p.unknownHours?' + unknowns':''):'Rate not set')+'</strong></div></div><section class="ds-card"><span class="eyebrow">The work behind the build</span><p>'+esc(p.work)+'</p>'+p.messages.map(t=>'<p class="ds-notice">'+esc(t)+'</p>').join('')+'</section>'+p.picks.map(part=>'<article class="ds-plan-part"><div><span class="eyebrow">'+esc(part.category)+'</span><h3>'+esc(part.brand+' '+part.name)+'</h3><p>'+esc(part.install?.difficulty||'Install difficulty unknown')+' · '+(core.hours(part)==null?'Install time unknown':core.hours(part)+' hr planning estimate')+'</p><p>'+(part.requires?.length?'Recorded supporting requirements are included or already in your build.':'Follow the linked manufacturer instructions for this exact part.')+'</p></div><div><strong>'+(core.price(part)==null?'Price unknown':fmt(core.price(part)))+'</strong><button type="button" class="button secondary small" data-plan-detail="'+esc(part.id)+'">Details and sources</button></div></article>').join('')+(p.picks.length?'<button id="applyGuidedPlan" class="button primary" type="button">Add this plan to my build sheet ↗</button>':'');
}
function generate(){
 const selected=vehicle();if(!selected)return;
 preview=core.draftPlan({parts:DATA.parts,vehicleId:selected.id,goal:goal(),budget:document.querySelector('#guidedBudget').value,laborRate:document.querySelector('#guidedLabor').value,existing:state.build,existingMeta:state.buildMeta});
 previewSignature=signature();renderPlan();
}
function apply(){
 if(!preview?.picks.length)return;
 if(signature()!==previewSignature){generate();status('Your vehicle or build changed. Review the updated plan before adding it.');return}
 rememberUndo();
 for(const p of preview.picks)if(!state.build.includes(p.id)){state.build.push(p.id);state.buildMeta[p.id]={status:'planned',note:'Dream Spec '+GOALS[preview.goal].short+' plan. Verify final installation and supporting requirements.'}}
 state.goal=preview.goal;state.buildName=vehicle().year+' '+vehicle().make+' '+vehicle().model+' '+GOALS[preview.goal].short+' build';
 const budget=document.querySelector('#guidedBudget').value,rate=document.querySelector('#guidedLabor').value;
 if(budget!=='')state.budget=Number(budget);if(rate!=='')state.laborRate=Number(rate);
 saveState();renderAll();route('build');
}
function renderAccount(){
 const user=DSAuth.user,form=document.querySelector('#accountForm'),signed=document.querySelector('#signedInAccount');
 if(!form||!signed)return;form.hidden=!!user;signed.hidden=!user;
 message('accountEmail',user?.email||'');
 const recovery=!!window.DreamSpecPasswordRecovery;document.querySelector('#passwordRecoveryForm').hidden=!recovery;
 if(recovery)form.hidden=true;
}
async function accountSubmit(event){
 event.preventDefault();const form=event.currentTarget,button=event.submitter,action=button?.value||'login';
 button.disabled=true;message('accountStatus','Connecting…');
 try{
  const email=form.elements.email.value.trim(),password=form.elements.password.value;
  if(action==='signup'){if(password.length<12)throw new Error('Use at least 12 characters for a new password.');const r=await DSAuth.signUp(email,password);if(r.confirmationRequired){message('accountStatus','Check your email to confirm your account, then log in.');return}}
  else await DSAuth.signIn(email,password);
  form.elements.password.value='';message('accountStatus','Signed in.');route(DSAuth.consumeNext());
 }catch(e){message('accountStatus',e.message)}
 finally{button.disabled=false;renderAccount()}
}
function clearKey(){apiKey='';const input=document.querySelector('#diagnosisApiKey');if(input)input.value='';message('aiConnectionStatus','No AI key connected.');}
function renderAI(){
 const connected=!!apiKey;
 document.querySelector('#diagnosisKeyForm').hidden=connected;
 document.querySelector('#disconnectAI').hidden=!connected;
 document.querySelector('#diagnosisForm').hidden=!connected;
 message('aiConnectionStatus',connected?'OpenAI key connected for this tab. Calls use your API account.':'Connect your OpenAI API key to begin.');
 DSOwned.render();
}
function resultHtml(result){
 const safeLink=(url,label)=>safeUrl(url)?'<a href="'+esc(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':esc(label);
 return '<section class="ds-card"><span class="eyebrow">Diagnostic guidance · unconfirmed</span><h2>'+esc(result.summary)+'</h2><p>'+esc(result.urgency)+'</p><p>'+esc(result.limitations)+'</p></section>'+
 '<section class="ds-card"><h3>Possible causes</h3>'+result.causes.map(x=>'<div class="ds-diagnostic-item"><strong>'+esc(x.cause)+'</strong><p>'+esc(x.reason)+'</p></div>').join('')+'</section>'+
 '<section class="ds-card"><h3>Test before replacing</h3><ol class="ds-steps">'+result.steps.map(x=>'<li><strong>'+esc(x.action)+'</strong><p>'+esc(x.expected)+'</p><small>'+esc(x.safety)+'</small></li>').join('')+'</ol></section>'+
 '<section class="ds-card"><h3>Repair candidates</h3><p>Confirm the fault with the tests above before buying parts.</p>'+result.repairs.map(x=>'<div class="ds-diagnostic-item"><strong>'+esc(x.component)+'</strong><p>'+esc(x.when_confirmed)+'</p></div>').join('')+
 (result.catalog_parts?.length?'<h4>Source-listed catalog candidates</h4>'+result.catalog_parts.map(p=>'<p>'+safeLink(p.source_url,p.brand+' '+p.name)+' · '+esc(p.mpn||'Part number not established')+' · confirm exact application</p>').join(''):'<p>No exact catalog replacement was established. Use the confirmed component, engine and VIN to verify the OEM part number.</p>')+'</section>'+
 '<section class="ds-card"><h3>Community experience and reference material</h3>'+result.sources.map(s=>'<article class="ds-source">'+safeLink(s.url,s.title)+'<p>'+esc(s.note||'Retrieved reference; check the vehicle and engine match.')+'</p></article>').join('')+
 (!result.sources.length?'<p>No retrievable matching references were returned. This result has no verified forum-source support.</p>':'')+'</section>';
}
function showDiagnosis(){
 const root=document.querySelector('#diagnosisResult');if(!diagnosis){root.innerHTML='';return}
 root.innerHTML='<p class="ds-notice" role="status">'+(diagnosis.saved?'Saved to the selected vehicle’s service history as an unconfirmed diagnostic session.':'The result is ready, but history was not saved. Retry saving below without another AI call.')+'</p>'+(!diagnosis.saved?'<button class="button secondary" id="retryDiagnosisSave">Retry saving history</button>':'')+resultHtml(diagnosis.result);
}
async function runDiagnosis(event){
 event.preventDefault();if(busy)return;
 if(!apiKey||!DSAuth.user){clearKey();renderAI();return}
 const form=event.currentTarget,vehicleId=form.elements.vehicle.value,symptoms=form.elements.symptoms.value.trim(),codes=form.elements.codes.value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
 if(!vehicleId)return message('diagnosisStatus','Save a vehicle in My Garage first.');
 if(codes.some(code=>!/^([PBCU][0-3][0-9A-F]{3})$/.test(code)))return message('diagnosisStatus','Use five-character OBD-II codes, such as P0171.');
 if(codes.length>15)return message('diagnosisStatus','Enter at most 15 trouble codes.');
 busy=true;form.elements.vehicle.disabled=true;form.querySelector('button[type="submit"]').disabled=true;message('diagnosisStatus','Researching sources and building a diagnostic plan…');
 const owner=DSAuth.user.id;diagnoseRequest=new AbortController();const timeout=setTimeout(()=>diagnoseRequest?.abort(),120000);
 try{
  await DSOwned.flush();const token=await DSAuth.token(),cfg=window.DREAM_SPEC_CONFIG;
  const response=await fetch(cfg.supabaseUrl+'/functions/v1/'+cfg.diagnoseFunction,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,Authorization:'Bearer '+token,'X-DreamSpec-AI-Key':apiKey},body:JSON.stringify({vehicle_id:vehicleId,request_id:crypto.randomUUID(),symptoms,codes,model:cfg.diagnosisModel}),signal:diagnoseRequest.signal});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Diagnosis could not finish. Check your connection, key and API quota.');
  if(DSAuth.user?.id!==owner)return;
  diagnosis={...data,vehicleId};showDiagnosis();message('diagnosisStatus','Diagnostic plan ready.');
  if(DSOwned.active?.id===vehicleId)await DSOwned.loadEvents();
 }catch(e){if(DSAuth.user?.id===owner)message('diagnosisStatus',e.name==='AbortError'?'The request timed out or was cancelled. Check service history before starting a new diagnosis.':e.message)}
 finally{clearTimeout(timeout);busy=false;form.elements.vehicle.disabled=false;form.querySelector('button[type="submit"]').disabled=false}
}
async function retrySave(){
 if(!diagnosis||diagnosis.saved)return;
 try{await DSAuth.request('rpc/finish_diagnostic_run',{method:'POST',body:JSON.stringify({p_run_id:diagnosis.run_id,p_result:diagnosis.result})});diagnosis.saved=true;showDiagnosis();await DSOwned.loadEvents()}
 catch(e){message('diagnosisStatus',e.message)}
}
window.DSGuided={preview(profile={}){const select=document.querySelector('#guidedGoal');select.value=GOALS[profile.primaryGoal]?profile.primaryGoal:'balanced';document.querySelector('#guidedBudget').value=profile.budget||'';renderGoals();route('goals');generate()}};
function init(){
 renderGoals();renderPlan();renderAccount();renderAI();
 document.querySelector('#goalCards').addEventListener('click',e=>{const b=e.target.closest('[data-goal]');if(!b)return;document.querySelector('#guidedGoal').value=b.dataset.goal;preview=null;renderGoals();renderPlan()});
 document.querySelector('#guidedGoal').addEventListener('change',()=>{preview=null;renderGoals();renderPlan()});
 document.querySelector('#guidedPlanForm').addEventListener('submit',e=>{e.preventDefault();generate()});
 document.querySelector('#guidedPlan').addEventListener('click',e=>{if(e.target.closest('#applyGuidedPlan'))apply();const b=e.target.closest('[data-plan-detail]');if(b)showPart(b.dataset.planDetail)});
 document.querySelector('#accountForm').addEventListener('submit',accountSubmit);
 document.querySelector('#signOutButton').addEventListener('click',()=>DSAuth.signOut());
 document.querySelector('#forgotPassword').addEventListener('click',async()=>{const email=document.querySelector('#accountForm').elements.email.value.trim();if(!email)return message('accountStatus','Enter your email first.');try{await DSAuth.recover(email);message('accountStatus','If an account matches, a reset link will arrive by email.')}catch(e){message('accountStatus',e.message)}});
 document.querySelector('#passwordRecoveryForm').addEventListener('submit',async e=>{e.preventDefault();try{await DSAuth.updatePassword(e.currentTarget.elements.password.value);window.DreamSpecPasswordRecovery=false;e.currentTarget.reset();renderAccount();message('accountStatus','Password updated.')}catch(err){message('accountStatus',err.message)}});
 document.querySelector('#diagnosisKeyForm').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#diagnosisApiKey'),value=input.value.trim();if(!/^sk-[A-Za-z0-9_-]{20,}$/.test(value))return message('aiConnectionStatus','Enter a valid OpenAI API key.');apiKey=value;input.value='';renderAI()});
 document.querySelector('#disconnectAI').addEventListener('click',()=>{diagnoseRequest?.abort();clearKey();renderAI()});
 document.querySelector('#diagnosisForm').addEventListener('submit',runDiagnosis);
 document.querySelector('#diagnosisResult').addEventListener('click',e=>{if(e.target.closest('#retryDiagnosisSave'))retrySave()});
 document.querySelector('#diagnoseVehicle').addEventListener('change',async e=>{diagnosis=null;showDiagnosis();message('diagnosisStatus','');try{await DSOwned.select(e.target.value)}catch(err){message('diagnosisStatus',err.message)}});
 DSAuth.ready.then(()=>{renderAccount();if(window.DreamSpecPasswordRecovery)route('account');else if(DSAuth.user&&DSAuth.hasPendingRoute&&state.route==='account')route(DSAuth.consumeNext())});
}
document.addEventListener('ds:auth',()=>{
 renderAccount();if(!DSAuth.user){clearKey();diagnoseRequest?.abort();diagnosis=null;showDiagnosis();renderAI();if(['garage','diagnose'].includes(state.route))route(state.route)}
});
document.addEventListener('ds:owned',()=>{DSOwned.render()});
document.addEventListener('ds:catalog-change',()=>{preview=null;renderPlan()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

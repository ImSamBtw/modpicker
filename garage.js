(()=>{
'use strict';
const PROFILE_KEY='modpicker-owner-garage-v1';
const MAX_PHOTOS=4;
const MAINTENANCE_DATA_URL='data/manual/maintenance_specs.json';
const COMMON_MAINTENANCE=['Engine oil & filter','Engine air filter','Cabin air filter','Brake fluid','Coolant','Transmission fluid','Differential fluid','Spark plugs','Accessory belts','Brake inspection','Tire rotation / inspection'];
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let profiles=readProfiles();
let maintenanceSpecs=[];
let lastVehicleId='';

function readProfiles(){
 try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{}}catch{return {}}
}
function writeProfiles(){
 try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles));return true}catch(e){console.warn('Garage profile storage failed',e);notify('Garage storage is full. Remove a photo or export your data.');return false}
}
function notify(message){if(typeof toast==='function')return toast(message);const t=$('#toast');if(t){t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}}
function selectedVehicleId(){
 try{if(typeof state!=='undefined'&&state?.vehicleId)return state.vehicleId}catch{}
 try{return JSON.parse(localStorage.getItem('modpicker-state-v2')||'{}').vehicleId||window.MODPICKER_DATA?.vehicles?.[0]?.id||''}catch{return window.MODPICKER_DATA?.vehicles?.[0]?.id||''}
}
function selectedVehicle(){const vid=selectedVehicleId();return window.MODPICKER_DATA?.vehicles?.find(v=>v.id===vid)||window.MODPICKER_DATA?.vehicles?.[0]||null}
function blankProfile(){return {nickname:'',odometer:'',condition:'Driver',budget:'',targetPower:'',primaryGoal:'balanced',reliabilityPriority:'5',comfortPriority:'3',noiseTolerance:'3',currentMods:'',history:'',problems:'',likes:'',dislikes:'',buildGoals:'',photos:[],maintenance:[],codes:[],receipts:[],updatedAt:null}}
function profileFor(vehicleId=selectedVehicleId()){
 if(!vehicleId)return blankProfile();
 profiles[vehicleId]={...blankProfile(),...(profiles[vehicleId]||{})};
 profiles[vehicleId].photos=Array.isArray(profiles[vehicleId].photos)?profiles[vehicleId].photos:[];
 profiles[vehicleId].maintenance=Array.isArray(profiles[vehicleId].maintenance)?profiles[vehicleId].maintenance:[];
 profiles[vehicleId].codes=Array.isArray(profiles[vehicleId].codes)?profiles[vehicleId].codes:[];
 profiles[vehicleId].receipts=Array.isArray(profiles[vehicleId].receipts)?profiles[vehicleId].receipts:[];
 return profiles[vehicleId];
}
function saveProfile(){const p=profileFor();p.updatedAt=new Date().toISOString();writeProfiles();renderSummary()}
function vehicleLabel(v=selectedVehicle()){return v?`${v.year} ${v.make} ${v.model} ${v.trim||''}`.trim():'Selected vehicle'}
function numberOrNull(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:null}
function addMonths(dateString,months){if(!dateString||!months)return'';const d=new Date(`${dateString}T12:00:00`);if(Number.isNaN(d.getTime()))return'';d.setMonth(d.getMonth()+Number(months));return d.toISOString().slice(0,10)}
function safeHttps(url){try{const parsed=new URL(url,location.href);return parsed.protocol==='https:'?parsed.href:''}catch{return''}}
function maintenanceDue(item,p){
 const odo=numberOrNull(p.odometer),last=numberOrNull(item.lastMileage),miles=numberOrNull(item.intervalMiles);
 const dueMileage=last!=null&&miles?last+miles:null;
 const dueDate=addMonths(item.lastDate,numberOrNull(item.intervalMonths));
 let status='Unscheduled';
 if(dueMileage!=null&&odo!=null){const remaining=dueMileage-odo;if(remaining<=0)status='Due';else if(remaining<=1000)status='Due soon';else status='Tracked'}
 if(dueDate){const days=(new Date(`${dueDate}T23:59:59`)-Date.now())/86400000;if(days<0)status='Due';else if(days<=30&&status!=='Due')status='Due soon';else if(status==='Unscheduled')status='Tracked'}
 return{dueMileage,dueDate,status};
}
function recommendationContext(vehicleId=selectedVehicleId()){
 const v=window.MODPICKER_DATA?.vehicles?.find(x=>x.id===vehicleId)||null,p=profileFor(vehicleId);
 return {vehicle:v?{id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,chassis:v.chassis,engine:v.engine,transmission:v.transmission}:null,ownerContext:{nickname:p.nickname,odometer:numberOrNull(p.odometer),condition:p.condition,currentMods:p.currentMods,history:p.history,currentProblems:p.problems,likes:p.likes,dislikes:p.dislikes,buildGoals:p.buildGoals},preferences:{primaryGoal:p.primaryGoal,budget:numberOrNull(p.budget),targetPowerIncrease:numberOrNull(p.targetPower),reliabilityPriority:Number(p.reliabilityPriority)||null,comfortPriority:Number(p.comfortPriority)||null,noiseTolerance:Number(p.noiseTolerance)||null},maintenance:{items:p.maintenance.map(x=>({...x,...maintenanceDue(x,p)})),codes:p.codes,receiptCount:p.receipts.length}};
}
function render(){
 const v=selectedVehicle(),p=profileFor();
 if(!v)return;
 lastVehicleId=v.id;
 $('#garageVehicleTitle').textContent=p.nickname||vehicleLabel(v);
 $('#garageVehicleMeta').textContent=[vehicleLabel(v),v.engine,v.transmission,v.chassis].filter(Boolean).join(' · ');
 const fields={garageNickname:p.nickname,garageOdometer:p.odometer,garageCondition:p.condition,garageBudget:p.budget,garageTargetPower:p.targetPower,garagePrimaryGoal:p.primaryGoal,garageReliabilityPriority:p.reliabilityPriority,garageComfortPriority:p.comfortPriority,garageNoiseTolerance:p.noiseTolerance,garageCurrentMods:p.currentMods,garageHistory:p.history,garageProblems:p.problems,garageLikes:p.likes,garageDislikes:p.dislikes,garageBuildGoals:p.buildGoals};
 for(const [key,value] of Object.entries(fields)){const el=$(`#${key}`);if(el&&el.value!==String(value??''))el.value=value??''}
 renderPhotos();renderMaintenance();renderCodes();renderReceipts();renderSummary();
}
function renderSummary(){
 const p=profileFor(),v=selectedVehicle();if(!v)return;
 const context=recommendationContext();
 const required=[p.odometer,p.currentMods,p.problems,p.buildGoals,p.likes,p.dislikes];
 const completed=required.filter(value=>String(value??'').trim()).length;
 $('#garageProfileCompleteness').textContent=`${Math.round(completed/required.length*100)}% context complete`;
 const goals=[];
 goals.push((p.primaryGoal||'balanced').replace(/^./,c=>c.toUpperCase()));
 if(p.budget)goals.push(`budget $${Number(p.budget).toLocaleString()}`);
 if(p.targetPower)goals.push(`target +${Number(p.targetPower).toLocaleString()} hp`);
 if(p.problems)goals.push('current problems recorded');
 $('#garageRecommendationSummary').textContent=`${vehicleLabel(v)} · ${goals.join(' · ')}`;
 $('#garageContextPreview').textContent=JSON.stringify(context,null,2);
}
function renderPhotos(){
 const p=profileFor(),root=$('#garagePhotos');
 root.innerHTML=p.photos.length?p.photos.map((photo,i)=>`<figure class="garage-photo"><img src="${photo.data}" alt="${esc(photo.name||'Vehicle photo')}"/><button type="button" data-remove-photo="${i}" aria-label="Remove photo">×</button></figure>`).join(''):`<div class="garage-empty compact">Add up to ${MAX_PHOTOS} photos of the actual car. Photos stay in this browser in the current prototype.</div>`;
 $('#garagePhotoInput').disabled=p.photos.length>=MAX_PHOTOS;
}
async function compressPhoto(file){
 if(!file?.type?.startsWith('image/'))throw new Error('Image file required');
 const url=URL.createObjectURL(file),img=new Image();
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
 const max=900,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(!blob)return reject(new Error('Image conversion failed'));const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)},'image/jpeg',.72));
}
async function addPhotos(files){
 const p=profileFor(),slots=MAX_PHOTOS-p.photos.length;
 for(const file of [...files].slice(0,slots)){
  try{const data=await compressPhoto(file);p.photos.push({name:file.name,data,addedAt:new Date().toISOString()})}catch{notify(`Could not add ${file.name}`)}
 }
 saveProfile();renderPhotos();
}
function fieldInput(e){
 const field=e.target.dataset.profileField;if(!field)return;
 profileFor()[field]=e.target.value;saveProfile();
}
function maintenanceRow(item,p){
 const due=maintenanceDue(item,p),statusClass=due.status.toLowerCase().replaceAll(' ','-'),sourceUrl=safeHttps(item.source?.url),sourcePages=(item.source?.pages||[]).join(', ');
 return `<article class="maintenance-card" data-maint-id="${esc(item.id)}">
  <div class="maintenance-card-head"><input class="maintenance-name" data-maint-field="name" value="${esc(item.name)}" placeholder="Service item"/><span class="maintenance-status ${statusClass}">${esc(due.status)}</span><button class="text-button danger-text" type="button" data-delete-maint="${esc(item.id)}">Remove</button></div>
  ${item.source?`<div class="maintenance-source"><strong>Source-backed specification</strong><span>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(item.source.title||'Source')}</a>`:esc(item.source.title||'Source')}${sourcePages?` · pages ${esc(sourcePages)}`:''}${item.source.documentPartNumber?` · ${esc(item.source.documentPartNumber)}`:''}</span></div>`:''}
  <div class="maintenance-grid">
   <label><span>Last service mileage</span><input data-maint-field="lastMileage" inputmode="numeric" type="number" min="0" value="${esc(item.lastMileage)}"></label>
   <label><span>Interval miles</span><input data-maint-field="intervalMiles" inputmode="numeric" type="number" min="0" value="${esc(item.intervalMiles)}"></label>
   <div class="computed-field"><span>Next mileage</span><strong>${due.dueMileage==null?'—':Number(due.dueMileage).toLocaleString()}</strong></div>
   <label><span>Last service date</span><input data-maint-field="lastDate" type="date" value="${esc(item.lastDate)}"></label>
   <label><span>Interval months</span><input data-maint-field="intervalMonths" inputmode="numeric" type="number" min="0" value="${esc(item.intervalMonths)}"></label>
   <div class="computed-field"><span>Next date</span><strong>${esc(due.dueDate||'—')}</strong></div>
   <label><span>Fluid / specification</span><input data-maint-field="fluidSpec" value="${esc(item.fluidSpec)}" placeholder="Source before filling"></label>
   <label><span>Capacity</span><input data-maint-field="capacity" value="${esc(item.capacity)}" placeholder="Source before filling"></label>
   <label><span>Part numbers / supplies</span><input data-maint-field="parts" value="${esc(item.parts)}" placeholder="Filter, gasket, plugs…"></label>
   <label class="maintenance-notes"><span>Notes</span><textarea data-maint-field="notes" rows="2" placeholder="Work performed, source, observations…">${esc(item.notes)}</textarea></label>
  </div>
 </article>`;
}
function renderMaintenance(){const p=profileFor(),root=$('#maintenanceList');root.innerHTML=p.maintenance.length?p.maintenance.map(x=>maintenanceRow(x,p)).join(''):'<div class="garage-empty">No maintenance records yet. Add an item or create the common-service starter list.</div>'}
function newMaintenance(name=''){return{id:id('maint'),name,lastMileage:'',intervalMiles:'',lastDate:'',intervalMonths:'',fluidSpec:'',capacity:'',parts:'',notes:'',createdAt:new Date().toISOString()}}
function maintenancePack(vehicleId=selectedVehicleId()){return maintenanceSpecs.find(pack=>(pack.vehicle_ids||[]).includes(vehicleId))||null}
function applySourcedMaintenance({notifyUser=false}={}){
 const pack=maintenancePack();if(!pack)return{applied:0,created:0,pack:null};
 const p=profileFor(),existing=new Map(p.maintenance.map(item=>[String(item.name||'').trim().toLowerCase(),item]));let applied=0,created=0,changed=false;
 for(const spec of pack.items||[]){
  const key=String(spec.name||'').trim().toLowerCase();if(!key)continue;
  let item=existing.get(key);if(!item){item=newMaintenance(spec.name);p.maintenance.push(item);existing.set(key,item);created++;changed=true}
  const isNewSource=item.source?.id!==pack.id;
  if(isNewSource){
   for(const [field,value] of [['fluidSpec',spec.fluid_spec],['capacity',spec.capacity],['parts',spec.parts],['intervalMiles',spec.interval_miles],['intervalMonths',spec.interval_months]])if((item[field]===''||item[field]==null)&&value!=null&&value!==''){item[field]=String(value);applied++;changed=true}
   if(!item.notes&&spec.notes){item.notes=spec.notes;changed=true}
  }
  const nextSource={id:pack.id,title:pack.source?.title||'Maintenance source',publisher:pack.source?.publisher||'',documentPartNumber:pack.source?.document_part_number||'',url:pack.source?.source_url||'',retrievedAt:pack.source?.retrieved_at||'',pages:Array.isArray(spec.source_pages)?spec.source_pages:[]};
  if(JSON.stringify(item.source||{})!==JSON.stringify(nextSource)){item.source=nextSource;changed=true}
 }
 if(changed){saveProfile();renderMaintenance()}
 if(notifyUser)notify(changed?'Source-backed maintenance specifications applied. Unsourced intervals remain blank.':'Maintenance specifications are already up to date.');
 return{applied,created,pack:pack.id,changed};
}
async function loadMaintenanceSpecs(){
 try{const response=await fetch(MAINTENANCE_DATA_URL,{cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();maintenanceSpecs=Array.isArray(data)?data:[];applySourcedMaintenance()}catch(error){console.warn('Maintenance specification load failed',error)}
}
function addMaintenance(name=''){profileFor().maintenance.push(newMaintenance(name));saveProfile();renderMaintenance()}
function seedMaintenance(){const p=profileFor(),existing=new Set(p.maintenance.map(x=>x.name.toLowerCase()));for(const name of COMMON_MAINTENANCE)if(!existing.has(name.toLowerCase()))p.maintenance.push(newMaintenance(name));saveProfile();renderMaintenance();applySourcedMaintenance();notify('Starter checklist added. Source-backed values were applied where available; unsourced intervals and specifications remain blank.')}
function updateMaintenance(e){const card=e.target.closest('[data-maint-id]'),field=e.target.dataset.maintField;if(!card||!field)return;const item=profileFor().maintenance.find(x=>x.id===card.dataset.maintId);if(!item)return;item[field]=e.target.value;saveProfile();if(['lastMileage','intervalMiles','lastDate','intervalMonths'].includes(field))renderMaintenance()}
function deleteMaintenance(mid){const p=profileFor();p.maintenance=p.maintenance.filter(x=>x.id!==mid);saveProfile();renderMaintenance()}
function addCode(){
 const code=$('#codeValue').value.trim().toUpperCase(),date=$('#codeDate').value,mileage=$('#codeMileage').value,description=$('#codeDescription').value.trim(),resolution=$('#codeResolution').value.trim();
 if(!code)return notify('Enter a diagnostic code first.');
 profileFor().codes.unshift({id:id('code'),code,date,mileage,description,resolution,createdAt:new Date().toISOString()});
 $('#codeValue').value='';$('#codeDescription').value='';$('#codeResolution').value='';saveProfile();renderCodes();
}
function renderCodes(){const rows=profileFor().codes,root=$('#codeHistory');root.innerHTML=rows.length?rows.map(x=>`<div class="history-row"><div><strong>${esc(x.code)}</strong><span>${esc(x.date||'Date unknown')}${x.mileage?` · ${Number(x.mileage).toLocaleString()} mi`:''}</span></div><div><strong>${esc(x.description||'No description')}</strong><span>${esc(x.resolution||'Resolution not recorded')}</span></div><button class="text-button danger-text" data-delete-code="${esc(x.id)}">Remove</button></div>`).join(''):'<div class="garage-empty compact">No diagnostic codes recorded.</div>'}
function addReceipt(){
 const vendor=$('#receiptVendor').value.trim(),date=$('#receiptDate').value,amount=$('#receiptAmount').value,category=$('#receiptCategory').value.trim(),notes=$('#receiptNotes').value.trim();
 if(!vendor&&!notes)return notify('Add a vendor or receipt note first.');
 profileFor().receipts.unshift({id:id('receipt'),vendor,date,amount,category,notes,createdAt:new Date().toISOString()});
 $('#receiptVendor').value='';$('#receiptAmount').value='';$('#receiptCategory').value='';$('#receiptNotes').value='';saveProfile();renderReceipts();
}
function renderReceipts(){const rows=profileFor().receipts,root=$('#receiptHistory');root.innerHTML=rows.length?rows.map(x=>`<div class="history-row"><div><strong>${esc(x.vendor||'Receipt')}</strong><span>${esc(x.date||'Date unknown')}${x.amount?` · $${Number(x.amount).toFixed(2)}`:''}</span></div><div><strong>${esc(x.category||'Maintenance / part purchase')}</strong><span>${esc(x.notes||'No notes')}</span></div><button class="text-button danger-text" data-delete-receipt="${esc(x.id)}">Remove</button></div>`).join(''):'<div class="garage-empty compact">No receipts or maintenance purchases recorded.</div>'}
function maintenanceReport(){
 const v=selectedVehicle(),p=profileFor(),lines=[`ModPicker maintenance record — ${p.nickname||vehicleLabel(v)}`,`Vehicle: ${vehicleLabel(v)}`,`Odometer: ${p.odometer?`${Number(p.odometer).toLocaleString()} mi`:'not recorded'}`,`Condition: ${p.condition||'not recorded'}`,`Generated: ${new Date().toLocaleDateString()}`,''];
 lines.push('MAINTENANCE');
 if(!p.maintenance.length)lines.push('No maintenance items recorded.');
 for(const item of p.maintenance){const due=maintenanceDue(item,p);lines.push(`- ${item.name||'Service item'} | last: ${item.lastMileage||'—'} mi / ${item.lastDate||'—'} | next: ${due.dueMileage??'—'} mi / ${due.dueDate||'—'} | ${due.status}`);if(item.fluidSpec||item.capacity||item.parts)lines.push(`  spec/capacity/parts: ${[item.fluidSpec,item.capacity,item.parts].filter(Boolean).join(' | ')}`);if(item.source)lines.push(`  source: ${item.source.title||'Source'}${item.source.documentPartNumber?` (${item.source.documentPartNumber})`:''}${item.source.pages?.length?` pp. ${item.source.pages.join(', ')}`:''}${item.source.url?` | ${item.source.url}`:''}`);if(item.notes)lines.push(`  notes: ${item.notes}`)}
 lines.push('','DIAGNOSTIC CODE HISTORY');for(const x of p.codes)lines.push(`- ${x.code} | ${x.date||'date unknown'} | ${x.mileage||'—'} mi | ${x.description||''} | ${x.resolution||''}`);if(!p.codes.length)lines.push('No codes recorded.');
 lines.push('','RECEIPTS / PURCHASES');for(const x of p.receipts)lines.push(`- ${x.date||'date unknown'} | ${x.vendor||'Receipt'} | ${x.amount?`$${Number(x.amount).toFixed(2)}`:'amount unknown'} | ${x.category||''} | ${x.notes||''}`);if(!p.receipts.length)lines.push('No receipts recorded.');
 return lines.join('\n');
}
async function copyReport(){try{await navigator.clipboard.writeText(maintenanceReport());notify('Maintenance report copied.')}catch{notify('Could not access the clipboard.')}}
function applyRecommendationContext(){
 const p=profileFor();
 try{if(typeof state!=='undefined'){const allowed=['balanced','reliability','power','handling','track','budget'];state.goal=allowed.includes(p.primaryGoal)?p.primaryGoal:'balanced';if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();if(typeof route==='function')route('catalog')}}catch{}
 notify('Garage preferences applied to the current catalog goal.');
}
function exportGarage(){
 const payload={version:1,exportedAt:new Date().toISOString(),vehicleId:selectedVehicleId(),profile:profileFor()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`modpicker-garage-${selectedVehicleId()||'vehicle'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function bind(){
 document.querySelectorAll('[data-profile-field]').forEach(el=>el.addEventListener('input',fieldInput));
 $('#garagePhotoInput')?.addEventListener('change',e=>{addPhotos(e.target.files);e.target.value=''});
 $('#garagePhotos')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-photo]');if(!b)return;profileFor().photos.splice(Number(b.dataset.removePhoto),1);saveProfile();renderPhotos()});
 $('#addMaintenanceButton')?.addEventListener('click',()=>addMaintenance());$('#seedMaintenanceButton')?.addEventListener('click',seedMaintenance);
 $('#maintenanceList')?.addEventListener('input',updateMaintenance);$('#maintenanceList')?.addEventListener('change',updateMaintenance);$('#maintenanceList')?.addEventListener('click',e=>{const b=e.target.closest('[data-delete-maint]');if(b)deleteMaintenance(b.dataset.deleteMaint)});
 $('#addCodeButton')?.addEventListener('click',addCode);$('#codeHistory')?.addEventListener('click',e=>{const b=e.target.closest('[data-delete-code]');if(!b)return;const p=profileFor();p.codes=p.codes.filter(x=>x.id!==b.dataset.deleteCode);saveProfile();renderCodes()});
 $('#addReceiptButton')?.addEventListener('click',addReceipt);$('#receiptHistory')?.addEventListener('click',e=>{const b=e.target.closest('[data-delete-receipt]');if(!b)return;const p=profileFor();p.receipts=p.receipts.filter(x=>x.id!==b.dataset.deleteReceipt);saveProfile();renderReceipts()});
 $('#copyMaintenanceReport')?.addEventListener('click',copyReport);$('#applyGarageContext')?.addEventListener('click',applyRecommendationContext);$('#exportGarageData')?.addEventListener('click',exportGarage);
 document.querySelectorAll('[data-route="garage"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>{render();applySourcedMaintenance()},0)));
 const vehicleName=$('#vehicleName');if(vehicleName)new MutationObserver(()=>{const current=selectedVehicleId();if(current!==lastVehicleId){render();applySourcedMaintenance()}}).observe(vehicleName,{childList:true,subtree:true,characterData:true});
}
function init(){if(!$('#garageView'))return;bind();render();window.ModPickerGarage={getProfile:vehicleId=>structuredClone(profileFor(vehicleId)),getRecommendationContext:vehicleId=>structuredClone(recommendationContext(vehicleId)),getMaintenanceReport:maintenanceReport,exportData:()=>structuredClone(profiles),applySourcedMaintenance,getMaintenanceSpecs:()=>structuredClone(maintenanceSpecs)};loadMaintenanceSpecs()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

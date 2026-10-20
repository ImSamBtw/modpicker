/* Pure, shared planning and rendering helpers. No storage, network or DOM dependencies. */
(function(root){
'use strict';
const GOALS={
 power:{label:'Make more power',short:'Power',categories:['Intake','Exhaust','Tuning','Cooling','Drivetrain'],work:'Check engine health, cooling capacity and supporting drivetrain requirements before adding power.'},
 reliability:{label:'Make it more reliable',short:'Reliability',categories:['Maintenance','Cooling','Engine','Drivetrain','Brakes'],work:'Start with overdue maintenance and recorded faults. Inspect weak points before selecting upgrades.'},
 handling:{label:'Make it handle better',short:'Handling',categories:['Tires','Suspension','Chassis','Brakes','Wheels'],work:'Inspect tires, bushings and alignment. Account for alignment and clearance checks after suspension work.'},
 offroad:{label:'Make it more off-road capable',short:'Off-road',categories:['Tires','Suspension','Protection','Drivetrain','Recovery'],strict:true,work:'Confirm terrain, load ratings, travel, gearing, recovery points and tire clearance for the exact vehicle.'},
 lightweight:{label:'Make it lighter',short:'Weight reduction',categories:['Wheels','Body','Exhaust','Interior','Battery'],strict:true,work:'Use documented component weights. Preserve required safety equipment and verify mounting, electrical and structural requirements.'},
 safety:{label:'Make it safer',short:'Safety',categories:['Brakes','Tires','Lighting','Safety','Maintenance'],work:'Inspect braking, tire condition and safety systems first. Use sourced procedures and qualified help for safety-critical work.'},
 balanced:{label:'Balanced street build',short:'Balanced',categories:['Brakes','Suspension','Cooling','Intake','Exhaust','Drivetrain'],work:'Balance maintenance, comfort and the intended use of the vehicle.'},
 track:{label:'Get it ready for the track',short:'Track',categories:['Brakes','Tires','Suspension','Cooling','Chassis'],work:'Check the event requirements and plan inspection, brake fluid, cooling and tire preparation.'},
 budget:{label:'Build on a budget',short:'Budget',categories:['Maintenance','Brakes','Suspension','Intake','Exhaust'],work:'Resolve maintenance needs first and compare current, identified product offers.'}
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeUrl(value){try{const u=new URL(String(value));return u.protocol==='https:'?u.href:''}catch{return ''}}
const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
function price(p,now=Date.now()){
 const offers=(p.offers||[]).filter(o=>finite(o.price)&&Number(o.price)>0&&o.in_stock!==false&&(!o.currency||o.currency==='USD')&&Number.isFinite(Date.parse(o.retrieved_at))&&now-Date.parse(o.retrieved_at)>=0&&now-Date.parse(o.retrieved_at)<7*86400000);
 return offers.length?Math.min(...offers.map(o=>Number(o.price))):null;
}
function verified(p,vehicleId){return (p.fitments||[]).some(f=>f.vehicle_id===vehicleId&&f.fitment_status==='verified'&&safeUrl(f.source_url))}
function hours(p){return finite(p.install?.hours)&&Number(p.install.hours)>0?Number(p.install.hours):null}
function matchGoal(p,goal){
 const def=GOALS[goal];if(!def||!def.categories.includes(p.category))return false;
 if(!def.strict)return true;
 const tags=[...(p.goals||[]),...(p.goalTags||[]),...(p.tags||[])].map(x=>String(x).toLowerCase());
 return tags.includes(goal)||goal==='offroad'&&tags.includes('off-road')||goal==='lightweight'&&tags.includes('weight-reduction');
}
function draftPlan({parts,vehicleId,goal='balanced',budget=null,laborRate=0,existing=[],existingMeta={},now=Date.now()}){
 const def=GOALS[goal]||GOALS.balanced;goal=GOALS[goal]?goal:'balanced';
 const byId=new Map(parts.map(p=>[p.id,p])),used=new Set(existing),usedCategories=new Set(existing.map(id=>byId.get(id)?.category));
 const cap=finite(budget)&&Number(budget)>=0?Number(budget):null,rate=finite(laborRate)&&Number(laborRate)>0?Number(laborRate):0;
 let spent=0,unknownExisting=0;
 for(const id of existing){const p=byId.get(id);if(!p)continue;const m=existingMeta[id]||{},unit=finite(m.paid)?Number(m.paid):price(p,now),quantity=Math.max(1,Number(m.quantity)||1);if(unit==null)unknownExisting++;else spent+=unit*quantity;if(rate&&hours(p)!=null)spent+=hours(p)*quantity*rate}
 const picks=[],messages=[],candidates=parts.filter(p=>verified(p,vehicleId)&&matchGoal(p,goal)).sort((a,b)=>{
 const ra=finite(a.rating?.overall)?Number(a.rating.overall):-1,rb=finite(b.rating?.overall)?Number(b.rating.overall):-1;
 return rb-ra||(price(a,now)??Infinity)-(price(b,now)??Infinity)||String(a.id).localeCompare(String(b.id));
 });
 if(unknownExisting&&cap!=null)messages.push('Some existing build costs are unknown. Set those costs before generating a budget-limited plan.');
 function bundle(root){
  const rows=[],planned=new Set(used),visiting=new Set();
  function visit(p){
   if(planned.has(p.id))return true;
   if(visiting.has(p.id)||!verified(p,vehicleId))return false;
   for(const id of planned){if((p.conflicts||[]).includes(id)||(byId.get(id)?.conflicts||[]).includes(p.id))return false}
   visiting.add(p.id);
   for(const id of p.requires||[]){if(planned.has(id))continue;const req=byId.get(id);if(!req||!visit(req))return false}
   // A dependency may conflict with its parent after the recursive walk.
   for(const id of planned){if((p.conflicts||[]).includes(id)||(byId.get(id)?.conflicts||[]).includes(p.id))return false}
   visiting.delete(p.id);planned.add(p.id);rows.push(p);return true;
  }
  return visit(root)?rows:null;
 }
 if(!(unknownExisting&&cap!=null))for(const category of def.categories){
  if(usedCategories.has(category))continue;
  for(const p of candidates.filter(x=>x.category===category&&!used.has(x.id))){
   const rows=bundle(p);if(!rows)continue;
   const unknown=rows.some(x=>price(x,now)==null),cost=rows.reduce((n,x)=>n+(price(x,now)||0)+(rate&&hours(x)!=null?hours(x)*rate:0),0);
   if(cap!=null&&(unknown||spent+cost>cap))continue;
   rows.forEach(x=>{if(!used.has(x.id)){picks.push(x);used.add(x.id);usedCategories.add(x.category)}});spent+=cost;break;
  }
  if(picks.length>=8)break;
 }
 const knownParts=picks.reduce((sum,p)=>sum+(price(p,now)||0),0),knownHours=picks.reduce((sum,p)=>sum+(hours(p)||0),0);
 const unknownPrices=picks.filter(p=>price(p,now)==null).length,unknownHours=picks.filter(p=>hours(p)==null).length;
 if(!picks.length)messages.push('No additional source-listed parts currently satisfy this goal, the recorded dependencies and your budget. This does not mean the goal is achievable without work.');
 if(def.strict&&!candidates.length)messages.push('This vehicle has no explicitly tagged catalog coverage for this goal yet.');
 if(unknownPrices||unknownHours||!rate)messages.push('The estimate is incomplete where prices, install time or a labor rate are missing.');
 return {vehicleId,goal,picks,work:def.work,knownParts,knownHours,unknownPrices,unknownHours,laborRate:rate,knownLabor:rate*knownHours,remaining:cap==null?null:cap-spent,messages};
}
const api={GOALS,esc,safeUrl,price,verified,hours,draftPlan};
root.DreamSpecCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

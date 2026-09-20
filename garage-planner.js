(()=>{
'use strict';
const CATEGORY_ORDER={
 reliability:['Cooling','Brakes','Drivetrain','Engine','Maintenance','Suspension'],
 power:['Intake','Exhaust','Tuning','Cooling','Drivetrain'],
 handling:['Suspension','Brakes','Chassis','Wheels','Tires'],
 track:['Brakes','Suspension','Cooling','Chassis','Drivetrain'],
 budget:['Maintenance','Brakes','Suspension','Intake','Exhaust'],
 balanced:['Brakes','Suspension','Cooling','Intake','Exhaust','Drivetrain']
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeState(){try{return typeof state!=='undefined'?state:null}catch{return null}}
function getPrice(p){try{return typeof lowestPrice==='function'?lowestPrice(p):null}catch{return null}}
function isVerified(p){try{return typeof fitmentVerified==='function'?fitmentVerified(p):false}catch{return false}}
function goalMatch(p,goal){
 const hay=[...(p.goals||[]),...(p.tags||[]),p.category,p.name,p.description].filter(Boolean).join(' ').toLowerCase();
 return goal&&goal!=='balanced'&&hay.includes(goal.toLowerCase());
}
function candidateScore(p,goal){
 const price=getPrice(p),rating=Number(p.rating?.overall);
 let score=0;
 if(isVerified(p))score+=100;
 if(goalMatch(p,goal))score+=35;
 if(Number.isFinite(rating))score+=rating*4;
 if(Number.isFinite(price)&&price>0)score+=Math.max(0,18-Math.log10(price+10)*6);
 return score;
}
function buildItemCost(p,meta={}){
 const quantity=Math.max(1,Math.floor(Number(meta.quantity)||1));
 const paid=meta.paid==null||meta.paid===''?null:Number(meta.paid);
 const unit=Number.isFinite(paid)&&paid>=0?paid:getPrice(p);
 return Number.isFinite(unit)?unit*quantity:0;
}
function existingBuildCost(s){
 if(!s||!Array.isArray(s.build))return 0;
 return s.build.reduce((sum,id)=>{try{const p=part(id);return p?sum+buildItemCost(p,s.buildMeta?.[id]||{}):sum}catch{return sum}},0);
}
function conflictsWith(p,ids){
 if((p.conflicts||[]).some(id=>ids.has(id)))return true;
 for(const id of ids){try{if(part(id)?.conflicts?.includes(p.id))return true}catch{}}
 return false;
}
function eligiblePart(p,ids){return !!p&&!ids.has(p.id)&&isVerified(p)&&Number.isFinite(getPrice(p))&&getPrice(p)>0&&!conflictsWith(p,ids)}
function dependencyBundle(root,ids,candidateById){
 const bundle=[],planned=new Set(ids),visiting=new Set();
 function visit(p){
  if(planned.has(p.id))return true;
  if(visiting.has(p.id)||!eligiblePart(p,planned))return false;
  visiting.add(p.id);
  for(const reqId of p.requires||[]){
   if(planned.has(reqId))continue;
   const req=candidateById.get(reqId);if(!req||!visit(req)){visiting.delete(p.id);return false}
  }
  visiting.delete(p.id);planned.add(p.id);bundle.push(p);return true;
 }
 return visit(root)?bundle:null;
}
function choosePlan(profile){
 const s=safeState();if(!s||typeof compatibleParts!=='function')return {picks:[],budget:0,remaining:0,goal:'balanced'};
 const goal=['balanced','reliability','power','handling','track','budget'].includes(profile?.primaryGoal)?profile.primaryGoal:'balanced';
 const budget=Number(profile?.budget)>0?Number(profile.budget):(Number(s.budget)>0?Number(s.budget):5000);
 let remaining=Math.max(0,budget-existingBuildCost(s));
 const existing=new Set(s.build||[]),existingCategories=new Set((s.build||[]).map(id=>{try{return part(id)?.category}catch{return null}}).filter(Boolean));
 const candidates=compatibleParts().filter(p=>eligiblePart(p,existing)).sort((a,b)=>candidateScore(b,goal)-candidateScore(a,goal)||getPrice(a)-getPrice(b));
 const candidateById=new Map(candidates.map(p=>[p.id,p]));
 const picks=[],plannedIds=new Set(existing),usedCategories=new Set(existingCategories),ordered=CATEGORY_ORDER[goal]||CATEGORY_ORDER.balanced;
 function tryAdd(root){
  if(!root||usedCategories.has(root.category)||plannedIds.has(root.id))return false;
  const bundle=dependencyBundle(root,plannedIds,candidateById);if(!bundle?.length)return false;
  const newParts=bundle.filter(p=>!plannedIds.has(p.id));const cost=newParts.reduce((sum,p)=>sum+getPrice(p),0);
  if(cost>remaining||picks.length+newParts.length>6)return false;
  for(const p of newParts){picks.push(p);plannedIds.add(p.id);usedCategories.add(p.category)}remaining-=cost;return true;
 }
 for(const category of ordered){
  const options=candidates.filter(x=>x.category===category&&!plannedIds.has(x.id));
  for(const option of options)if(tryAdd(option))break;
  if(picks.length>=6)break;
 }
 if(picks.length<4){for(const p of candidates){if(tryAdd(p)&&picks.length>=6)break}}
 return {picks,budget,remaining,goal};
}
function renderPlanSummary(result){
 const root=document.querySelector('#garagePlanResult');if(!root)return;
 if(!result){root.innerHTML='<p class="garage-note">Generate a starter build to add a small set of source-listed parts without clearing anything already in your build sheet.</p>';return}
 if(!result.picks.length){root.innerHTML='<div class="garage-empty compact">No additional source-listed priced parts fit the remaining budget and recorded build rules. Existing build items were left unchanged.</div>';return}
 const total=result.picks.reduce((s,p)=>s+getPrice(p),0);
 root.innerHTML=`<div class="planner-summary"><strong>${result.picks.length} parts added · ${money(total)}</strong><span>${esc(result.goal)} starter plan · ${money(result.remaining)} budget remaining before labor</span></div><ul class="garage-roadmap-list">${result.picks.map(p=>`<li>${esc(p.brand)} ${esc(p.name)} — ${money(getPrice(p))}${p.requires?.length?' · supporting requirements checked':''}</li>`).join('')}</ul>`;
}
function generatePlan(){
 if(!window.ModPickerGarage)return;
 const profile=window.ModPickerGarage.getProfile();const result=choosePlan(profile),s=safeState();if(!s)return;
 if(!result.picks.length){renderPlanSummary(result);if(typeof toast==='function')toast('No additional verified priced parts fit this budget and the recorded build rules.');return result}
 s.goal=result.goal;s.budget=result.budget;s.build=Array.isArray(s.build)?s.build:[];s.buildMeta=s.buildMeta||{};
 for(const p of result.picks){if(!s.build.includes(p.id))s.build.push(p.id);s.buildMeta[p.id]=s.buildMeta[p.id]||{status:'planned'};if(!s.buildMeta[p.id].note)s.buildMeta[p.id].note=`Starter plan from Garage profile (${result.goal}). Recorded requirements/conflicts were checked; verify final configuration and installation requirements before purchase.`}
 const v=typeof vehicle==='function'?vehicle():null;s.buildName=`${v?`${v.year} ${v.make} ${v.model}`:'Vehicle'} ${result.goal} starter build`;
 if(typeof saveState==='function')saveState();if(typeof renderAll==='function')renderAll();renderPlanSummary(result);if(typeof toast==='function')toast(`${result.picks.length} starter-plan parts added.`);if(typeof route==='function')route('build');return result;
}
function init(){
 const button=document.querySelector('#generateBuildPlan');if(!button||button.dataset.bound)return false;button.dataset.bound='1';button.addEventListener('click',generatePlan);renderPlanSummary(null);window.ModPickerPlanner={generatePlan,choosePlan:()=>choosePlan(window.ModPickerGarage?.getProfile?.()||{})};return true;
}
if(!init()){
 const obs=new MutationObserver(()=>{if(window.ModPickerGarage&&init())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});
 const timer=setInterval(()=>{if(window.ModPickerGarage&&init())clearInterval(timer)},250);setTimeout(()=>clearInterval(timer),10000);
}
})();
